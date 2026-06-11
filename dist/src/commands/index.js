/**
 * yach 命令注册
 *
 * /yach          — 帮助
 * /yach start    — 快速检查账号配置
 * /yach doctor   — 完整诊断（账号 + API 连通性）
 */
import * as os from "node:os";
import { listYachAccountIds, resolveYachAccount } from "../accounts/index.js";
import { getAccessToken } from "../core/app-token.js";
import { configManager } from "../core/config.js";
// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------
function getPluginVersion() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require("../../package.json");
        return pkg.version ?? "unknown";
    }
    catch {
        return "unknown";
    }
}
// ---------------------------------------------------------------------------
// /yach start — 快速配置检查
// ---------------------------------------------------------------------------
export function runYachStart(config) {
    const accountIds = listYachAccountIds(config);
    const lines = [`知音楼 OpenClaw 插件 v${getPluginVersion()}`];
    const errors = [];
    const warnings = [];
    if (accountIds.length === 0) {
        errors.push("❌ 未找到任何账号配置");
    }
    else {
        for (const accountId of accountIds) {
            const account = resolveYachAccount({ cfg: config, accountId });
            if (!account.configured) {
                errors.push(`❌ 账号 "${accountId}" 未配置（缺少 appKey 或 appSecret）`);
            }
            else if (!account.enabled) {
                warnings.push(`⚠️ 账号 "${accountId}" 已禁用`);
            }
            else {
                lines.push(`✅ 账号 "${accountId}" 已配置（appKey: ${account.appKey?.slice(0, 6)}***）`);
            }
        }
    }
    if (errors.length > 0) {
        return [`❌ 插件配置有误：`, ...errors, ...warnings].join("\n");
    }
    if (warnings.length > 0) {
        return [lines.join("\n"), "", ...warnings].join("\n");
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// /yach config — 配置管理
// ---------------------------------------------------------------------------
export function runYachConfig(args) {
    const sub = args?.trim().split(/\s+/)[0]?.toLowerCase();
    if (!sub || sub === "show") {
        const currentArea = configManager.getVersionArea();
        return (`## 知音楼配置\n\n` +
            `**当前版本区域：** \`${currentArea}\`\n\n` +
            `用法：\n` +
            `  /yach config show     — 显示当前配置\n` +
            `  /yach config set <值> — 设置版本区域\n` +
            `  /yach config reload   — 从文件重新加载配置`);
    }
    if (sub === "set") {
        const value = args?.trim().split(/\s+/).slice(1).join(" ");
        if (!value) {
            return "❌ 请提供要设置的值。用法：/yach config set <值>";
        }
        configManager.setVersionArea(value);
        return `✅ 已设置版本区域为：\`${value}\``;
    }
    if (sub === "reload") {
        configManager.reload();
        return `✅ 已重新加载配置文件`;
    }
    return "❌ 未知子命令。用法：/yach config show|set|reload";
}
// ---------------------------------------------------------------------------
// /yach doctor — 完整诊断
// ---------------------------------------------------------------------------
export async function runYachDoctor(config) {
    const accountIds = listYachAccountIds(config);
    const sections = [];
    // 环境信息
    sections.push(`## 知音楼 OpenClaw 诊断报告`, ``, `**时间：** ${new Date().toISOString()}`, `**版本：** v${getPluginVersion()}`, `**Node：** ${process.version}`, `**平台：** ${os.platform()} ${os.arch()}`, ``);
    // 账号配置
    sections.push(`### 账号配置`);
    if (accountIds.length === 0) {
        sections.push(`❌ 未找到任何账号`);
    }
    else {
        for (const accountId of accountIds) {
            const account = resolveYachAccount({ cfg: config, accountId });
            if (!account.configured) {
                sections.push(`- **${accountId}**: ❌ 未配置（缺少 appKey 或 appSecret）`);
                continue;
            }
            if (!account.enabled) {
                sections.push(`- **${accountId}**: ⚠️ 已禁用`);
                continue;
            }
            // API 连通性探针
            let connectStatus;
            try {
                await getAccessToken(account.baseUrl, {
                    appKey: account.appKey,
                    appSecret: account.appSecret,
                });
                connectStatus = "✅ API 连通正常";
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                connectStatus = `❌ API 连通失败: ${msg}`;
            }
            sections.push(`- **${accountId}**: ✅ 已配置`, `  - appKey: \`${account.appKey?.slice(0, 6)}***\``, `  - baseUrl: \`${account.baseUrl}\``, `  - 连通性: ${connectStatus}`);
        }
    }
    sections.push(``);
    return sections.join("\n");
}
// ---------------------------------------------------------------------------
// 帮助文本
// ---------------------------------------------------------------------------
function getHelp() {
    return (`知音楼 OpenClaw 插件 v${getPluginVersion()}\n\n` +
        `用法：\n` +
        `  /yach start  — 快速检查账号配置\n` +
        `  /yach doctor — 完整诊断（账号 + API 连通性）\n` +
        `  /yach config — 配置管理（show、set、reload）\n` +
        `  /yach help   — 显示此帮助`);
}
// ---------------------------------------------------------------------------
// 注册命令
// ---------------------------------------------------------------------------
export function registerYachCommands(api) {
    api.registerCommand({
        name: "yach",
        description: "知音楼插件命令（子命令：start、doctor、config、help）",
        acceptsArgs: true,
        requireAuth: true,
        async handler(ctx) {
            const sub = ctx.args?.trim().split(/\s+/)[0]?.toLowerCase();
            try {
                if (sub === "start") {
                    return { text: runYachStart(ctx.config) };
                }
                if (sub === "doctor") {
                    const md = await runYachDoctor(ctx.config);
                    return { text: md };
                }
                if (sub === "config") {
                    const remainingArgs = ctx.args?.trim().split(/\s+/).slice(1).join(" ");
                    return { text: runYachConfig(remainingArgs) };
                }
                return { text: getHelp() };
            }
            catch (err) {
                return {
                    text: `执行失败: ${err instanceof Error ? err.message : String(err)}`,
                };
            }
        },
    });
}
//# sourceMappingURL=index.js.map