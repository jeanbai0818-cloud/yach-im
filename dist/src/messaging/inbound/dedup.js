/**
 * FIFO-based message deduplication.
 *
 * Channel SDK 断线重连后可能重发消息，此模块追踪近期处理过的消息 ID，
 * 过滤重复投递。
 */
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 小时
const DEFAULT_MAX_ENTRIES = 5_000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟
// ---------------------------------------------------------------------------
// 消息过期检查（P1）
// ---------------------------------------------------------------------------
const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 分钟
/**
 * 检查消息是否已过期（太旧不再处理）。
 * Yach `createAt` 是毫秒级 Unix 时间戳字符串。
 */
export function isMessageExpired(createAt, expiryMs = DEFAULT_EXPIRY_MS) {
    if (!createAt)
        return false;
    const createTime = parseInt(createAt, 10);
    if (Number.isNaN(createTime))
        return false;
    return Date.now() - createTime > expiryMs;
}
// ---------------------------------------------------------------------------
// 消息去重（P0）
// ---------------------------------------------------------------------------
export class MessageDedup {
    store = new Map(); // key → insertedAt (ms)
    ttlMs;
    maxEntries;
    sweepTimer;
    constructor(opts = {}) {
        this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
        this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
        this.sweepTimer.unref();
    }
    tryRecord(id, scope) {
        const key = scope ? `${scope}:${id}` : id;
        const now = Date.now();
        const existing = this.store.get(key);
        if (existing !== undefined) {
            if (now - existing < this.ttlMs)
                return false;
            this.store.delete(key);
        }
        if (this.store.size >= this.maxEntries) {
            const oldest = this.store.keys().next().value;
            if (oldest !== undefined)
                this.store.delete(oldest);
        }
        this.store.set(key, now);
        return true;
    }
    get size() { return this.store.size; }
    clear() { this.store.clear(); }
    sweep() {
        const now = Date.now();
        for (const [key, ts] of this.store) {
            if (now - ts < this.ttlMs)
                break;
            this.store.delete(key);
        }
    }
}
// ---------------------------------------------------------------------------
// 单例管理（按 accountId 隔离）
// ---------------------------------------------------------------------------
const dedups = new Map();
export function getMessageDedup(accountId) {
    let d = dedups.get(accountId);
    if (!d) {
        d = new MessageDedup();
        dedups.set(accountId, d);
    }
    return d;
}
//# sourceMappingURL=dedup.js.map