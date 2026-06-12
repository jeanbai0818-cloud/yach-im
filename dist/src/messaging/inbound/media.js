import { loadWebMedia } from "openclaw/plugin-sdk/web-media";
import { reportError } from "../../core/reporter.js";
export async function resolveYachMediaList(params) {
    const { message, core, log } = params;
    const { msgtype, content } = message;
    if (!["image", "file", "video"].includes(msgtype))
        return [];
    const url = content;
    if (!url)
        return [];
    try {
        const fileName = message.originName ?? undefined;
        const maxBytes = 30 * 1024 * 1024;
        const media = await loadWebMedia(url, {
            maxBytes,
            ssrfPolicy: { hostnameAllowlist: ["*.zhiyinlou.com"], allowPrivateNetwork: false },
        });
        const saved = await core.channel.media.saveMediaBuffer(media.buffer, media.contentType, "inbound", maxBytes, fileName);
        log?.(`[yach] downloaded ${msgtype} media → ${saved.path}`);
        return [{ path: saved.path, contentType: saved.contentType }];
    }
    catch (err) {
        log?.(`[yach] failed to download ${msgtype} media: ${String(err)}`);
        reportError("inbound.media", "media download failed", { msgType: msgtype, err: String(err) });
        return [];
    }
}
//# sourceMappingURL=media.js.map