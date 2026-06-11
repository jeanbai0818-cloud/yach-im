/**
 * UAT (User Access Token) 高层客户端。
 *
 * 提供：
 *   - getValidUserToken   – 获取有效 access_token（自动刷新）
 *   - callWithUserToken   – 以用户 token 执行 API 调用，遇过期自动重试
 *   - revokeUserToken     – 撤销（删除）指定用户的 token
 *
 * Token 存储在 OS Keychain / 加密文件中，不暴露给 AI 层。
 *
 */
import { getStoredToken, setStoredToken, removeStoredToken, tokenStatus, } from "./user-token-store.js";
import { NeedUserAuthorizationError, TOKEN_RETRY_CODES, REAUTH_REQUIRED_CODES, } from "./user-token-errors.js";
import { oapiFetch } from "./fetch.js";
import { getAccessToken } from "./app-token.js";
import { yachLogger } from "./yach-logger.js";
const log = yachLogger("uat");
export { NeedUserAuthorizationError };
// ── scope 合并 ────────────────────────────────────────────────────────────
function mergeScopes(a, b) {
    const all = [...(a ?? "").split(/[\s,]+/), ...(b ?? "").split(/[\s,]+/)].filter(Boolean);
    return [...new Set(all)].join(",");
}
// ── Per-user 刷新锁 ───────────────────────────────────────────────────────
/**
 * 防止同一用户并发触发 refresh。
 * refresh_token 是一次性的：并发刷新中第二个请求会用到已消费的 token 而失败。
 */
const refreshLocks = new Map();
// ── 刷新实现 ──────────────────────────────────────────────────────────────
async function doRefreshToken(opts, stored) {
    if (Date.now() >= stored.refreshExpiresAt) {
        await removeStoredToken(opts.appKey, opts.userId);
        return null;
    }
    // POST /openapi/v2/auth/token
    // Body: { access_token: appAccessToken, grant_type: "refresh_token", refresh_token }
    const appToken = await getAccessToken(opts.baseUrl, { appKey: opts.appKey, appSecret: opts.appSecret });
    const tokenUrl = `${opts.baseUrl}/openapi/v2/auth/token`;
    const res = await oapiFetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            access_token: appToken,
            grant_type: "refresh_token",
            refresh_token: stored.refreshToken,
        }),
    });
    const raw = (await res.json());
    const code = raw.code;
    const obj = raw.obj;
    if (code !== 200 || !obj?.access_token) {
        if (REAUTH_REQUIRED_CODES.has(code)) {
            log.warn(`refresh failed (code=${code}), clearing token for ${opts.userId}`);
            await removeStoredToken(opts.appKey, opts.userId);
            return null;
        }
        throw new Error(`[yach-uat] token refresh failed (code=${code} msg=${raw.msg ?? ""})`);
    }
    const now = Date.now();
    const updated = {
        userId: stored.userId,
        appKey: opts.appKey,
        accessToken: obj.access_token,
        refreshToken: obj.refresh_token ?? stored.refreshToken,
        expiresAt: now + (obj.expires_in ?? 7200) * 1000,
        refreshExpiresAt: obj.refresh_token_expires_in
            ? now + obj.refresh_token_expires_in * 1000
            : stored.refreshExpiresAt,
        scope: mergeScopes(stored.scope, obj.scope),
        grantedAt: stored.grantedAt,
    };
    await setStoredToken(updated);
    return updated;
}
async function refreshWithLock(opts, stored) {
    const key = `${opts.appKey}:${opts.userId}`;
    const existing = refreshLocks.get(key);
    if (existing) {
        await existing;
        return getStoredToken(opts.appKey, opts.userId);
    }
    const promise = doRefreshToken(opts, stored);
    refreshLocks.set(key, promise);
    try {
        return await promise;
    }
    finally {
        refreshLocks.delete(key);
    }
}
// ── 公开 API ──────────────────────────────────────────────────────────────
/**
 * 获取指定用户的有效 access_token。
 * - 从 Keychain 读取
 * - 即将过期时自动刷新
 * - 无 token 或刷新失败时抛出 NeedUserAuthorizationError
 *
 * **返回的 token 绝不能暴露给 AI 层。**
 */
export async function getValidUserToken(opts) {
    const stored = await getStoredToken(opts.appKey, opts.userId);
    if (!stored) {
        throw new NeedUserAuthorizationError(opts.userId);
    }
    const status = tokenStatus(stored);
    if (status === "valid") {
        const ttl = Math.round((stored.expiresAt - Date.now()) / 1000);
        log.debug(`token cache hit for ${opts.userId} (${opts.appKey}), expires in ${ttl}s`);
        return stored.accessToken;
    }
    if (status === "needs_refresh") {
        const refreshTtl = Math.round((stored.refreshExpiresAt - Date.now()) / 1000);
        log.debug(`token needs refresh for ${opts.userId} (${opts.appKey}), refresh_token expires in ${refreshTtl}s`);
        const refreshed = await refreshWithLock(opts, stored);
        if (!refreshed)
            throw new NeedUserAuthorizationError(opts.userId);
        return refreshed.accessToken;
    }
    // expired
    await removeStoredToken(opts.appKey, opts.userId);
    throw new NeedUserAuthorizationError(opts.userId);
}
/**
 * 以用户 token 执行 API 调用，遇到 token 过期错误自动刷新重试一次。
 */
export async function callWithUserToken(opts, apiCall) {
    const accessToken = await getValidUserToken(opts);
    try {
        return await apiCall(accessToken);
    }
    catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = err?.code ?? err?.data?.code;
        if (REAUTH_REQUIRED_CODES.has(code)) {
            log.warn(`API call failed (code=${code}), clearing token and requiring re-authorization for ${opts.userId}`);
            await removeStoredToken(opts.appKey, opts.userId);
            throw new NeedUserAuthorizationError(opts.userId);
        }
        if (TOKEN_RETRY_CODES.has(code)) {
            log.warn(`API call failed (code=${code}), refreshing and retrying`);
            const stored = await getStoredToken(opts.appKey, opts.userId);
            if (!stored)
                throw new NeedUserAuthorizationError(opts.userId);
            const refreshed = await refreshWithLock(opts, stored);
            if (!refreshed)
                throw new NeedUserAuthorizationError(opts.userId);
            return await apiCall(refreshed.accessToken);
        }
        throw err;
    }
}
/**
 * 撤销用户 token（从 Keychain 删除）。
 */
export async function revokeUserToken(appKey, userId) {
    await removeStoredToken(appKey, userId);
}
/**
 * 查询用户授权状态（供工具层展示，不暴露实际 token）。
 */
export async function getUserTokenStatus(appKey, userId) {
    const stored = await getStoredToken(appKey, userId);
    if (!stored)
        return { authorized: false, userId };
    return {
        authorized: true,
        userId,
        scope: stored.scope,
        expiresAt: stored.expiresAt,
        refreshExpiresAt: stored.refreshExpiresAt,
        grantedAt: stored.grantedAt,
        tokenStatus: tokenStatus(stored),
    };
}
//# sourceMappingURL=user-token-client.js.map