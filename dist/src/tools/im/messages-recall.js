/**
 * yach_im_message_recall — 消息撤回（app_access_token）
 *
 * 撤回之前发送的消息。
 *
 * ## 参数
 *   - msg_id     消息 ID（必填）
 *
 * ## 响应
 *   - success     是否成功
 *
 * ## 权限
 *   API:   POST /openapi/v2/msg/recall
 *   Token: app_access_token（无需 OAuth 授权）
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
const RecallMessageSchema = Type.Object({
    msg_id: Type.String({
        description: "要撤回的消息 ID（必填）",
    }),
    confirm_risk: Type.Optional(Type.Boolean({ description: "高风险操作确认。必须传 true 才会执行。" })),
});
export function createImMessageRecallTool() {
    return {
        name: "yach_im_message_recall",
        label: "Yach: IM Message Recall",
        description: "撤回知音楼消息。",
        parameters: RecallMessageSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            if (params.confirm_risk !== true) {
                return jsonResult({ ok: false, error: "消息撤回为高风险操作。请显式传 confirm_risk=true 进行确认。" });
            }
            const client = createYachToolClient();
            try {
                const result = await client.invoke("yach_im_message_recall", (c) => c.im.recallMessage({ yach_mid: params.msg_id }), { as: "app" });
                return jsonResult(result);
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_im_message_recall" });
            }
        },
    };
}
//# sourceMappingURL=messages-recall.js.map