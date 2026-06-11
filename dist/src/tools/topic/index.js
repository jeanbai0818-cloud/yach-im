/**
 * Yach Topic Tools — 话题群（小队）工具
 *
 * 提供话题群中发布帖子、评论功能。
 */
import { createTopicPublishPostTool } from "./publish-post.js";
import { createTopicPublishCommentTool } from "./publish-comment.js";
export function registerTopicTools(api) {
    api.registerTool(createTopicPublishPostTool());
    api.registerTool(createTopicPublishCommentTool());
}
//# sourceMappingURL=index.js.map