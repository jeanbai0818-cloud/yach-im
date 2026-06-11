import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import { YachClient } from "../../core/yach-client.js";
import { getYachRuntime } from "../../core/runtime.js";
import { resolveYachAccountByBotId } from "../../accounts/index.js";
import { getAudioDuration } from "../../oapi/audio.js";
function resolveYachAccount(cfg, accountId) {
    return resolveYachAccountByBotId({ cfg, botId: accountId });
}
/**
 * 判断字符串是否为知音楼工号。
 * user_id 格式（非工号）：以 "yach" 开头，或超过6位的纯数字（如 58230675760877818）。
 * 其余均视为工号（纯数字≤6位、V+数字、P+数字等各类前缀格式）。
 */
function isWorkCode(id) {
    return !/^yach/i.test(id) && !(/^\d+$/.test(id) && id.length > 6);
}
function resolveTarget(to) {
    if (to.startsWith("group:")) {
        return { toId: to.slice(6), conversationType: "2" };
    }
    if (to.startsWith("work_code:")) {
        return { toId: "", conversationType: "1", toWorkCode: to.slice(10) };
    }
    const id = to.startsWith("user:") ? to.slice(5) : to;
    if (isWorkCode(id)) {
        return { toId: "", conversationType: "1", toWorkCode: id };
    }
    return { toId: id, conversationType: "1" };
}
function parseAtMentions(text) {
    const atMobiles = [];
    const atWorkCodes = [];
    let isAtAll = false;
    for (const [, id] of text.matchAll(/@(\S+)/g)) {
        if (id === "all" || id === "所有人") {
            isAtAll = true;
        }
        else if (/^1\d{10}$/.test(id)) {
            atMobiles.push(id);
        }
        else if (isWorkCode(id)) {
            atWorkCodes.push(id);
        }
    }
    if (!isAtAll && atMobiles.length === 0 && atWorkCodes.length === 0)
        return undefined;
    return { atMobiles, atWorkCodes, isAtAll };
}
function detectMediaKind(filePath) {
    const ext = extname(filePath).toLowerCase().slice(1);
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext))
        return "image";
    if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext))
        return "video";
    if (["amr", "acc", "m4a", "mp3"].includes(ext))
        return "audio";
    return "file";
}
function detectContentType(filePath) {
    const ext = extname(filePath).toLowerCase();
    const map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
        ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska", ".webm": "video/webm", ".m4v": "video/x-m4v",
        ".pdf": "application/pdf", ".zip": "application/zip",
    };
    return map[ext] ?? "application/octet-stream";
}
export const yachOutbound = {
    deliveryMode: "direct",
    chunkerMode: "markdown",
    textChunkLimit: 4000,
    chunker: (text, limit) => getYachRuntime().channel.text.chunkMarkdownText(text, limit),
    sendText: async ({ cfg, to, text, accountId }) => {
        const account = resolveYachAccount(cfg, accountId ?? undefined);
        const { toId, conversationType, toWorkCode } = resolveTarget(to);
        const at = conversationType === "2" ? parseAtMentions(text) : undefined;
        const messageId = await YachClient.fromAccount(account).im.sendMessage({
            toId,
            conversationType,
            toWorkCode,
            payload: { msgtype: "markdown", markdown: { title: text.slice(0, 50), text } },
            at,
        });
        return { channel: "yach", messageId: messageId ?? "" };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
        const account = resolveYachAccount(cfg, accountId ?? undefined);
        const { toId, conversationType, toWorkCode } = resolveTarget(to);
        const client = YachClient.fromAccount(account);
        if (text?.trim()) {
            await client.im.sendMessage({
                toId,
                conversationType,
                toWorkCode,
                payload: { msgtype: "text", text: { content: text } },
            });
        }
        if (mediaUrl) {
            const kind = detectMediaKind(mediaUrl);
            const filename = basename(mediaUrl) || "file";
            const contentType = detectContentType(mediaUrl);
            const data = await readFile(mediaUrl);
            const cosType = kind === "file" ? "file" : "image";
            const cosUrl = await client.cos.upload({ filename, data, contentType, cosType });
            let payload;
            if (kind === "image") {
                payload = { msgtype: "image", image: { url: cosUrl, file_name: filename } };
            }
            else if (kind === "video") {
                payload = { msgtype: "video", video: { name: filename, url: cosUrl } };
            }
            else if (kind === "audio") {
                payload = { msgtype: "audio", audio: { duration: await getAudioDuration(mediaUrl), url: cosUrl, size: data.length } };
            }
            else {
                payload = { msgtype: "file", file: { name: filename, url: cosUrl, size: data.length.toString() } };
            }
            const messageId = await client.im.sendMessage({ toId, conversationType, toWorkCode, payload });
            return { channel: "yach", messageId: messageId ?? "" };
        }
        return { channel: "yach", messageId: "" };
    },
};
//# sourceMappingURL=outbound.js.map