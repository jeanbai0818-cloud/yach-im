/**
 * YachCalendarApi — 日历 OAPI
 *
 * 全部走 user_access_token，token 放 JSON body。
 * 路径：/openapi/v2/schedule/*
 * 时间：Unix 时间戳（秒）
 */
import { oapiFetch } from "../core/fetch.js";
import { YachApiError } from "./errors.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
// ── 内部辅助 ─────────────────────────────────────────────────────────────────
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
        throw new Error(`[yach-calendar] parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    if (!isOk(data.code)) {
        throw new YachApiError(`[yach-calendar] ${path} failed: ${JSON.stringify(data)}`, Number(data.code));
    }
    return (data.obj ?? {});
}
// ── YachCalendarApi ───────────────────────────────────────────────────────────
export class YachCalendarApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 日程列表（POST /openapi/v2/schedule/list） */
    async listSchedules(params) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/schedule/list", token, params);
    }
    /** 日程详情（POST /openapi/v2/schedule/info） */
    async getSchedule(scheduleId) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/schedule/info", token, { schedule_id: scheduleId });
    }
    /** 创建日程（POST /openapi/v2/schedule/create） */
    async createSchedule(params) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/schedule/create", token, params);
    }
    /** 更新日程（POST /openapi/v2/schedule/update） */
    async updateSchedule(params) {
        const token = await this.getToken();
        return postJson(this.baseUrl, "/openapi/v2/schedule/update", token, params);
    }
    /** 取消日程（POST /openapi/v2/schedule/cancel） */
    async cancelSchedule(params) {
        const token = await this.getToken();
        await postJson(this.baseUrl, "/openapi/v2/schedule/cancel", token, params);
    }
}
//# sourceMappingURL=calendar.js.map