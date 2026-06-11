/**
 * Per-chat 串行任务队列（P0）。
 *
 * 确保同一 account+chat 的消息串行处理，避免并发竞争、响应乱序。
 * Abort 类消息跳过队列直接执行（让其能立即打断正在运行的任务）。
 */
const chatQueues = new Map();
export function buildQueueKey(accountId, chatId) {
    return `${accountId}:${chatId}`;
}
export function enqueueChatTask(params) {
    const { accountId, chatId, task } = params;
    const key = buildQueueKey(accountId, chatId);
    const prev = chatQueues.get(key) ?? Promise.resolve();
    const status = chatQueues.has(key) ? "queued" : "immediate";
    const next = prev.then(task, task);
    chatQueues.set(key, next);
    const cleanup = () => {
        if (chatQueues.get(key) === next)
            chatQueues.delete(key);
    };
    next.then(cleanup, cleanup);
    return { status, promise: next };
}
export function hasActiveChatTask(accountId, chatId) {
    return chatQueues.has(buildQueueKey(accountId, chatId));
}
//# sourceMappingURL=chat-queue.js.map