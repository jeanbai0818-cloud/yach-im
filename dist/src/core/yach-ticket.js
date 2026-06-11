/**
 * 请求级 Ticket — 通过 AsyncLocalStorage 传播消息上下文。
 *
 * 在消息入口（handler.ts）调用 withYachTicket()，
 * 工具层通过 getYachTicket() 随时获取当前请求的 senderId、toId、accountId 等。
 *
 * 用于：
 *   - auto-auth：知道向谁发送授权 URL，知道授权完成后向哪里发合成消息
 *   - 工具层：无需显式传参即可感知当前对话上下文
 */
import { AsyncLocalStorage } from "node:async_hooks";
// ── AsyncLocalStorage ─────────────────────────────────────────────────────
const store = new AsyncLocalStorage();
// ── 公开 API ──────────────────────────────────────────────────────────────
/**
 * 在 ticket 上下文中运行 fn。
 * fn 内所有异步操作均继承此上下文，可通过 getYachTicket() 访问。
 */
export function withYachTicket(ticket, fn) {
    return store.run(ticket, fn);
}
/** 获取当前 ticket，若不在 withYachTicket() 内则返回 undefined。 */
export function getYachTicket() {
    return store.getStore();
}
/** 当前 ticket 创建至今的毫秒数，不在上下文中返回 0。 */
export function ticketElapsed() {
    const t = store.getStore();
    return t ? Date.now() - t.startTime : 0;
}
//# sourceMappingURL=yach-ticket.js.map