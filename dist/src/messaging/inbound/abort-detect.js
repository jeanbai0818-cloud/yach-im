/**
 * Abort 触发词快速检测（P1）。
 *
 * 在消息进入 per-chat 串行队列之前，先判断是否为中止命令。
 * 若是，则绕过队列直接执行，让 abort 能立即打断正在运行的任务。
 */
const ABORT_TRIGGERS = new Set([
    "stop", "esc", "abort", "wait", "exit", "interrupt",
    "detente", "deten", "detén",
    "arrete", "arrête",
    "停止",
    "やめて", "止めて",
    "रुको",
    "توقف",
    "стоп", "остановись", "останови", "остановить", "прекрати",
    "halt", "anhalten", "aufhören", "hoer auf", "stopp",
    "pare",
    "stop openclaw", "openclaw stop",
    "stop action", "stop current action",
    "stop run", "stop current run",
    "stop agent", "stop the agent",
    "stop don't do anything", "stop dont do anything", "stop do not do anything",
    "stop doing anything",
    "do not do that",
    "please stop", "stop please",
]);
const TRAILING_PUNCT_RE = /[.!?…,，。;；:：'"'")\]}]+$/u;
function normalize(text) {
    return text
        .trim()
        .toLowerCase()
        .replace(/['`]/g, "'")
        .replace(/\s+/g, " ")
        .replace(TRAILING_PUNCT_RE, "")
        .trim();
}
export function isAbortTrigger(text) {
    if (!text)
        return false;
    return ABORT_TRIGGERS.has(normalize(text));
}
export function isLikelyAbortText(text) {
    if (!text)
        return false;
    const trimmed = text.trim().toLowerCase();
    if (trimmed === "/stop")
        return true;
    return isAbortTrigger(trimmed);
}
/**
 * 从知音楼入站消息中提取纯文本（用于 abort 检测）。
 * 只处理 text 类型消息；群聊时去除前置 @机器人 mention。
 */
export function extractYachAbortText(params) {
    const { msgtype, content, isGroup, botName } = params;
    if (msgtype !== "text")
        return undefined;
    if (!content)
        return undefined;
    let text = content;
    if (isGroup) {
        if (botName) {
            const displayName = botName.replace(/\(.*\)$/, "").trim();
            const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            text = text.replace(new RegExp(`^(@${escaped}\\s*)+`, "u"), "").trim();
        }
        else {
            text = text.replace(/^(@\S+\s*)*/u, "").trim();
        }
    }
    return text || undefined;
}
//# sourceMappingURL=abort-detect.js.map