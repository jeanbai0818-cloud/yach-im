import { createDecipheriv } from "node:crypto";
/**
 * 用 AES-128-ECB 解密知音楼加密字段（senderId / conversationId / msgId 等）
 * 密钥不足 16 字节时右填 \x00
 */
export function aesDecrypt(encBase64, appKey) {
    // 构造 16 字节 key（右填充 \x00）
    const keyBuf = Buffer.alloc(16, 0);
    Buffer.from(appKey, "utf-8").copy(keyBuf, 0, 0, Math.min(appKey.length, 16));
    const encBuf = Buffer.from(encBase64, "base64");
    // AES-128-ECB，关闭自动 padding 后手动 PKCS7 unpad
    const decipher = createDecipheriv("aes-128-ecb", keyBuf, null);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(encBuf), decipher.final()]);
    // PKCS7 unpad
    const padLen = decrypted[decrypted.length - 1];
    return decrypted.slice(0, decrypted.length - padLen).toString("utf-8");
}
//# sourceMappingURL=aes.js.map