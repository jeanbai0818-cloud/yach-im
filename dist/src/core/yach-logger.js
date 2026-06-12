import { getYachRuntime } from "./runtime.js";
import { getYachTicket } from "./yach-ticket.js";
import { reportError } from "./reporter.js";
// ── Console fallback ─────────────────────────────────────────────────────────
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";
function consoleFallback(subsystem) {
    const tag = `yach/${subsystem}`;
    return {
        debug: (msg, meta) => console.debug(`${GRAY}[${tag}]${RESET}`, msg, ...(meta ? [meta] : [])),
        info: (msg, meta) => console.log(`${CYAN}[${tag}]${RESET}`, msg, ...(meta ? [meta] : [])),
        warn: (msg, meta) => console.warn(`${YELLOW}[${tag}]${RESET}`, msg, ...(meta ? [meta] : [])),
        error: (msg, meta) => console.error(`${RED}[${tag}]${RESET}`, msg, ...(meta ? [meta] : [])),
    };
}
// ── Runtime 懒加载 ────────────────────────────────────────────────────────────
function resolveRuntimeLogger(subsystem) {
    try {
        return getYachRuntime().logging.getChildLogger({ subsystem: `yach/${subsystem}` });
    }
    catch {
        return null;
    }
}
// ── Ticket context 注入 ───────────────────────────────────────────────────────
function buildPrefix() {
    const ticket = getYachTicket();
    if (!ticket)
        return "yach:";
    const includeIds = (process.env.YACH_LOG_INCLUDE_IDS ?? "").trim() === "1";
    if (!includeIds)
        return "yach:";
    return `yach[${ticket.accountId}][msg:${ticket.msgId}]:`;
}
function formatMessage(message, meta) {
    const prefix = buildPrefix();
    if (!meta || Object.keys(meta).length === 0)
        return `${prefix} ${message}`;
    const parts = Object.entries(meta)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
    return parts.length > 0 ? `${prefix} ${message} (${parts.join(", ")})` : `${prefix} ${message}`;
}
function enrichMeta(meta) {
    const ticket = getYachTicket();
    if (!ticket)
        return meta ?? {};
    const includeIds = (process.env.YACH_LOG_INCLUDE_IDS ?? "").trim() === "1";
    if (!includeIds)
        return meta ?? {};
    const trace = { accountId: ticket.accountId, msgId: ticket.msgId };
    return meta ? { ...trace, ...meta } : trace;
}
// ── 工厂 ─────────────────────────────────────────────────────────────────────
function createYachLogger(subsystem) {
    let cachedLogger = null;
    let resolved = false;
    function getLogger() {
        if (!resolved) {
            cachedLogger = resolveRuntimeLogger(subsystem);
            if (cachedLogger)
                resolved = true;
        }
        return cachedLogger ?? consoleFallback(subsystem);
    }
    return {
        subsystem,
        debug(message, meta) { getLogger().debug?.(formatMessage(message, meta), enrichMeta(meta)); },
        info(message, meta) { getLogger().info(formatMessage(message, meta), enrichMeta(meta)); },
        warn(message, meta) { getLogger().warn(formatMessage(message, meta), enrichMeta(meta)); },
        error(message, meta) {
            getLogger().error(formatMessage(message, meta), enrichMeta(meta));
            const extra = {};
            // 仅允许安全字段转发到 reportError，防止意外泄露敏感 meta
            const SAFE_META_KEYS = new Set(["category","method","status","apiPath","bizCode","code","source","action","result","msgType","errorType","replies","err"]);
            if (meta) {
                for (const [k, v] of Object.entries(meta)) {
                    if (v != null && SAFE_META_KEYS.has(k))
                        extra[k] = String(v);
                }
            }
            reportError(`yach/${subsystem}`, message, Object.keys(extra).length > 0 ? extra : undefined);
        },
        child(name) { return createYachLogger(`${subsystem}/${name}`); },
    };
}
export function yachLogger(subsystem) {
    return createYachLogger(subsystem);
}
//# sourceMappingURL=yach-logger.js.map