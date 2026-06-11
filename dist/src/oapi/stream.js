import { oapiFetch } from "../core/fetch.js";
import { yachLogger } from "../core/yach-logger.js";
const log = yachLogger("oapi/stream");
// ── YachStreamApi ─────────────────────────────────────────────────────────────
export class YachStreamApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    async createCard(toId, sessionType, replyToMessageId) {
        const token = await this.getToken();
        const url = `${this.baseUrl}/openapi/v2/msg_card/create`;
        const body = {
            to_id: toId,
            session_type: parseInt(sessionType),
        };
        if (replyToMessageId) {
            body.quote_msg_id = replyToMessageId;
        }
        log.debug("createCard", { toId, sessionType, replyToMessageId });
        const res = await oapiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const result = (await res.json());
        if (!res.ok || result.code !== 200 || !result.obj?.msg_id) {
            throw new Error(`[yach-oapi] createCard failed: ${JSON.stringify(result)}`);
        }
        log.debug("createCard ok", { msgId: result.obj.msg_id });
        return result.obj.msg_id;
    }
    async push(msgId, content) {
        const token = await this.getToken();
        const url = `${this.baseUrl}/openapi/v2/msg_content/push`;
        const body = { msg_id: msgId, msg_content: content };
        const res = await oapiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const result = (await res.json());
        if (!res.ok || result.code !== 200) {
            throw new Error(`[yach-oapi] push failed: ${JSON.stringify(result)}`);
        }
        log.debug("push ok", { msgId });
    }
    async close(msgId) {
        const token = await this.getToken();
        const url = `${this.baseUrl}/openapi/v2/msg_card/close`;
        const body = { msg_id: msgId };
        log.debug("close", { msgId });
        const res = await oapiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const result = (await res.json());
        if (!res.ok || result.code !== 200) {
            log.warn("close failed (non-fatal)", { msgId, code: result.code, msg: result.msg });
        }
    }
}
//# sourceMappingURL=stream.js.map