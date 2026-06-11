/**
 * YachGroupApi — 群组管理 OAPI
 *
 * 所有接口使用 app_access_token（URL query），form-urlencoded 提交。
 */
import { oapiFetch } from "../core/fetch.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
function postForm(url, params) {
    return oapiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
    });
}
// ── YachGroupApi ──────────────────────────────────────────────────────────────
export class YachGroupApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 创建群（POST /group/create） */
    async createGroup(params) {
        const token = await this.getToken();
        const members = params.memberUserIds?.length
            ? params.memberUserIds.join("|")
            : params.ownerUserId;
        const res = await postForm(`${this.baseUrl}/group/create?access_token=${encodeURIComponent(token)}`, { group_name: params.name, group_owner: params.ownerUserId, group_userids: members });
        const data = (await res.json());
        if (!isOk(data.code) || !data.obj) {
            throw new Error(`[yach-group] createGroup error: ${JSON.stringify(data)}`);
        }
        return data.obj;
    }
    /** 添加群成员（POST /group/users/add） */
    async addMembers(groupId, userIds, opUid) {
        const token = await this.getToken();
        const res = await postForm(`${this.baseUrl}/group/users/add?access_token=${encodeURIComponent(token)}`, { group_tid: groupId, userid_list: JSON.stringify(userIds), op_uid: opUid });
        const data = (await res.json());
        if (!isOk(data.code))
            throw new Error(`[yach-group] addMembers error: ${JSON.stringify(data)}`);
    }
    /** 删除群成员（POST /group/users/del） */
    async removeMembers(groupId, userIds, opUid) {
        const token = await this.getToken();
        const res = await postForm(`${this.baseUrl}/group/users/del?access_token=${encodeURIComponent(token)}`, { group_tid: groupId, userid_list: JSON.stringify(userIds), op_uid: opUid });
        const data = (await res.json());
        if (!isOk(data.code))
            throw new Error(`[yach-group] removeMembers error: ${JSON.stringify(data)}`);
    }
    /** 获取群成员列表（POST /group/users/list） */
    async listMembers(groupId) {
        const token = await this.getToken();
        const res = await postForm(`${this.baseUrl}/group/users/list?access_token=${encodeURIComponent(token)}`, { group_tid: groupId });
        const data = (await res.json());
        if (!isOk(data.code) || !data.obj) {
            throw new Error(`[yach-group] listMembers error: ${JSON.stringify(data)}`);
        }
        return { list: data.obj.list ?? [], total: data.obj.total ?? "0" };
    }
}
//# sourceMappingURL=group.js.map