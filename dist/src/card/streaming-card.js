/** 卡片轮换阈值：9 分钟（留 1 分钟安全余量） */
const CARD_ROTATE_MS = 9 * 60 * 1000;
export class YachStreamingCard {
    client;
    msgId = null;
    queue = Promise.resolve();
    closed = false;
    pendingContent = "";
    flushTimer = null;
    throttleMs = 100; // 限流：最多 10 次/秒
    toId = null;
    sessionType = null;
    replyToMessageId;
    createdAt = 0;
    constructor(client) {
        this.client = client;
    }
    async start(toId, sessionType, replyToMessageId) {
        if (this.msgId)
            return;
        this.toId = toId;
        this.sessionType = sessionType;
        this.replyToMessageId = replyToMessageId;
        try {
            this.msgId = await this.client.stream.createCard(toId, sessionType, replyToMessageId);
            this.createdAt = Date.now();
        }
        catch (err) {
            // start 失败不向上抛，card 保持未激活状态，后续 push/close 是 no-op
        }
    }
    push(content) {
        if (!this.msgId || this.closed || !content)
            return;
        this.pendingContent += content;
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.flushTimer = null;
                if (!this.pendingContent || this.closed)
                    return;
                const toSend = this.pendingContent;
                this.pendingContent = "";
                this.queue = this.queue.then(() => this.doPush(toSend));
            }, this.throttleMs);
        }
    }
    async close(finalContent) {
        if (!this.msgId || this.closed)
            return;
        this.closed = true;
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        await this.queue;
        const remaining = this.pendingContent + (finalContent ?? "");
        this.pendingContent = "";
        if (remaining)
            await this.doPush(remaining);
        await this.client.stream.close(this.msgId).catch(() => { });
    }
    isActive() {
        return this.msgId !== null && !this.closed;
    }
    getCardMsgId() {
        return this.msgId;
    }
    async rotate() {
        if (!this.toId || !this.sessionType)
            return;
        try {
            if (this.msgId)
                await this.client.stream.close(this.msgId).catch(() => { });
            this.msgId = await this.client.stream.createCard(this.toId, this.sessionType, this.replyToMessageId);
            this.createdAt = Date.now();
        }
        catch {
            // rotate 失败继续用旧卡片推送
        }
    }
    async doPush(content) {
        if (!this.msgId || !content)
            return;
        if (this.createdAt && Date.now() - this.createdAt > CARD_ROTATE_MS) {
            await this.rotate();
        }
        try {
            await this.client.stream.push(this.msgId, content);
        }
        catch {
            // push 失败静默，不中断队列
        }
    }
}
//# sourceMappingURL=streaming-card.js.map