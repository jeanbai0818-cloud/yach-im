/**
 * YachRobotApi — 机器人能力 OAPI
 *
 * 使用 app_access_token：
 *   - listRobotGroups: GET /openapi/v2/dify/robot/groups
 */
import { oapiFetch } from "../core/fetch.js";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
function normalizeCode(data) {
    return data.code ?? data.errcode ?? data.result;
}
export class YachRobotApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    async listRobotGroups() {
        const token = await this.getToken();
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/dify/robot/groups`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json());
        const code = Number(data.code ?? data.errcode ?? 0);
        if (!res.ok || !isOk(code)) {
            throw new Error(`[yach-robot] listRobotGroups error: ${JSON.stringify(data)}`);
        }
        const payload = data.data ?? data.obj ?? data.result ?? [];
        if (Array.isArray(payload))
            return payload;
        return payload.groups ?? [];
    }
}
//# sourceMappingURL=robot.js.map