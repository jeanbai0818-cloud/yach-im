import { Type } from "@sinclair/typebox";
/** 生成 { type: "string", enum: [...] }，避免 anyOf */
export function StringEnum(values, options) {
    return Type.Unsafe({ type: "string", enum: values, ...options });
}
/** ISO 8601 字符串转 Unix 时间戳（秒整数） */
export function isoToUnix(iso) {
    return Math.floor(new Date(iso).getTime() / 1000);
}
//# sourceMappingURL=helpers.js.map