/**
 * YachMeetingApi — 会议 OAPI（user_access_token）
 *
 * 所有接口需要 user_access_token，token 放 Query 参数。
 * 路径：/openapi/v2/meeting/*
 */
import { oapiFetch } from "../core/fetch.js";
import { YachApiError } from "./errors.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
// ── YachMeetingApi ────────────────────────────────────────────────────────────
export class YachMeetingApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 会议录制&速记文本导出（POST /openapi/v2/meeting/tencent/record/text） */
    async getRecordText(params) {
        const token = await this.getToken();
        const qs = new URLSearchParams({ access_token: token });
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/meeting/tencent/record/text?${qs.toString()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: params.url }),
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`[yach-meeting] parse error: HTTP ${res.status} – ${text.slice(0, 200)}`);
        }
        if (!isOk(data.code)) {
            throw new YachApiError(`[yach-meeting] record text failed: ${JSON.stringify(data)}`, Number(data.code));
        }
        return (data.obj ?? {});
    }
}
//# sourceMappingURL=meeting.js.map