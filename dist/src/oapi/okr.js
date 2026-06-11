/**
 * YachOkrApi — OKR OAPI（user_access_token）
 *
 * 所有接口需要 user_access_token，token 放 JSON body。
 * 路径：/openapi/v2/okr/*
 */
import { oapiFetch } from "../core/fetch.js";
import { YachApiError } from "./errors.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
// ── 内部辅助 ─────────────────────────────────────────────────────────────────
async function getJson(baseUrl, path, token, params) {
    const qs = new URLSearchParams({ access_token: token });
    for (const [key, value] of Object.entries(params)) {
        qs.set(key, String(value));
    }
    const res = await oapiFetch(`${baseUrl}${path}?${qs.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`[yach-okr] parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    if (!isOk(data.code)) {
        throw new YachApiError(`[yach-okr] ${path} failed: ${JSON.stringify(data)}`, Number(data.code));
    }
    return (data.obj ?? {});
}
async function postJson(baseUrl, path, token, body) {
    const payload = { access_token: token, ...body };
    const res = await oapiFetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`[yach-okr] parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    if (!isOk(data.code)) {
        throw new YachApiError(`[yach-okr] ${path} failed: ${JSON.stringify(data)}`, Number(data.code));
    }
    return (data.obj ?? {});
}
// ── YachOkrApi ─────────────────────────────────────────────────────────────
export class YachOkrApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** OKR详情（GET /openapi/v2/okr/query/detail） */
    async getDetail(params) {
        const token = await this.getToken();
        const queryParams = {};
        if (params.kr_id !== undefined)
            queryParams.kr_id = params.kr_id;
        if (params.current !== undefined)
            queryParams.current = params.current;
        return getJson(this.baseUrl, "/openapi/v2/okr/query/detail", token, queryParams);
    }
    /** OKR列表（POST /openapi/v2/okr/list） */
    async list(params) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/okr/list", token, params);
    }
}
//# sourceMappingURL=okr.js.map