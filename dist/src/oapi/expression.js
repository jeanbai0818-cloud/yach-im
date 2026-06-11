import { oapiFetch } from "../core/fetch.js";
import { yachLogger } from "../core/yach-logger.js";
const log = yachLogger("oapi/expression");
// ── YachExpressionApi ─────────────────────────────────────────────────────────
export class YachExpressionApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /**
     * 向消息添加或撤销表情（同一参数调用两次即撤销，可用于模拟输入状态指示器）
     *
     * expression API 的 session_type 编码：单聊=0，群聊=1（与消息 API 的 "1"/"2" 不同）
     */
    async toggle(params) {
        const { sessionId, sessionType, msgId, expression, fromUserId } = params;
        const token = await this.getToken();
        const expressionSessionType = sessionType === "2" ? "1" : "0";
        const body = new URLSearchParams({
            access_token: token,
            session_type: expressionSessionType,
            msg_id: msgId,
            expression,
            from_userid: fromUserId,
        });
        if (expressionSessionType === "1") {
            body.set("session_id", sessionId);
        }
        log.debug("toggle", { msgId, expression, sessionType: expressionSessionType });
        const res = await oapiFetch(`${this.baseUrl}/message/expression/add`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const result = (await res.json());
        if (!res.ok || result.code !== 200) {
            throw new Error(`[yach-oapi] toggleExpression failed: ${JSON.stringify(result)}`);
        }
    }
}
//# sourceMappingURL=expression.js.map