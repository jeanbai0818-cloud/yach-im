/**
 * YachWeeklyApi — 周报 OAPI（user_access_token）
 *
 * 所有接口需要 user_access_token，token 放 Authorization header。
 * 路径：/openapi/v2/weekly/*
 */
import { oapiFetch } from "../core/fetch.js";
import { YachApiError } from "./errors.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
// ── 内部辅助 ─────────────────────────────────────────────────────────────────
async function postJson(baseUrl, path, token, body) {
    const payload = { ...body };
    const res = await oapiFetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`[yach-weekly] parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    if (!isOk(data.code)) {
        throw new YachApiError(`[yach-weekly] ${path} failed: ${JSON.stringify(data)}`, Number(data.code));
    }
    return (data.obj ?? {});
}
async function getJson(baseUrl, path, token, params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        qs.set(key, String(value));
    }
    const res = await oapiFetch(`${baseUrl}${path}?${qs.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`[yach-weekly] parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    if (!isOk(data.code)) {
        throw new YachApiError(`[yach-weekly] ${path} failed: ${JSON.stringify(data)}`, Number(data.code));
    }
    return (data.obj ?? {});
}
// ── YachWeeklyApi ─────────────────────────────────────────────────────────────
export class YachWeeklyApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 周报列表（POST /openapi/v2/weekly/list） */
    async list(params) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/weekly/list", token, params);
    }
    /** 获取我的周报草稿（GET /openapi/v2/weekly/draft） */
    async getDraft(weeklyType) {
        const token = await this.getToken();
        return getJson(this.baseUrl, "/openapi/v2/weekly/draft", token, { weekly_type: weeklyType });
    }
    /** 保存周报草稿（POST /openapi/v2/weekly/draft/save） */
    async saveDraft(params) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/weekly/draft/save", token, params);
    }
}
//# sourceMappingURL=weekly.js.map