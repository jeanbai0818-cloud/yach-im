/**
 * yach_topic_publish_post — 在话题群中发布帖子
 *
 * 调用知音楼话题群API，在指定话题群中发布帖子。
 *
 * ## 参数
 *   - group_id    话题群ID（必填）
 *   - text        帖子文本内容（与image至少填一个）
 *   - image       图片URL数组，最多9张（与text至少填一个）
 *   - at_users    @用户工号列表，最多50个（可选）
 *   - is_question 是否为求助帖，1为是，0为否（可选，默认0）
 *
 * ## 权限
 *   需 OAuth 授权（user_access_token）
 *   scope: squad:create
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
const PublishPostSchema = Type.Object({
    group_id: Type.String({
        description: "话题群ID（必填）",
    }),
    text: Type.Optional(Type.String({
        description: "帖子文本内容（与image至少填一个）",
    })),
    image: Type.Optional(Type.Array(Type.String({
        description: "图片URL，最多9张（与text至少填一个）",
    }), {
        maxItems: 9,
    })),
    at_users: Type.Optional(Type.Array(Type.String({
        description: "@用户工号，最多50个",
    }), {
        maxItems: 50,
    })),
    is_question: Type.Optional(Type.Union([Type.Literal(0), Type.Literal(1)], {
        description: "是否为求助帖，1为是，0为否（可选，默认0）",
    })),
});
export function createTopicPublishPostTool() {
    return {
        name: "yach_topic_publish_post",
        label: "在话题群中发布帖子",
        description: "在指定的知音楼话题群中发布帖子。" +
            "可以发布纯文本或带图片的帖子，支持@用户，支持设置为求助帖。" +
            "\n\n使用场景：" +
            "- 在话题群中分享想法或观点" +
            "- 发布重要通知或公告" +
            "- 发起话题讨论" +
            "- 发布求助信息" +
            "\n\n注意：此工具需要用户OAuth授权，将以用户身份发布帖子。" +
            "text和image参数必须至少提供一个。" +
            "返回的帖子docId, 便于后续对帖子进行评论。",
        parameters: PublishPostSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            // 参数校验：text 和 image 必须至少有一个
            if (!params.text && (!params.image || params.image.length === 0)) {
                return jsonResult({
                    ok: false,
                    error: "text 和 image 参数必须至少提供一个",
                });
            }
            const client = createYachToolClient();
            if (!client.senderUserId) {
                return jsonResult({
                    ok: false,
                    error: "无法获取当前用户ID，请确认OAuth已授权",
                });
            }
            try {
                const result = await client.invoke("yach_topic_publish_post", (c) => c.topic.publishPost({
                    groupId: params.group_id,
                    postContent: {
                        text: params.text,
                        image: params.image,
                        atUsers: params.at_users,
                        isQuestion: params.is_question,
                    },
                }), { as: "user" });
                return jsonResult({
                    ok: true,
                    squadId: result.squadId,
                    docId: result.docId,
                });
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_topic_publish_post" });
            }
        },
    };
}
//# sourceMappingURL=publish-post.js.map