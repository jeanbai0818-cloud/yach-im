/**
 * YachTopicApi — 话题群（小队）相关 OAPI
 *
 * 提供话题群中发布帖子和评论功能。
 */
import { oapiFetch } from "../core/fetch.js";
import { yachLogger } from "../core/yach-logger.js";
import { YachApiError } from "./errors.js";
const log = yachLogger("oapi/topic");
// ── YachTopicApi ──────────────────────────────────────────────────────────────
export class YachTopicApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /**
     * 在话题群中发布帖子
     *
     * @param groupId 话题群ID
     * @param postContent 帖子内容
     * @returns 小队ID
     */
    async publishPost(params) {
        const { groupId, postContent } = params;
        const token = await this.getToken();
        log.debug("publishPost", { groupId, text: postContent.text, imageCount: postContent.image?.length });
        // text 和 image 必须有一个不为空
        if (!postContent.text && (!postContent.image || postContent.image.length === 0)) {
            throw new Error("[yach-oapi] publishPost: text and image cannot both be empty");
        }
        const body = {
            group_id: groupId,
            text: postContent.text || "",
            image: postContent.image || [],
            at_users: JSON.stringify(postContent.atUsers || []),
            is_question: postContent.isQuestion ?? 0,
        };
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/squad/doc_send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const result = (await res.json());
        if (result.code !== 200 && result.code !== 0) {
            throw new YachApiError(`[yach-oapi] publishPost error: ${JSON.stringify(result)}\n` +
                `  request: /openapi/v2/squad/doc_send group_id=${groupId}`, result.code);
        }
        log.debug("publishPost ok", { groupId, squadId: result.obj?.squad_id || "", docId: result.obj?.doc_id || "" });
        return { squadId: result.obj?.squad_id || "", docId: result.obj?.doc_id || "" };
    }
    /**
     * 对话题群中的帖子发表评论
     *
     * @param docId 帖子ID（文档ID）
     * @param commentContent 评论内容
     * @returns 评论结果
     */
    async publishComment(params) {
        const { docId, commentContent } = params;
        const token = await this.getToken();
        log.debug("publishComment", { docId, text: commentContent.text });
        const body = {
            doc_id: docId,
            text: commentContent.text,
            at_users: JSON.stringify(commentContent.atUsers || []),
        };
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/squad/doc_comment/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const result = (await res.json());
        if (result.code !== 200 && result.code !== 0) {
            throw new YachApiError(`[yach-oapi] publishComment error: ${JSON.stringify(result)}\n` +
                `  request: /openapi/v2/squad/doc_comment/send doc_id=${docId}`, result.code);
        }
        log.debug("publishComment ok", { docId, result: result.obj });
        return result.obj || {};
    }
}
//# sourceMappingURL=topic.js.map