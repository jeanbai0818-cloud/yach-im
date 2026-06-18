/**
 * 统一 OAPI fetch 封装：注入公共 header、记录脱敏请求/响应日志、上报业务错误。
 *
 * 所有 OAPI 调用必须经过此函数，不要直接使用 fetch。
 * - 请求体中的 token/secret/password 字段被 [REDACTED]，长文本字段记录字节数而非内容
 * - 非 JSON/form 响应体（如二进制、HTML）不记录，统一替换为 [non-text body]
 * - 错误时通过 reportError 上报脱敏摘要，不含原始业务内容
 */
import { yachLogger } from "./yach-logger.js";
import { configManager } from "./config.js";
import { reportError } from "./reporter.js";
const log = yachLogger("oapi/fetch");
// 敏感 key：值整体替换为 [REDACTED]
const REDACTED_KEYS = new Set(["access_token", "user_access_token", "app_token", "refresh_token", "token", "secret", "password"]);
// 内容 key：只保留字符数，不记录内容
const CONTENT_KEYS = new Set(["message", "content", "text", "body"]);
function sanitizeFormBody(body) {
    try {
        const params = new URLSearchParams(body);
        const parts = [];
        for (const [key, value] of params) {
            const lk = key.toLowerCase();
            if (REDACTED_KEYS.has(lk) || lk.endsWith("_token") || lk.endsWith("_secret")) {
                parts.push(`${key}=[REDACTED]`);
            }
            else if (CONTENT_KEYS.has(lk)) {
                parts.push(`${key}=[${value.length}chars]`);
            }
            else {
                parts.push(`${key}=${value.slice(0, 100)}`);
            }
        }
        return parts.join("&");
    }
    catch {
        return "[parse-error]";
    }
}
function sanitizeJsonBody(body) {
    try {
        const obj = JSON.parse(body);
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const lk = key.toLowerCase();
            if (REDACTED_KEYS.has(lk) || lk.includes("token") || lk.includes("secret") || lk.includes("password")) {
                result[key] = "[REDACTED]";
            }
            else if (typeof value === "string" && value.length > 200) {
                result[key] = `[${value.length}chars]`;
            }
            else {
                result[key] = value;
            }
        }
        return JSON.stringify(result).slice(0, 500);
    }
    catch {
        return body.slice(0, 200);
    }
}
function sanitizeBody(body, contentType) {
    if (!body)
        return undefined;
    const ct = contentType ?? "";
    if (ct.includes("application/x-www-form-urlencoded"))
        return sanitizeFormBody(body);
    if (ct.includes("application/json"))
        return sanitizeJsonBody(body);
    // Unknown content types may contain PII or binary data — don't log them.
    return "[non-text body]";
}
function sanitizeResponseBody(body, contentType) {
    if (!body)
        return "";
    const ct = (contentType ?? "").toLowerCase();
    if (ct.includes("application/json"))
        return sanitizeJsonBody(body);
    if (ct.includes("application/x-www-form-urlencoded"))
        return sanitizeFormBody(body);
    // Unknown/binary response types (HTML, octet-stream, etc.) are not logged.
    return "[non-text body]";
}
/** 解析业务错误码：Yach 接口约定 code=0 或 code=200 为成功，其他为业务错误。 */
function parseBusinessError(text) {
    try {
        const json = JSON.parse(text);
        const code = json.code ?? json.errcode;
        if (code === undefined || code === 0 || code === 200)
            return null;
        return { bizCode: code, bizMsg: json.msg ?? json.message ?? "" };
    }
    catch {
        return null;
    }
}
function getContentType(headers) {
    if (!headers)
        return undefined;
    if (headers instanceof Headers)
        return headers.get("content-type") ?? undefined;
    if (Array.isArray(headers)) {
        const entry = headers.find(([k]) => k.toLowerCase() === "content-type");
        return entry?.[1];
    }
    const rec = headers;
    return rec["Content-Type"] ?? rec["content-type"];
}
export async function oapiFetch(url, init, options) {
    const method = init?.method ?? "GET";
    const reqBody = typeof init?.body === "string" ? init.body.slice(0, 1_000_000) : undefined;
    const versionArea = configManager.getVersionArea();
    const contentType = getContentType(init?.headers);
    const rawQuery = url.includes("?") ? url.slice(url.indexOf("?") + 1) : undefined;
    const queryString = rawQuery ? sanitizeFormBody(rawQuery) : undefined;
    log.debug(`${method} ${url.split("?")[0]} versionArea: ${versionArea}`, (reqBody || queryString) ? {
        body: sanitizeBody(reqBody, contentType) ?? queryString,
    } : undefined);
    const res = await fetch(url, {
        ...init,
        headers: {
            "yach-version-area": versionArea,
            ...init?.headers,
        },
    });
    const text = await res.clone().text();
    const safeResBody = sanitizeResponseBody(text, res.headers.get("content-type") ?? undefined);
    log.debug(`${method} ${url.split("?")[0]} → ${res.status}`, { body: safeResBody });
    const bizErr = parseBusinessError(text);
    const bizIgnored = bizErr && options?.ignoreBizCodes?.includes(bizErr.bizCode);
    if (!res.ok || (bizErr && !bizIgnored)) {
        const apiPath = url.split("?")[0];
        reportError("oapi/fetch", `HTTP ${res.status} ${method} ${apiPath}`, {
            status: String(res.status),
            method,
            apiPath,
            bizCode: bizErr ? String(bizErr.bizCode) : undefined,
            reqBody: sanitizeBody(reqBody, contentType) ?? queryString,
            resBody: safeResBody,
        });
    }
    return res;
}
//# sourceMappingURL=fetch.js.map