/**
 * yach_okr — OKR工具（user_access_token）
 *
 * 支持 action：list
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
const OkrSchema = Type.Object({
    action: StringEnum(["list"], {
        description: "操作类型：list 查询OKR列表",
    }),
    query_type: Type.Optional(StringEnum(["person", "department"], {
        description: "筛选类型：person(用户), department(部门)。当此参数存在时，query_value 为必填",
    })),
    query_value: Type.Optional(Type.String({ description: "筛选值。若传了 query_type 则必填。对应：工号/部门ID" })),
    start_month: Type.Optional(Type.String({ description: "开始日期，格式 YYYY-MM（UTC+0），默认去年同月。如 2026-03" })),
    end_month: Type.Optional(Type.String({ description: "结束日期，格式 YYYY-MM（UTC+0），默认当月。如 2026-04" })),
    sort: Type.Optional(StringEnum(["asc", "desc"], { description: "排序方式。支持 asc（升序）或 desc（降序）" })),
    next_page: Type.Optional(Type.String({ description: "分页标识，由上一次查询返回" })),
});
export function createOkrTool() {
    return {
        name: "yach_okr",
        label: "知音楼OKR",
        description: "知音楼OKR（以当前用户身份操作，需 OAuth 授权）：" +
            "list 查询OKR列表，支持按用户、部门筛选，支持月份范围、排序和分页。",
        parameters: OkrSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            // ========== 参数校验 ==========
            // 校验 1：query_type 存在时，query_value 必须填写
            if (params.query_type && !params.query_value) {
                return jsonResult({
                    ok: false,
                    error: `参数错误：query_type="${params.query_type}" 时，query_value 为必填参数`,
                    hint: "正确用法：query_type=person&query_value=167680",
                });
            }
            // 校验 2：月份格式校验 (YYYY-MM)
            const monthRegex = /^\d{4}-\d{2}$/;
            if (params.start_month && !monthRegex.test(params.start_month)) {
                return jsonResult({
                    ok: false,
                    error: `参数错误：start_month 格式错误 "${params.start_month}"`,
                    hint: "正确格式：YYYY-MM，如 2026-03",
                });
            }
            if (params.end_month && !monthRegex.test(params.end_month)) {
                return jsonResult({
                    ok: false,
                    error: `参数错误：end_month 格式错误 "${params.end_month}"`,
                    hint: "正确格式：YYYY-MM，如 2026-04",
                });
            }
            // ========== 业务逻辑 ==========
            try {
                switch (params.action) {
                    case "list": {
                        const result = await client.invoke("yach_okr_list", (c) => c.okr.list({
                            query_type: params.query_type,
                            query_value: params.query_value,
                            start_month: params.start_month,
                            end_month: params.end_month,
                            sort: params.sort,
                            next_page: params.next_page,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_okr", action: String(params.action) });
            }
        },
    };
}
export function registerOkrTools(api) {
    api.registerTool(createOkrTool());
}
//# sourceMappingURL=index.js.map