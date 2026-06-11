/**
 * 知音楼 UAT 相关错误码与错误类。
 *
 * TODO: 填入知音楼 OAPI 的实际错误码。
 * 参考文档：知音楼开放平台 → 错误码列表
 */
// ── 知音楼 OAPI 错误码 ────────────────────────────────────────────────────
export const YACH_ERROR = {
    /** access_token 过期或无效，可尝试刷新后重试 */
    TOKEN_EXPIRED: 401,
    /** access_token / refresh_token 已失效，需重新授权 */
    TOKEN_INVALID: 20069,
    REFRESH_TOKEN_INVALID: 20070,
    /** 用户未授权应用，需重新走 OAuth 流程 */
    USER_NOT_AUTHORIZED: 20064,
    /** 用户已撤销授权或应用无权限，需重新走 OAuth 流程 */
    USER_UNAUTHORIZED: 170012,
    /** 应用未授权（业务接口返回），需重新走 OAuth 流程 */
    APP_UNAUTHORIZED: 170013,
};
/** 遇到后先刷新 access_token，刷新成功则自动重试原请求 */
export const TOKEN_RETRY_CODES = new Set([
    YACH_ERROR.TOKEN_EXPIRED,
]);
/** 遇到后清理本地 token，重新发起 OAuth 授权，授权完成后自动重试原请求 */
export const REAUTH_REQUIRED_CODES = new Set([
    YACH_ERROR.TOKEN_INVALID,
    YACH_ERROR.REFRESH_TOKEN_INVALID,
    YACH_ERROR.USER_NOT_AUTHORIZED,
    YACH_ERROR.USER_UNAUTHORIZED,
    YACH_ERROR.APP_UNAUTHORIZED,
]);
// ── 错误类 ────────────────────────────────────────────────────────────────
/**
 * 用户尚未授权（或 token scope 不足），需要走 OAuth 流程。
 *
 * `requiredScopes` 会透传给 `yach_oauth authorize --scope`，
 * 告知授权工具本次需要申请哪些权限。
 */
export class NeedUserAuthorizationError extends Error {
    userId;
    /** 触发此错误所需的 scope 列表（OAuth 授权时使用） */
    requiredScopes;
    constructor(userId, requiredScopes = []) {
        super("need_user_authorization");
        this.name = "NeedUserAuthorizationError";
        this.userId = userId;
        this.requiredScopes = requiredScopes;
    }
}
//# sourceMappingURL=user-token-errors.js.map