import { createReplyPrefixContext, createTypingCallbacks, } from "openclaw/plugin-sdk/channel-runtime";
import { yachLogger } from "../../core/yach-logger.js";
import { getYachRuntime } from "../../core/runtime.js";
import { resolveYachAccountByBotId } from "../../accounts/index.js";
import { transformModelTextToFoldLinks } from "../../card/model-fold-links.js";
import { YachStreamingCard } from "../../card/streaming-card.js";
import { YachClient } from "../../core/yach-client.js";
import { yachOutbound } from "./outbound.js";
import { reportEvent } from "../../core/reporter.js";
const log = yachLogger("messaging/outbound");
function resolveTarget(chatId) {
    if (chatId.startsWith("group:")) {
        return { toId: chatId.slice(6), conversationType: "2" };
    }
    return { toId: chatId.startsWith("user:") ? chatId.slice(5) : chatId, conversationType: "1" };
}
export function createYachReplyDispatcher(params) {
    const core = getYachRuntime();
    const { cfg, agentId, chatId, accountId, replyToMessageId, fromUserId } = params;
    const account = resolveYachAccountByBotId({ cfg, botId: accountId });
    const prefixContext = createReplyPrefixContext({ cfg, agentId });
    const client = YachClient.fromAccount(account);
    const textChunkLimit = core.channel.text.resolveTextChunkLimit(cfg, "yach", accountId, { fallbackLimit: 4000 });
    const chunkMode = core.channel.text.resolveChunkMode(cfg, "yach");
    const tableMode = core.channel.text.resolveMarkdownTableMode({ cfg, channel: "yach", accountId });
    const streamingEnabled = (account.config.replyMode ?? "stream") === "stream";
    const { toId, conversationType } = resolveTarget(chatId);
    // ── Typing Indicator ─────────────────────────────────────────────────────
    const typingExpression = account.config.typingExpression ?? "[OC燃了]";
    let expressionActive = false;
    let expressionQueue = Promise.resolve();
    const setExpression = (target) => {
        expressionQueue = expressionQueue.then(async () => {
            if (target === expressionActive)
                return;
            if (!typingExpression || !replyToMessageId || !fromUserId)
                return;
            expressionActive = target;
            await client.expression.toggle({
                sessionId: toId,
                sessionType: conversationType,
                msgId: replyToMessageId,
                expression: typingExpression,
                fromUserId,
            });
        }).catch((err) => {
            expressionActive = !target;
            throw err;
        });
        return expressionQueue;
    };
    const typingCallbacks = createTypingCallbacks({
        start: () => setExpression(true),
        stop: () => setExpression(false),
        onStartError: (err) => log.warn("typing start error", { err: String(err) }),
        onStopError: (err) => log.warn("typing stop error", { err: String(err) }),
    });
    // ── 流式消息卡片 ─────────────────────────────────────────────────────────
    let segmentText = "";
    let lastPartial = "";
    let partialUpdateQueue = Promise.resolve();
    let card = null;
    let cardStartPromise = null;
    let streamingEverStarted = false;
    const computeDelta = (nextText) => {
        if (nextText.startsWith(segmentText)) {
            const delta = nextText.slice(segmentText.length);
            segmentText = nextText;
            return { delta: delta || null, isNewSegment: false };
        }
        if (segmentText.startsWith(nextText)) {
            return { delta: null, isNewSegment: false };
        }
        segmentText = nextText;
        return { delta: nextText || null, isNewSegment: true };
    };
    const queueStreamingUpdate = (nextText, options) => {
        if (!nextText)
            return;
        if (options?.dedupeWithLastPartial && nextText === lastPartial)
            return;
        if (options?.dedupeWithLastPartial)
            lastPartial = nextText;
        const { delta, isNewSegment } = computeDelta(nextText);
        if (!delta)
            return;
        partialUpdateQueue = partialUpdateQueue.then(async () => {
            if (isNewSegment && card?.isActive()) {
                await card.close();
                card = null;
                cardStartPromise = null;
                startStreaming();
            }
            if (cardStartPromise)
                await cardStartPromise;
            if (!card?.isActive())
                return;
            card.push(delta);
        });
    };
    const startStreaming = () => {
        if (!streamingEnabled || card || cardStartPromise)
            return;
        streamingEverStarted = true;
        card = new YachStreamingCard(client);
        cardStartPromise = card.start(toId, conversationType, replyToMessageId ?? undefined);
        cardStartPromise.catch(() => { });
    };
    const closeStreaming = async () => {
        if (cardStartPromise) {
            await cardStartPromise.catch((err) => {
                log.error("stream card start failed", { err: String(err) });
            });
        }
        await partialUpdateQueue;
        await card?.close();
        card = null;
        cardStartPromise = null;
        segmentText = "";
        lastPartial = "";
    };
    const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
        responsePrefix: prefixContext.responsePrefix,
        responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
        humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, agentId),
        onReplyStart: () => {
            void typingCallbacks.onReplyStart();
        },
        onIdle: async () => {
            typingCallbacks.onIdle?.();
            await closeStreaming();
        },
        onCleanup: () => {
            typingCallbacks.onCleanup?.();
        },
        deliver: async (payload, info) => {
            const rawText = payload.text ?? "";
            const text = transformModelTextToFoldLinks(rawText) ?? rawText;
            const mediaUrls = payload.mediaUrls ?? [];
            if (mediaUrls.length > 0) {
                let replyMsgId;
                for (const mediaUrl of mediaUrls) {
                    const result = await yachOutbound.sendMedia?.({
                        cfg,
                        to: chatId,
                        text: "",
                        mediaUrl,
                        accountId,
                    });
                    if (result?.messageId)
                        replyMsgId = result.messageId;
                }
                reportEvent("outbound.reply", "reply sent", { chatId, accountId, agentId, conversationType, msgType: "media", kind: info?.kind ?? "unknown", replyMsgId });
            }
            log.debug("[deliver]", { kind: info?.kind, streamingEverStarted, card: !!card, cardStartPromise: !!cardStartPromise, textLen: text.length });
            if (streamingEverStarted && !card && !cardStartPromise) {
                log.debug("[deliver] skip: streaming already completed before deliver");
                return;
            }
            if (card || (streamingEnabled && text.trim())) {
                const partialWasUsed = streamingEverStarted;
                if (!card)
                    startStreaming();
                if (cardStartPromise)
                    await cardStartPromise;
                log.debug("[deliver]", { partialWasUsed, card: !!card, kind: info?.kind });
                if (info?.kind === "final") {
                    if (!partialWasUsed && text !== "") {
                        log.debug("[deliver] writing text to card (no partials)", { len: text.length });
                        queueStreamingUpdate(text, { dedupeWithLastPartial: true });
                    }
                    const replyMsgId = card?.getCardMsgId() ?? undefined;
                    await closeStreaming();
                    reportEvent("outbound.reply", "reply sent", { chatId, accountId, agentId, conversationType, msgType: "streaming_card", kind: "final", replyMsgId });
                }
                return;
            }
            if (!text.trim())
                return;
            const converted = core.channel.text.convertMarkdownTables(text, tableMode);
            let replyMsgId;
            for (const chunk of core.channel.text.chunkTextWithMode(converted, textChunkLimit, chunkMode)) {
                const mid = await client.im.sendMessage({
                    toId,
                    conversationType,
                    payload: { msgtype: "markdown", markdown: { title: chunk.slice(0, 50), text: chunk } },
                });
                if (mid)
                    replyMsgId = mid;
            }
            reportEvent("outbound.reply", "reply sent", { chatId, accountId, agentId, conversationType, msgType: "markdown", kind: info?.kind ?? "unknown", replyMsgId });
        },
        onError: async (error, info) => {
            log.error("reply failed", { kind: info.kind, err: String(error) });
            await closeStreaming();
        },
    });
    return {
        dispatcher,
        replyOptions: {
            ...replyOptions,
            onModelSelected: prefixContext.onModelSelected,
            disableBlockStreaming: true,
            onPartialReply: streamingEnabled
                ? (payload) => {
                    if (!payload.text)
                        return;
                    if (!card && !cardStartPromise) {
                        startStreaming();
                    }
                    queueStreamingUpdate(payload.text, { dedupeWithLastPartial: true });
                }
                : undefined,
        },
        markDispatchIdle,
    };
}
//# sourceMappingURL=reply-dispatcher.js.map