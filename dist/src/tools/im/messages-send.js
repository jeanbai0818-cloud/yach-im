/**
 * yach_im_messages — 以用户身份发送 IM 消息（user_access_token）
 *
 * 调用知音楼用户消息接口（非机器人），消息显示为当前 OAuth 登录用户发出。
 *
 * ## 接口
 *   单聊：POST /single/message/send
 *   群聊：POST /group/message/send（开发中）
 *
 * ## 参数
 *   - conv_type   会话类型：1=单聊 2=群聊（必填）
 *   - to_id       接收者 yach_id（单聊）或群 ID（群聊）（必填）
 *   - msgtype     消息类型：text（默认）/ markdown / file / image
 *   - content     消息正文（text/markdown 必填）
 *   - title       Markdown 标题（msgtype=markdown 时必填）
 *   - file_path   本地文件路径（msgtype=file/image 时与 file_url 二选一）
 *   - file_url    已有文件/图片 URL（msgtype=file/image 时与 file_path 二选一）
 *   - file_name   文件名（使用 file_url 时必填；使用 file_path 时自动从路径提取）
 *   - message_id  业务去重 ID（可选）
 *
 * ## 权限
 *   需 OAuth 授权（user_access_token）
 *   scope: im:message:send, im:group:send
 */
import path from "node:path";
import fs from "node:fs/promises";
import { lookup as mimeLookup } from "mime-types";
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
function isPathAllowed(filePath) {
    const raw = (process.env.YACH_ALLOWED_LOCAL_PATHS ?? "").trim();
    if (!raw)
        return false;
    const abs = path.resolve(filePath);
    const roots = raw.split(",").map((v) => v.trim()).filter(Boolean).map((v) => path.resolve(v));
    return roots.some((root) => abs === root || abs.startsWith(root + "/"));
}
const MessagesSendSchema = Type.Object({
    conv_type: StringEnum(["1", "2"], {
        description: "会话类型：1=单聊 2=群聊（必填）",
    }),
    to_id: Type.String({
        description: "收件人用户 ID（单聊）或群 ID（群聊）（必填）",
    }),
    msgtype: Type.Optional(StringEnum(["text", "markdown", "file", "image"], {
        description: "消息类型：text=纯文本（默认）/ markdown=Markdown / file=文件 / image=图片",
    })),
    content: Type.Optional(Type.String({ description: "消息正文（msgtype=text/markdown 时必填）" })),
    title: Type.Optional(Type.String({ description: "Markdown 标题（msgtype=markdown 时必填）" })),
    file_path: Type.Optional(Type.String({ description: "本地文件绝对路径（msgtype=file/image 时与 file_url 二选一，工具自动上传至 COS）" })),
    file_url: Type.Optional(Type.String({ description: "已有文件/图片 URL（msgtype=file/image 时与 file_path 二选一）" })),
    file_name: Type.Optional(Type.String({ description: "文件名（使用 file_url 时必填；使用 file_path 时自动提取）" })),
    message_id: Type.Optional(Type.String({ description: "业务去重 ID，相同 ID 不会重复投递（可选）" })),
    confirm_risk: Type.Optional(Type.Boolean({ description: "高风险发送确认。必须传 true 才会执行。" })),
});
export function createImMessagesSendTool() {
    return {
        name: "yach_im_user_messages",
        label: "Yach: IM User Messages",
        description: "知音楼用户身份 IM 消息工具（高风险）。 " +
            "**仅当用户明确要求“以我本人身份发送（如：用我身份发 / 以我名义发 / 用我账号发 / 让对方看到是我发的）”时才可使用，当没有明确要求时优先使用 message 系统工具**。" +
            "\n\n 以下情况禁止使用（必须用 message 工具）： \n -  “帮我给 XXX 发消息” \n - “通知 / 回复 / 发一句” \n - 未明确说明发送身份的 " +
            "\n\n【安全约束】此工具以用户身份发送消息，发出后对方看到的发送者是用户本人。" +
            "调用前必须先向用户确认：1) 发送对象（哪个人或哪个群）2) 消息内容。" +
            "禁止在用户未明确同意的情况下自行发送消息。" +
            "消息发送成功后要返回消息 ID，方便后续撤回。" +
            "禁止将此工具用于向会话发起者/用户本人发送通知，应改用 message 工具（channel: yach）。",
        parameters: MessagesSendSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            if (params.confirm_risk !== true) {
                return jsonResult({ ok: false, error: "以用户身份发消息为高风险操作。请显式传 confirm_risk=true 进行确认。" });
            }
            const msgtype = params.msgtype ?? "text";
            // ── 参数校验 ───────────────────────────────────────────────────────
            if ((msgtype === "text" || msgtype === "markdown") && !params.content) {
                return jsonResult({ ok: false, error: `msgtype=${msgtype} 时 content 为必填` });
            }
            if (msgtype === "markdown" && !params.title) {
                return jsonResult({ ok: false, error: "msgtype=markdown 时 title 为必填" });
            }
            if ((msgtype === "file" || msgtype === "image") && !params.file_path && !params.file_url) {
                return jsonResult({ ok: false, error: `msgtype=${msgtype} 时 file_path 或 file_url 必填其一` });
            }
            if ((msgtype === "file" || msgtype === "image") && params.file_url && !params.file_name) {
                return jsonResult({ ok: false, error: "使用 file_url 时 file_name 为必填" });
            }
            const client = createYachToolClient();
            if (!client.senderUserId) {
                return jsonResult({ ok: false, error: "无法获取当前用户 ID，请确认 OAuth 已授权" });
            }
            try {
                const fromUserId = client.senderUserId;
                const yachMid = await client.invoke("yach_im_messages", async (c) => {
                    // ── 构造 payload ─────────────────────────────────────────────
                    let payload;
                    if (msgtype === "text") {
                        payload = { msgtype: "text", text: { content: params.content } };
                    }
                    else if (msgtype === "markdown") {
                        payload = { msgtype: "markdown", markdown: { title: params.title, text: params.content } };
                    }
                    else {
                        // file 或 image：先确定 URL
                        let url;
                        let filename;
                        if (params.file_path) {
                            if (!isPathAllowed(params.file_path)) {
                                throw new Error("file_path 不在允许目录内。请设置环境变量 YACH_ALLOWED_LOCAL_PATHS（逗号分隔绝对路径白名单）。");
                            }
                            filename = path.basename(params.file_path);
                            const data = await fs.readFile(params.file_path);
                            const contentType = (mimeLookup(filename) || "application/octet-stream");
                            const cosType = msgtype === "image" ? "image" : "file";
                            url = await c.cos.upload({ filename, data, contentType, cosType });
                        }
                        else {
                            url = params.file_url;
                            filename = params.file_name;
                        }
                        if (msgtype === "image") {
                            payload = { msgtype: "image", image: { url, file_name: filename } };
                        }
                        else {
                            payload = { msgtype: "file", file: { name: filename, url } };
                        }
                    }
                    // ── 发送 ─────────────────────────────────────────────────────
                    if (params.conv_type === "2") {
                        return c.im.sendGroupMessageAsUser({
                            fromUserId,
                            groupId: params.to_id,
                            payload,
                            messageId: params.message_id,
                        });
                    }
                    return c.im.sendSingleMessageAsUser({
                        fromUserId,
                        toUserId: params.to_id,
                        payload,
                        messageId: params.message_id,
                    });
                }, { as: "user" });
                return jsonResult({ ok: true, yachMid });
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_im_user_messages" });
            }
        },
    };
}
//# sourceMappingURL=messages-send.js.map