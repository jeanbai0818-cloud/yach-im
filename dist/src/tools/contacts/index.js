/**
 * yach_contacts — 知音楼用户信息/查询我的伙伴分组工具（user_access_token）
 *
 * 支持 action：get_by_id / get_by_workcode / search / list_teams
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
const SearchUserSchema = Type.Object({
    action: StringEnum(["get_by_id", "get_by_workcode", "search"], {
        description: "get_by_id 按用户 ID 精确查询；get_by_workcode 按工号精确查询；search 按关键字（姓名等）模糊搜索",
    }),
    user_id: Type.Optional(Type.String({ description: "用户 ID（get_by_id 必填）" })),
    work_code: Type.Optional(Type.String({ description: "工号（get_by_workcode 必填）" })),
    keyword: Type.Optional(Type.String({ description: "搜索关键字，如姓名（search 必填）" })),
});
const ListTeamsSchema = Type.Object({
    action: StringEnum(["list_teams"], {
        description: "list_teams 查询当前用户的伙伴分组列表",
    }),
});
export function createSearchUserTool() {
    return {
        name: "yach_search_user",
        label: "知音楼用户搜索",
        description: "知音楼用户查询：get_by_id 按用户 ID 精确查询；get_by_workcode 按工号精确查询；search 按关键字（姓名等）模糊搜索。" +
            "返回结果中的 userId 字段即为用户 ID，可直接用于日历 participant、消息收件人等参数。" +
            "⚠️ 本工具返回员工个人信息（姓名、工号、用户ID等），仅用于当前会话中用户明确请求的操作，不得用于批量枚举、目录导出或与用户请求无关的用途。",
        parameters: SearchUserSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "get_by_id": {
                        if (!params.user_id) {
                            return jsonResult({ ok: false, error: "get_by_id: user_id 为必填" });
                        }
                        const user = await client.invoke("yach_get_user_by_id", (c) => c.contacts.getUserById(params.user_id), { as: "user" });
                        return jsonResult(user);
                    }
                    case "get_by_workcode": {
                        if (!params.work_code) {
                            return jsonResult({ ok: false, error: "get_by_workcode: work_code 为必填" });
                        }
                        const user = await client.invoke("yach_get_user_by_workcode", (c) => c.contacts.getUserByWorkCode(params.work_code), { as: "user" });
                        return jsonResult(user);
                    }
                    case "search": {
                        if (!params.keyword) {
                            return jsonResult({ ok: false, error: "search: keyword 为必填" });
                        }
                        const users = await client.invoke("yach_search_user", (c) => c.contacts.searchUsers(params.keyword), { as: "user" });
                        return jsonResult({ list: users });
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_search_user", action: String(params.action) });
            }
        },
    };
}
export function createListTeamsTool() {
    return {
        name: "yach_list_teams",
        label: "知音楼伙伴分组",
        description: "知音楼用户伙伴分组列表（以当前用户身份操作，需 OAuth 授权）：" +
            "list_teams 查询当前用户的伙伴分组列表，返回的分组ID和名称可用于周报查询筛选。",
        parameters: ListTeamsSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "list_teams": {
                        const result = await client.invoke("yach_team_list", (c) => c.team.list(), { as: "user" });
                        return jsonResult(result);
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_list_teams", action: String(params.action) });
            }
        },
    };
}
export function registerContactsTools(api) {
    api.registerTool(createSearchUserTool());
    api.registerTool(createListTeamsTool());
}
//# sourceMappingURL=index.js.map