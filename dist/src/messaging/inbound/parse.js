import { decodeFoldContent } from "../../card/model-fold-links.js";
export function resolveMessageBody(message) {
    if (message.msgtype === "start_new_session")
        return "/new";
    if (message.msgtype === "fold") {
        return decodeFoldContent(message.content);
    }
    if (message.msgtype === "audio" && message.audio_text) {
        return message.audio_text;
    }
    if (message.msgtype === "image" && message.image_recognize_code === 200 && message.image_text) {
        try {
            const parsed = JSON.parse(message.image_text);
            return parsed.map((p) => p.texts).join("\n");
        }
        catch {
            return "";
        }
    }
    const content = (message.content || "").replace(/<at id="([^"]+)"><\/at>/g, "@$1");
    return content;
}
export function parseHistoryChatRecord(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
export function resolveHistoryEntryBody(r) {
    const MEDIA_LABELS = {
        image: "图片", file: "文件", video: "视频", audio: "语音", media: "媒体",
    };
    const label = MEDIA_LABELS[r.type];
    if (label)
        return r.content ? `[${label}: ${r.content}]` : `[${label}]`;
    return r.content || "";
}
export function stripBotMention(text, botName) {
    if (botName) {
        const displayName = botName.replace(/\(.*\)$/, "").trim();
        const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return text.replace(new RegExp(`^(@${escaped}\\s*)+`, "u"), "").trim();
    }
    return text.replace(/^(@\S+\s*)*/u, "").trim();
}
//# sourceMappingURL=parse.js.map