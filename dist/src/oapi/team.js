/**
 * YachTeamApi — 用户团队（伙伴） OAPI（user_access_token）
 *
 * 所有接口需要 user_access_token，token 放 Authorization header。
 * 路径：/openapi/v2/user/team/*
 */
import { oapiFetch } from "../core/fetch.js";
import { YachApiError } from "./errors.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
// ── YachTeamApi ────────────────────────────────────────────────────────────
export class YachTeamApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 用户团队列表（GET /openapi/v2/user/team/list） */
    async list() {
        const token = await this.getToken();
        const url = `${this.baseUrl}/openapi/v2/user/team/list`;
        const res = await oapiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`[yach-team] list parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
        }
        if (!isOk(data.code) || !data.obj) {
            throw new YachApiError(`[yach-team] list error: ${JSON.stringify(data)}`, data.code);
        }
        return data.obj;
    }
}
//# sourceMappingURL=team.js.map