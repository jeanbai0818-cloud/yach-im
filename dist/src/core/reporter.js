/**
 * 日志上报模块。
 *
 * - reportError: 立即上报，用于错误
 * - reportEvent: 批量上报，用于关键执行路径（info 级别）
 *
 * 上报地址优先从 runtime 默认账号的 baseUrl 获取；runtime 未就绪时回退到
 * 环境变量 YACH_REPORTER_URL，最终兜底为 https://yach-oapi.zhiyinlou.com。
 */
import { appendFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getYachTicket } from "./yach-ticket.js";
import { getYachConfig } from "./runtime.js";
import { resolveYachAccount, resolveDefaultYachAccountId } from "../accounts/index.js";
import { yachLogger } from "./yach-logger.js";
const log = yachLogger("core/reporter");
const _require = createRequire(import.meta.url);
function safeRequireVersion(id) {
    try {
        return _require(id)?.version ?? "unknown";
    }
    catch {
        return "unknown";
    }
}
function resolveOpenclawVersion() {
    // openclaw 全局安装，exports 字段限制了 ./package.json 访问
    // 从宿主进程入口（process.argv[1]）创建 require，能解析到全局安装的 openclaw
    try {
        const mainFile = process.argv[1];
        if (mainFile) {
            const hostReq = createRequire(mainFile);
            let dir = dirname(hostReq.resolve("openclaw"));
            while (dir !== dirname(dir)) {
                try {
                    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
                    if (pkg.name === "openclaw")
                        return pkg.version ?? "unknown";
                }
                catch { /* continue walking */ }
                dir = dirname(dir);
            }
        }
    }
    catch { /* ignore */ }
    return "unknown";
}
const PLUGIN_VERSION = safeRequireVersion("../../../package.json");
const OPENCLAW_VERSION = resolveOpenclawVersion();
// ── 批量队列 ──────────────────────────────────────────────────────────────────
const MAX_BATCH = 50;
const FLUSH_INTERVAL_MS = 30_000;
/** 同一 path+message 的 error 事件在此窗口内只上报一次 */
const ERROR_DEDUP_WINDOW_MS = 60_000;
let buffer = [];
let flushTimer = null;
const errorDedupMap = new Map(); // key → lastReportedTs
// ── 内部工具 ──────────────────────────────────────────────────────────────────
const REPORTER_FILE = "/tmp/yach-reporter.log";
let cachedUrl;
let cachedEnv;
let cachedAppKey;
function getUrl() {
    if (cachedUrl)
        return cachedUrl;
    try {
        const cfg = getYachConfig();
        const accountId = resolveDefaultYachAccountId(cfg);
        const account = resolveYachAccount({ cfg, accountId });
        cachedAppKey = account.appKey;
        const baseUrl = account.baseUrl ?? "https://yach-oapi.zhiyinlou.com";
        cachedUrl = `${baseUrl}/openapi/v2/internal/report/log/write`;
    }
    catch {
        cachedUrl = "https://yach-oapi.zhiyinlou.com/openapi/v2/internal/report/log/write";
    }
    cachedEnv = cachedUrl.includes("yach-oapi-test.") ? "test" : "prod";
    return cachedUrl;
}
function getFilePath() { return REPORTER_FILE; }
async function writeToFile(events) {
    const filePath = getFilePath();
    if (!filePath || events.length === 0)
        return;
    const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    try {
        await appendFile(filePath, lines, "utf8");
    }
    catch {
        // fire-and-forget
    }
}
/**
 * 消息内容脱敏。
 *
 * 覆盖的模式：
 *  1. message=<value>   — YachApiError 错误消息、form body 中的消息体
 *  2. "text":"<value>"  — JSON 片段中的 text 字段（outbound reply 内容）
 *  3. "content":"<value>" — JSON 片段中的 content 字段（inbound 文本）
 */
function scrubSensitive(value) {
    let s = value;
    // message=<JSON 或其他非空白值>（compact JSON 无空格，\S+ 可完整匹配）
    s = s.replace(/\bmessage=\S+/gi, "message=[MESSAGE_CONTENT]");
    // JSON 字段 "text":"..." 和 "content":"..."（仅替换值，保留 key）
    s = s.replace(/"(text|content)"\s*:\s*"[^"]{20,}"/g, '"$1":"[MESSAGE_CONTENT]"');
    return s;
}
function buildEvent(level, path, message, extra) {
    getUrl(); // ensure cachedEnv and cachedAppKey are populated
    const ticket = getYachTicket();
    const includeIds = (process.env.YACH_REPORTER_INCLUDE_IDS ?? "").trim() === "1";
    const event = {
        level,
        path,
        message,
        env: cachedEnv,
        ts: Date.now(),
        pluginVersion: PLUGIN_VERSION,
        openclawVersion: OPENCLAW_VERSION,
    };
    if (includeIds) {
        event.accountId = cachedAppKey ?? extra?.accountId ?? ticket?.accountId;
        event.msgId = extra?.msgId ?? ticket?.msgId;
    }
    if (extra) {
        for (const [k, v] of Object.entries(extra)) {
            if (v !== undefined && k !== "accountId" && k !== "msgId") {
                event[k] = scrubSensitive(v);
            }
        }
    }
    return event;
}
async function sendBatch(events) {
    if (events.length === 0)
        return;
    await fetch(getUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: events.map((e) => JSON.stringify(e)) }),
    }).catch(() => { });
}
function scheduleFlush() {
    if (flushTimer)
        return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        const events = buffer.splice(0);
        if (events.length > 0)
            void sendBatch(events);
    }, FLUSH_INTERVAL_MS);
    flushTimer.unref?.();
}
// ── 公开 API ──────────────────────────────────────────────────────────────────
function isEnabled() {
    return (process.env.YACH_REPORTER_ENABLED ?? "").trim() === "1";
}
export function reportError(path, message, extra) {
    if (!isEnabled())
        return;
    const accountId = extra?.accountId ?? getYachTicket()?.accountId ?? "";
    const dedupKey = `${accountId}:${path}:${message}`;
    const now = Date.now();
    const last = errorDedupMap.get(dedupKey);
    if (last !== undefined && now - last < ERROR_DEDUP_WINDOW_MS)
        return;
    errorDedupMap.set(dedupKey, now);
    void sendBatch([buildEvent("error", path, message, extra)]);
}
export function reportEvent(path, message, extra) {
    if (!isEnabled())
        return;
    const event = buildEvent("info", path, message, extra);
    buffer.push(event);
    if (buffer.length >= MAX_BATCH) {
        const events = buffer.splice(0);
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        void sendBatch(events);
    }
    else {
        scheduleFlush();
    }
}
//# sourceMappingURL=reporter.js.map