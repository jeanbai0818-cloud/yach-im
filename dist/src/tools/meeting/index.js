/**
 * 会议工具（user_access_token）
 *
 * yach_meeting_record_text — 读取会议录制或速记的文本内容
 *   get_text 获取全量文本，支持速记与在线会议两种类型
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
// ── 类型映射 ──────────────────────────────────────────────────────────────────
const URL_TYPE_LABEL = {
    "2": "速记",
    "3": "在线会议录制",
};
// ── yach_meeting_record_text ──────────────────────────────────────────────────
const MeetingRecordTextSchema = Type.Object({
    action: StringEnum(["get_text"], {
        description: "get_text 读取会议录制或速记的全量文本内容",
    }),
    url: Type.String({
        description: "会议录制或速记的链接 URL",
    }),
    confirm_risk: Type.Optional(Type.Boolean({ description: "高风险读取确认。读取会议全文必须传 true 才会执行。" })),
});
export function createMeetingRecordTextTool() {
    return {
        name: "yach_meeting_record_text",
        label: "知音楼会议录制&速记文本读取",
        description: "读取知音楼会议录制或速记的文本内容（需 OAuth 授权）。" +
            "get_text 传入 URL，返回全量文字内容及内容类型（速记 / 在线会议录制），" +
            "可用于总结、分析、提取要点等。",
        parameters: MeetingRecordTextSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "get_text": {
                        if (params.confirm_risk !== true) {
                            return jsonResult({ ok: false, error: "读取会议全文为高风险操作。请显式传 confirm_risk=true 进行确认。" });
                        }
                        const result = await client.invoke("yach_meeting_record_text", (c) => c.meeting.getRecordText({ url: params.url }), { as: "user" });
                        const typeLabel = URL_TYPE_LABEL[result.url_type] ?? `未知类型(${result.url_type})`;
                        return jsonResult({
                            type_hint: `这是一份${typeLabel}的文本内容`,
                            content: result.content,
                            url_type: result.url_type,
                        });
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err);
            }
        },
    };
}
// ── 注册 ──────────────────────────────────────────────────────────────────────
export function registerMeetingTools(api) {
    api.registerTool(createMeetingRecordTextTool());
}
//# sourceMappingURL=index.js.map