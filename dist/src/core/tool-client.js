/**
 * YachToolClient — 工具层统一客户端。
 *
 * 对齐飞书 ToolClient 设计，工具代码通过 invoke({ as: "app" | "user" })
 * 声明鉴权模式，客户端内部处理 token 获取、刷新与重试，工具无需感知底层。
 *
 * 用法：
 * ```ts
 * const client = createYachToolClient(account, senderUserId);
 *
 * // app token 调用（发通知、查公共数据）
 * const result = await client.invoke(
 *   "yach_send_notify",
 *   (c) => c.im.sendMessage({ toId, conversationType: "1", payload }),
 *   { as: "app" },
 * );
 *
 * // user token 调用（代表用户操作，需先 OAuth 授权）
 * // scope 预检：自动比对存储 token 的 scope 字段
 * const result = await client.invoke(
 *   "yach_create_calendar_event",
 *   (c) => c.im.sendMessage({ ... }),
 *   { as: "user" },
 * );
 * ```
 *
 * 与飞书版的主要差异：
 *  - oapi/* 作为自制 SDK，callback 接收 YachClient 实例（已绑定 token）
 *  - 默认 "app"（飞书默认 "user"），与知音楼现阶段以 app token 为主对齐
 */
import { resolveYachAccount, resolveDefaultYachAccountId } from "../accounts/index.js";
import { callWithUserToken, NeedUserAuthorizationError } from "./user-token-client.js";
import { getRequiredScopes } from "./tool-scopes.js";
import { getStoredToken } from "./user-token-store.js";
import { YachClient } from "./yach-client.js";
import { getYachConfig } from "./runtime.js";
import { getYachTicket } from "./yach-ticket.js";
export { NeedUserAuthorizationError };
// ── YachToolClient ────────────────────────────────────────────────────────
export class YachToolClient {
    account;
    senderUserId;
    fixedToken;
    constructor(
    /** 当前账号配置（已 resolved） */
    account, 
    /**
     * 当前请求用户 ID（opaque Yach userId）。
     * user 模式必需；app 模式忽略。
     */
    senderUserId, 
    /**
     * 预供 access token。提供后跳过 token 获取/刷新流程，直接使用该 token。
     * app 和 user 模式均生效。
     */
    fixedToken) {
        this.account = account;
        this.senderUserId = senderUserId;
        this.fixedToken = fixedToken;
    }
    /**
     * 以指定鉴权模式执行 API 调用。
     *
     * `toolAction` 用于查询所需 scope：user 模式下预检存储 token 的 scope，
     * 若不足则抛出 NeedUserAuthorizationError 并携带缺失的 scope 列表。
     * app 模式下 toolAction 仅供记录，不做 scope 检查。
     *
     * callback `fn` 接收 access_token，负责实际的 OAPI 调用。
     * user 模式下自动处理 token refresh + 单次重试。
     *
     * @throws NeedUserAuthorizationError  user 模式下用户未完成 OAuth 授权或 scope 不足
     * @throws Error  账号未配置 appKey/appSecret
     */
    async invoke(toolAction, fn, options) {
        // 优先级：工具显式传参 > 账号配置 toolAuthMode > 默认 "app"
        const mode = options?.as ?? this.account.config.toolAuthMode ?? "app";
        if (!this.account.appKey || !this.account.appSecret) {
            throw new Error("[yach-tool-client] account not configured: missing appKey or appSecret");
        }
        if (mode === "user") {
            return this.invokeAsUser(toolAction, fn);
        }
        return this.invokeAsApp(fn);
    }
    // ── 内部：app token 路径 ──────────────────────────────────────────────
    async invokeAsApp(fn) {
        const base = YachClient.fromAccount(this.account);
        return fn(this.fixedToken ? base.withToken(this.fixedToken) : base);
    }
    // ── 内部：user token 路径 ─────────────────────────────────────────────
    async invokeAsUser(toolAction, fn) {
        if (this.fixedToken) {
            return fn(YachClient.fromAccount(this.account).withToken(this.fixedToken));
        }
        const userId = this.senderUserId;
        if (!userId) {
            throw new NeedUserAuthorizationError("unknown");
        }
        // ── scope 预检 ──────────────────────────────────────────────────────
        const requiredScopes = getRequiredScopes(toolAction);
        if (requiredScopes.length > 0) {
            const stored = await getStoredToken(this.account.appKey, userId);
            const grantedScopes = new Set((stored?.scope ?? "").split(/[\s,]+/).filter(Boolean));
            const missing = requiredScopes.filter((s) => !grantedScopes.has(s));
            if (missing.length > 0) {
                throw new NeedUserAuthorizationError(userId, missing);
            }
        }
        const uatOpts = {
            userId,
            appKey: this.account.appKey,
            appSecret: this.account.appSecret,
            baseUrl: this.account.baseUrl,
        };
        const baseClient = YachClient.fromAccount(this.account);
        // callWithUserToken 内置 refresh + 单次重试，与飞书 callWithUAT 对齐
        try {
            return await callWithUserToken(uatOpts, (token) => fn(baseClient.withToken(token)));
        }
        catch (err) {
            if (err instanceof NeedUserAuthorizationError && requiredScopes.length > 0) {
                const merged = [...new Set([...err.requiredScopes, ...requiredScopes])];
                throw new NeedUserAuthorizationError(err.userId, merged);
            }
            throw err;
        }
    }
}
/**
 * 创建 {@link YachToolClient}。
 *
 * 自动从当前 {@link YachTicket} 解析 accountId 和 senderUserId，
 * 若 ticket 不可用则 fallback 到配置中第一个启用账号。
 * 账号未配置时抛出 Error（而非返回错误 JSON），由 catch 块统一处理。
 *
 * ```ts
 * // 零参数，自动解析上下文
 * const client = createYachToolClient();
 *
 * // 覆盖部分参数
 * const client = createYachToolClient({ accountId: "mybot", accessToken: token });
 * ```
 */
export function createYachToolClient(opts) {
    const cfg = getYachConfig();
    const ticket = getYachTicket();
    const accountId = opts?.accountId ?? ticket?.accountId ?? resolveDefaultYachAccountId(cfg);
    const account = resolveYachAccount({ cfg, accountId });
    if (!account.configured) {
        throw new Error(`Yach account "${accountId}" is not configured (missing appKey or appSecret). ` +
            `Please check channels.yach.accounts.${accountId} in your config.`);
    }
    const senderUserId = opts?.senderUserId ?? ticket?.senderId;
    return new YachToolClient(account, senderUserId, opts?.accessToken);
}
//# sourceMappingURL=tool-client.js.map