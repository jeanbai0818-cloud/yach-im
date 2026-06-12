/**
 * UAT (User Access Token) 持久化存储，跨平台实现。
 *
 * 使用 OS 原生凭证服务存储 OAuth token，token 在进程重启后不丢失。
 *
 * 平台实现：
 *   macOS   – Keychain Access via `security` CLI
 *   Linux   – AES-256-GCM 加密文件 (XDG_DATA_HOME)
 *   Windows – AES-256-GCM 加密文件 (%LOCALAPPDATA%)
 *
 * 存储布局：
 *   Service  = "openclaw-yach-uat"
 *   Account  = "{appKey}:{userId}"
 *   Password = JSON-serialised StoredYachUAToken
 */
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, unlink, readFile, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { yachLogger } from "./yach-logger.js";
const log = yachLogger("token-store");
const execFile = promisify(execFileCb);
// ── 常量 ──────────────────────────────────────────────────────────────────
const KEYCHAIN_SERVICE = "openclaw-yach-uat";
/** access_token 提前此时间刷新，避免边界竞争 */
const REFRESH_AHEAD_MS = 5 * 60 * 1000;
// ── 工具函数 ──────────────────────────────────────────────────────────────
function accountKey(appKey, userId) {
    return `${appKey}:${userId}`;
}
/** 日志安全掩码：只显示末 4 位 */
export function maskToken(token) {
    if (token.length <= 8)
        return "****";
    return `****${token.slice(-4)}`;
}
// ── macOS 后端 ────────────────────────────────────────────────────────────
const darwinBackend = {
    async get(service, account) {
        try {
            const { stdout } = await execFile("security", [
                "find-generic-password", "-s", service, "-a", account, "-w",
            ]);
            return stdout.trim() || null;
        }
        catch {
            return null;
        }
    },
    async set(service, account, data) {
        try {
            await execFile("security", ["delete-generic-password", "-s", service, "-a", account]);
        }
        catch { /* 不存在，忽略 */ }
        await execFile("security", ["add-generic-password", "-s", service, "-a", account, "-w", data]);
    },
    async remove(service, account) {
        try {
            await execFile("security", ["delete-generic-password", "-s", service, "-a", account]);
        }
        catch { /* 已不存在 */ }
    },
};
// ── Linux 后端（AES-256-GCM 加密文件）────────────────────────────────────
const LINUX_UAT_DIR = join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "openclaw-yach-uat");
const LINUX_MASTER_KEY_PATH = join(LINUX_UAT_DIR, "master.key");
const MASTER_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
function linuxSafeFileName(account) {
    return account.replace(/[^a-zA-Z0-9._-]/g, "_") + ".enc";
}
async function ensureLinuxCredDir() {
    await mkdir(LINUX_UAT_DIR, { recursive: true, mode: 0o700 });
}
async function getMasterKey() {
    try {
        const key = await readFile(LINUX_MASTER_KEY_PATH);
        if (key.length === MASTER_KEY_BYTES)
            return key;
    }
    catch (err) {
        if (!(err instanceof Error) || err.code !== "ENOENT") {
            log.warn(`failed to read master key: ${err}`);
        }
    }
    await ensureLinuxCredDir();
    const key = randomBytes(MASTER_KEY_BYTES);
    await writeFile(LINUX_MASTER_KEY_PATH, key, { mode: 0o600 });
    await chmod(LINUX_MASTER_KEY_PATH, 0o600);
    return key;
}
function encryptData(plaintext, key) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}
function decryptData(data, key) {
    if (data.length < IV_BYTES + TAG_BYTES)
        return null;
    try {
        const iv = data.subarray(0, IV_BYTES);
        const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
        const enc = data.subarray(IV_BYTES + TAG_BYTES);
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    }
    catch {
        return null;
    }
}
const linuxBackend = {
    async get(_service, account) {
        try {
            const key = await getMasterKey();
            const data = await readFile(join(LINUX_UAT_DIR, linuxSafeFileName(account)));
            return decryptData(data, key);
        }
        catch {
            return null;
        }
    },
    async set(_service, account, data) {
        const key = await getMasterKey();
        await ensureLinuxCredDir();
        const filePath = join(LINUX_UAT_DIR, linuxSafeFileName(account));
        await writeFile(filePath, encryptData(data, key), { mode: 0o600 });
        await chmod(filePath, 0o600);
    },
    async remove(_service, account) {
        try {
            await unlink(join(LINUX_UAT_DIR, linuxSafeFileName(account)));
        }
        catch { /* 已不存在 */ }
    },
};
// ── Windows 后端（AES-256-GCM 加密文件）──────────────────────────────────
// ⚠️ SECURITY NOTE: Windows 无 OS keychain 集成时，master key 与加密令牌
//    存储在同一用户目录下。这仅提供静态混淆而非 OS 级凭据保护。
//    任何能读取该目录的本地进程均可解密令牌。
const WIN32_UAT_DIR = join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? homedir(), "AppData", "Local"), "openclaw-yach-uat");
const WIN32_MASTER_KEY_PATH = join(WIN32_UAT_DIR, "master.key");
function win32SafeFileName(account) {
    return account.replace(/[^a-zA-Z0-9._-]/g, "_") + ".enc";
}
async function ensureWin32CredDir() {
    await mkdir(WIN32_UAT_DIR, { recursive: true });
}
async function getWin32MasterKey() {
    try {
        const key = await readFile(WIN32_MASTER_KEY_PATH);
        if (key.length === MASTER_KEY_BYTES)
            return key;
    }
    catch { /* 生成新 key */ }
    await ensureWin32CredDir();
    const key = randomBytes(MASTER_KEY_BYTES);
    await writeFile(WIN32_MASTER_KEY_PATH, key);
    return key;
}
const win32Backend = {
    async get(_service, account) {
        try {
            const key = await getWin32MasterKey();
            const data = await readFile(join(WIN32_UAT_DIR, win32SafeFileName(account)));
            return decryptData(data, key);
        }
        catch {
            return null;
        }
    },
    async set(_service, account, data) {
        const key = await getWin32MasterKey();
        await ensureWin32CredDir();
        const filePath = join(WIN32_UAT_DIR, win32SafeFileName(account));
        await writeFile(filePath, encryptData(data, key));
    },
    async remove(_service, account) {
        try {
            await unlink(join(WIN32_UAT_DIR, win32SafeFileName(account)));
        }
        catch { /* 已不存在 */ }
    },
};
// ── 平台选择 ──────────────────────────────────────────────────────────────
function createBackend() {
    switch (process.platform) {
        case "darwin": return darwinBackend;
        case "linux": return linuxBackend;
        case "win32": return win32Backend;
        default: return linuxBackend;
    }
}
const backend = createBackend();
// ── 公开 API ──────────────────────────────────────────────────────────────
export async function getStoredToken(appKey, userId) {
    try {
        const json = await backend.get(KEYCHAIN_SERVICE, accountKey(appKey, userId));
        if (!json)
            return null;
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
export async function setStoredToken(token) {
    const key = accountKey(token.appKey, token.userId);
    await backend.set(KEYCHAIN_SERVICE, key, JSON.stringify(token));
}
export async function removeStoredToken(appKey, userId) {
    await backend.remove(KEYCHAIN_SERVICE, accountKey(appKey, userId));
}
/**
 * 判断 token 的新鲜度：
 * - `"valid"`         – access_token 有效（距过期 > 5 分钟）
 * - `"needs_refresh"` – access_token 即将/已过期，但 refresh_token 仍有效
 * - `"expired"`       – 两个 token 均过期，需重新授权
 */
export function tokenStatus(token) {
    const now = Date.now();
    if (now < token.expiresAt - REFRESH_AHEAD_MS)
        return "valid";
    if (now < token.refreshExpiresAt)
        return "needs_refresh";
    return "expired";
}
//# sourceMappingURL=user-token-store.js.map