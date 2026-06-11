/**
 * YachContactsApi — 通讯录 OAPI
 *
 * 使用 user_access_token（Authorization: Bearer header）。
 */
import { oapiFetch } from "../core/fetch.js";
import { YachApiError } from "./errors.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
// ── YachContactsApi ───────────────────────────────────────────────────────────
export class YachContactsApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 按 userId 获取用户详情（GET /user/get?userid=） */
    async getUserById(userId) {
        const token = await this.getToken();
        const url = `${this.baseUrl}/user/get?userid=${encodeURIComponent(userId)}`;
        const res = await oapiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`[yach-contacts] getUserById parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
        }
        if (!isOk(data.code) || !data.obj) {
            throw new YachApiError(`[yach-contacts] getUserById error: ${JSON.stringify(data)}`, data.code);
        }
        return data.obj;
    }
    /** 按关键字搜索用户（POST /openapi/v2/user/search） */
    async searchUsers(keyword) {
        const token = await this.getToken();
        const url = `${this.baseUrl}/openapi/v2/user/search`;
        const body = JSON.stringify({ keyword });
        const res = await oapiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body,
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`[yach-contacts] searchUsers parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
        }
        if (!isOk(data.code)) {
            throw new YachApiError(`[yach-contacts] searchUsers error: ${JSON.stringify(data)}`, data.code);
        }
        return (data.obj ?? []).map((u) => ({
            userId: u.userid,
            workCode: u.work_code,
            name: u.name,
            nameEn: u.name_en,
        }));
    }
    /** 按工号获取用户详情（GET /user/get_by_workcode?work_code=） */
    async getUserByWorkCode(workCode) {
        const token = await this.getToken();
        const url = `${this.baseUrl}/user/get_by_workcode?work_code=${encodeURIComponent(workCode)}`;
        const res = await oapiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`[yach-contacts] getUserByWorkCode parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
        }
        if (!isOk(data.code) || !data.obj) {
            throw new YachApiError(`[yach-contacts] getUserByWorkCode error: ${JSON.stringify(data)}`, data.code);
        }
        return data.obj;
    }
}
//# sourceMappingURL=contacts.js.map