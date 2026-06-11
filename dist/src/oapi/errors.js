/**
 * 知音楼 OAPI 错误类。
 *
 * 携带 `.code`（知音楼业务错误码），供 callWithUserToken 的 catch 块
 * 识别需要 reauth 的错误码（REAUTH_REQUIRED_CODES）。
 */
export class YachApiError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = "YachApiError";
        this.code = code;
    }
}
//# sourceMappingURL=errors.js.map