/**
 * yach_im_get_messages — 获取群聊消息记录（app token）
 *
 * 按时间范围分页拉取指定群聊的历史消息。
 *
 * ## 参数
 *   - group_id    群 ID（必填）
 *   - start_time  开始时间，ISO 8601 / RFC 3339 含时区，例如 '2024-01-01T00:00:00+08:00'（必填）
 *   - end_time    结束时间，ISO 8601 / RFC 3339 含时区，例如 '2024-01-01T23:59:59+08:00'（必填）
 *   - page_size   每页条数，默认 20，最大 50（可选）
 *   - page_token  翻页令牌，首次不填，后续从响应 page_token 字段获取（可选）
 *
 * ## 响应
 *   - messages[]
 *     - message_id    消息 ID
 *     - sender_id     发送者用户 ID
 *     - sender_name   发送者名称
 *     - content       消息内容（文本为文本内容，文件/图片为链接）
 *     - message_type  消息类型（text / file / image / ...）
 *     - created_time  发送时间戳（秒）
 *   - hasMore      是否有更多页
 *   - pageToken    下一页令牌（hasMore=true 时有值）
 *
 * ## 权限
 *   API:   GET /openapi/v2/im/messages
 *   scope: im:group:msg:list
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { isoToUnix } from "../helpers.js";
const MessagesReadSchema = Type.Object({
    group_id: Type.String({ description: "群 ID（必填）" }),
    start_time: Type.String({ description: "查询开始时间，ISO 8601 / RFC 3339 格式含时区，例如 '2024-01-01T00:00:00+08:00'（必填）" }),
    end_time: Type.String({ description: "查询结束时间，ISO 8601 / RFC 3339 格式含时区，例如 '2024-01-01T23:59:59+08:00'（必填）" }),
    page_size: Type.Optional(Type.Number({ description: "每页条数，默认 20，最大 50" })),
    page_token: Type.Optional(Type.String({ description: "分页令牌，从上一页 page_token 获取" })),
});
export function createImMessagesReadTool() {
    return {
        name: "yach_im_get_messages",
        label: "知音楼群聊消息记录",
        description: "获取知音楼群聊的历史消息记录，按时间范围分页查询（app token）。",
        parameters: MessagesReadSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                const result = await client.invoke("yach_im_get_messages", (c) => c.im.getMessages({
                    groupId: params.group_id,
                    startTime: isoToUnix(params.start_time),
                    endTime: isoToUnix(params.end_time),
                    pageSize: params.page_size ?? 20,
                    pageToken: params.page_token,
                }), { as: "app" });
                return jsonResult(result);
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_im_get_messages" });
            }
        },
    };
}
//# sourceMappingURL=messages-read.js.map