import { oapiFetch } from "./fetch.js";
const tokenCache = new Map();
export async function getAccessToken(baseUrl, cfg) {
    const key = `${baseUrl}:${cfg.appKey}`;
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const res = await oapiFetch(`${baseUrl}/gettoken`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ appkey: cfg.appKey, appsecret: cfg.appSecret }).toString(),
    });
    if (!res.ok)
        throw new Error(`[yach-oapi] gettoken failed: HTTP ${res.status}`);
    const data = (await res.json());
    if (data.code !== 200 || !data.obj) {
        throw new Error(`[yach-oapi] gettoken error: code=${String(data.code)} msg=${String(data.msg ?? "unknown")}`);
    }
    const { access_token, expired_time } = data.obj;
    // 提前 3 分钟过期，避免边界问题
    tokenCache.set(key, {
        token: access_token,
        expiresAt: expired_time * 1000 - 3 * 60 * 1000,
    });
    return access_token;
}
//# sourceMappingURL=app-token.js.map