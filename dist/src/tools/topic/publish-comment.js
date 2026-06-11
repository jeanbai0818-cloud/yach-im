/**
 * yach_topic_publish_comment — 对话题群中的帖子发表评论
 *
 * 调用知音楼话题群API，对指定话题群中的帖子发表评论。
 *
 * ## 参数
 *   - doc_id      帖子ID（文档ID，必填）
 *   - text        评论内容（必填）
 *   - at_users    @用户工号列表（可选）
 *
 * ## 权限
 *   需 OAuth 授权（user_access_token）
 *   scope: squad:doc_comment:send
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
const PublishCommentSchema = Type.Object({
    doc_id: Type.String({
        description: "帖子ID（文档ID，必填）",
    }),
    text: Type.String({
        description: "评论内容（必填）",
    }),
    at_users: Type.Optional(Type.Array(Type.String({
        description: "@用户工号列表（可选）",
    }))),
});
export function createTopicPublishCommentTool() {
    return {
        name: "yach_topic_publish_comment",
        label: "对话题群帖子发表评论",
        description: "对指定的知音楼话题群帖子发表评论。" +
            "可以发表文本评论，支持@其他用户。" +
            "\n\n使用场景：" +
            "- 参与话题讨论" +
            "- 对帖子内容提出问题或建议" +
            "- 回复和互动" +
            "\n\n注意：此工具需要用户OAuth授权，将以用户身份发表评论。",
        parameters: PublishCommentSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            if (!client.senderUserId) {
                return jsonResult({
                    ok: false,
                    error: "无法获取当前用户ID，请确认OAuth已授权",
                });
            }
            try {
                const result = await client.invoke("yach_topic_publish_comment", (c) => c.topic.publishComment({
                    docId: params.doc_id,
                    commentContent: {
                        text: params.text,
                        atUsers: params.at_users,
                    },
                }), { as: "user" });
                return jsonResult({
                    ok: true,
                    result,
                });
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_topic_publish_comment" });
            }
        },
    };
}
//# sourceMappingURL=publish-comment.js.map