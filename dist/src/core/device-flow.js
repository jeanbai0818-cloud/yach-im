/**
 * OAuth 2.0 Device Authorization Grant (RFC 8628) — 知音楼实现。
 *
 * 两步流程：
 *   1. requestYachDeviceAuthorization — 获取 device_code + verification_uri
 *   2. pollYachDeviceToken           — 轮询 token 端点直至用户授权或超时
 *
 * 端点：
 *   - 授权码：POST /openapi/v2/auth_device/code
 *   - 换 token / 刷新：POST /openapi/v2/auth/token
 */
import { oapiFetch } from "./fetch.js";
import { getAccessToken } from "./app-token.js";
import { yachLogger } from "./yach-logger.js";
import { reportEvent, reportError } from "./reporter.js";
const log = yachLogger("device-flow");
/** 应用无该权限组权限（code=69300014），平台会自动推无权限卡片 */
export class YachAppScopeError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "YachAppScopeError";
    }
}
export async function sendYachAuthCard(params) {
    const { baseUrl, appKey, appSecret, deviceCode, toUserId, groupTid, conversationType } = params;
    const appToken = await getAccessToken(baseUrl, { appKey, appSecret });
    const body = {
        access_token: appToken,
        auth_code: deviceCode,
        conversation_type: Number(conversationType),
    };
    if (conversationType === "1" && toUserId)
        body.to_userid = toUserId;
    if (conversationType === "2" && groupTid)
        body.group_tid = groupTid;
    const resp = await oapiFetch(`${baseUrl}/openapi/v2/auth/apply/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = (await resp.json());
    const senderId = toUserId;
    if (data.code === 69300014) {
        reportError("oauth.device-flow", "auth card failed: app missing scope", { appKey, senderId });
        throw new YachAppScopeError(`[yach-auth-card] app missing scope permission: code=${data.code} msg=${data.msg}`);
    }
    const ok = data.code === 200 || data.code === 0;
    if (!ok) {
        reportError("oauth.device-flow", "auth card send failed", { appKey, senderId, bizCode: String(data.code) });
        throw new Error(`[yach-auth-card] send failed: code=${data.code} msg=${data.msg}`);
    }
    const status = data.status ?? data.obj?.status;
    if (status === "already_authorized") {
        reportEvent("oauth.device-flow", "auth card: already_authorized", { appKey, senderId });
        return "already_authorized";
    }
    reportEvent("oauth.device-flow", "auth card sent", { appKey, senderId });
    return "card_sent";
}
// ── Step 1: 请求设备授权码 ─────────────────────────────────────────────────
/**
 * 向知音楼 OAuth 服务请求 device_code。
 *
 * POST /openapi/v2/auth_device/code
 * Body: { access_token: appAccessToken, scopes: string[] }
 * Response: { code: 200, obj: { device_code, expires_in, interval } }
 *
 * 注意：知音楼 Device Flow 响应不包含 verification_uri，
 * 调用方（auto-auth.ts）需自行决定如何提示用户完成授权。
 */
export async function requestYachDeviceAuthorization(params) {
    const { appKey, appSecret, baseUrl } = params;
    const appToken = await getAccessToken(baseUrl, { appKey, appSecret });
    const deviceAuthUrl = `${baseUrl}/openapi/v2/auth_device/code`;
    const scopes = params.scopes ?? [];
    const requestBody = { access_token: appToken };
    if (scopes.length > 0)
        requestBody.scopes = scopes.join(",");
    const resp = await oapiFetch(deviceAuthUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });
    const text = await resp.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`Device authorization failed: HTTP ${resp.status} – ${text.slice(0, 200)}`);
    }
    const code = data.code;
    if (code !== 200 || !data.obj) {
        const msg = data.msg ?? `code=${code}`;
        reportError("oauth.device-flow", "device_code request failed", { appKey, scopes: scopes.join(","), bizCode: String(code) });
        throw new Error(`Device authorization failed: ${msg}`);
    }
    const obj = data.obj;
    const expiresIn = obj.expires_in ?? 300;
    const interval = obj.interval ?? 5;
    reportEvent("oauth.device-flow", "device_code obtained", { appKey, scopes: scopes.join(","), expiresIn: String(expiresIn) });
    return {
        deviceCode: obj.device_code,
        verificationUri: "", // 知音楼 Device Flow 不返回 verification_uri
        expiresIn,
        interval,
    };
}
// ── Step 2: 轮询 token 端点 ────────────────────────────────────────────────
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
    });
}
/**
 * 轮询 token 端点直至用户授权、拒绝或 device_code 过期。
 *
 * POST /openapi/v2/auth/token
 * Body: { access_token: appAccessToken, grant_type: "device_code", code: deviceCode }
 * Response: { code: 200, obj: { access_token, expires_in, refresh_token, refresh_token_expires_in, scope } }
 *
 * 通过 AbortSignal 可从外部取消轮询。
 */
export async function pollYachDeviceToken(params) {
    const MAX_POLL_INTERVAL = 60;
    const MAX_POLL_ATTEMPTS = 200;
    const { appKey, appSecret, baseUrl, deviceCode, expiresIn, signal } = params;
    let interval = params.interval;
    const skipInitialSleep = params.skipInitialSleep ?? false;
    const appToken = await getAccessToken(baseUrl, { appKey, appSecret });
    const tokenUrl = `${baseUrl}/openapi/v2/auth/token`;
    const deadline = Date.now() + expiresIn * 1000;
    let attempts = 0;
    while (Date.now() < deadline && attempts < MAX_POLL_ATTEMPTS) {
        attempts++;
        if (signal?.aborted) {
            return { ok: false, error: "cancelled", message: "轮询已取消" };
        }
        if (!(skipInitialSleep && attempts === 1)) {
            await sleep(interval * 1000, signal);
        }
        let data;
        try {
            const pollBody = { access_token: appToken, grant_type: "device_code", "auth_code": deviceCode };
            const resp = await oapiFetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pollBody) }, { ignoreBizCodes: [20064] });
            data = (await resp.json());
        }
        catch (err) {
            log.warn(`poll network error: ${err}`);
            interval = Math.min(interval + 1, MAX_POLL_INTERVAL);
            continue;
        }
        const respCode = data.code;
        const obj = data.obj;
        if (respCode === 200 && obj?.access_token) {
            const refreshToken = obj.refresh_token ?? "";
            const tokenExpiresIn = obj.expires_in ?? 7200;
            let refreshExpiresIn = obj.refresh_token_expires_in ?? 604800;
            if (!refreshToken)
                refreshExpiresIn = tokenExpiresIn;
            return {
                ok: true,
                token: {
                    accessToken: obj.access_token,
                    refreshToken,
                    expiresIn: tokenExpiresIn,
                    refreshExpiresIn,
                    scope: obj.scopes || obj.scope || params.requestedScopes?.join(",") || "",
                },
            };
        }
        // 非 200 视为待授权，继续轮询
    }
    if (attempts >= MAX_POLL_ATTEMPTS) {
        log.warn(`max poll attempts (${MAX_POLL_ATTEMPTS}) reached`);
    }
    return { ok: false, error: "expired_token", message: "授权超时，请重新发起" };
}
//# sourceMappingURL=device-flow.js.map