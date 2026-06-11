import { oapiFetch } from "./fetch.js";
const tokenCache = new Map();
export async function getAccessToken(baseUrl, cfg) {
    const key = `${baseUrl}:${cfg.appKey}`;
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
    }
    const url = `${baseUrl}/gettoken?appkey=${encodeURIComponent(cfg.appKey)}&appsecret=${encodeURIComponent(cfg.appSecret)}`;
    const res = await oapiFetch(url);
    if (!res.ok)
        throw new Error(`[yach-oapi] gettoken failed: HTTP ${res.status}`);
    const data = (await res.json());
    if (data.code !== 200 || !data.obj) {
        throw new Error(`[yach-oapi] gettoken error: ${JSON.stringify(data)} appkey=${cfg.appKey} appsecret=${cfg.appSecret}`);
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