/**
 * yach_group — 知音楼群组管理工具（混合鉴权）
 *
 * 支持 action：create / add_members / list_members / remove_members
 *
 * 鉴权模式：
 *   create / add_members / list_members — user token（代表当前用户操作）
 *   remove_members — app token（应用管理员权限）
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
const GroupSchema = Type.Object({
    action: StringEnum(["create", "add_members", "list_members", "remove_members"], {
        description: "操作类型：create 创建群；add_members 添加群成员；list_members 获取群成员列表；remove_members 删除群成员",
    }),
    // create
    group_name: Type.Optional(Type.String({ description: "群名称（create 必填）" })),
    owner_user_id: Type.Optional(Type.String({ description: "群主用户ID（create 必填）" })),
    member_user_ids: Type.Optional(Type.Array(Type.String({ description: "群成员用户ID列表" }), {
        description: "群成员用户ID列表（create 可选，不传则只有群主；add_members 必填）",
    })),
    source: Type.Optional(Type.Number({ description: "群类型（create 可选）：0=普通群（默认），3=审批群，4=项目群，102=应用模版群" })),
    tpl_id: Type.Optional(Type.String({ description: "模版群ID（创建模版群时必填，需联系管理员获取）" })),
    tpl_ext: Type.Optional(Type.String({ description: "群应用跳转需要的业务参数（create 可选）" })),
    unique_key: Type.Optional(Type.String({ description: "用于验证幂等性的唯一值（create 可选）" })),
    // add_members / remove_members / list_members
    group_id: Type.Optional(Type.String({ description: "群ID（add_members/remove_members/list_members 必填）" })),
    op_uid: Type.Optional(Type.String({ description: "操作用户ID（add_members/remove_members 必填）" })),
    confirm_risk: Type.Optional(Type.Boolean({ description: "高风险操作确认。remove_members 必须传 true 才会执行。" })),
    // list_members
    page: Type.Optional(Type.Number({ description: "当前页数（list_members 可选，默认1）" })),
    count: Type.Optional(Type.Number({ description: "每页显示条数（list_members 可选，最大100，默认100）" })),
});
export function createGroupTool() {
    return {
        name: "yach_group",
        label: "知音楼群组管理",
        description: "知音楼群组管理（混合鉴权：create/add_members/list_members 使用 user token；remove_members 使用 app token）：" +
            "create 创建群；add_members 添加群成员；list_members 获取群成员列表；remove_members 删除群成员。" +
            "群成员数量限制：最多1000人。",
        parameters: GroupSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "create": {
                        if (!params.group_name || !params.owner_user_id) {
                            return jsonResult({ ok: false, error: "create: group_name、owner_user_id 为必填" });
                        }
                        const result = await client.invoke("yach_group_create", (c) => c.group.createGroup({
                            name: params.group_name,
                            ownerUserId: params.owner_user_id,
                            memberUserIds: params.member_user_ids,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "add_members": {
                        if (!params.group_id || !params.member_user_ids || !params.op_uid) {
                            return jsonResult({
                                ok: false,
                                error: "add_members: group_id、member_user_ids、op_uid 为必填",
                            });
                        }
                        await client.invoke("yach_group_add_members", (c) => c.group.addMembers(params.group_id, params.member_user_ids, params.op_uid), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    case "list_members": {
                        if (!params.group_id) {
                            return jsonResult({ ok: false, error: "list_members: group_id 为必填" });
                        }
                        const result = await client.invoke("yach_group_list_members", (c) => c.group.listMembers(params.group_id), { as: "user" });
                        return jsonResult(result);
                    }
                    case "remove_members": {
                        if (!params.group_id || !params.member_user_ids || !params.op_uid) {
                            return jsonResult({
                                ok: false,
                                error: "remove_members: group_id、member_user_ids、op_uid 为必填",
                            });
                        }
                        if (params.confirm_risk !== true) {
                            return jsonResult({ ok: false, error: "remove_members 为高风险操作。请显式传 confirm_risk=true 进行确认。" });
                        }
                        await client.invoke("yach_group_remove_members", (c) => c.group.removeMembers(params.group_id, params.member_user_ids, params.op_uid), { as: "app" });
                        return jsonResult({ ok: true });
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_group", action: String(params.action) });
            }
        },
    };
}
export function registerGroupTools(api) {
    api.registerTool(createGroupTool());
}
//# sourceMappingURL=index.js.map