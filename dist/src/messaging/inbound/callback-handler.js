import { getYachRuntime, getYachConfig } from "../../core/runtime.js";
import { oapiFetch } from "../../core/fetch.js";
import { yachLogger } from "../../core/yach-logger.js";
const log = yachLogger("messaging/callback");
function mergePartialAssistantText(previous, payload) {
    const text = typeof payload.text === "string" ? payload.text : "";
    const delta = typeof payload.delta === "string" ? payload.delta : "";
    if (payload.replace) {
        return text;
    }
    if (text && (previous === "" || text.startsWith(previous))) {
        return text;
    }
    if (delta) {
        return previous + delta;
    }
    if (text) {
        return previous + text;
    }
    return null;
}
async function postToCallbackUrl(callbackUrl, data, logger) {
    try {
        const response = await oapiFetch(callbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (response.ok) {
            logger.info("[yach] callback POST succeeded: " + response.status);
        }
        else {
            log.error("[yach] callback POST failed: " + response.status + " " + response.statusText);
        }
    }
    catch (err) {
        log.error("[yach] callback POST error: " + String(err));
    }
}
export async function handleCallbackMessage(params) {
    const { message, account, cfg, logger, senderId, conversationId, isGroup, senderName, toId } = params;
    const core = getYachRuntime();
    const { content = "", callbackUrl, uniqueKey, callbackMode } = message;
    if (!content || !callbackUrl || !uniqueKey) {
        log.error("[yach] callback message missing callback_url, unique_key, or callback_mode");
        return;
    }
    logger.info("[yach] handling callback message, callback_url: " + callbackUrl + ", unique_key: " + uniqueKey + ", mode: " + callbackMode);
    const mode = callbackMode || "full";
    const sendToUser = isGroup ? `group:${conversationId}` : `user:${senderId}`;
    const rawBody = message.content;
    const preview = rawBody.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = isGroup
        ? `Yach[${account.accountId}] callback in group ${conversationId}`
        : `Yach[${account.accountId}] callback DM from ${senderId}`;
    const route = core.channel.routing.resolveAgentRoute({
        cfg: getYachConfig(),
        channel: "yach",
        accountId: account.appKey,
        peer: { kind: isGroup ? "group" : "direct", id: toId },
    });
    core.system.enqueueSystemEvent(`${inboundLabel}: ${preview}`, {
        sessionKey: route.sessionKey,
        contextKey: `yach:callback:${toId}:${message.msgId}`,
    });
    const messageBody = `${senderName}: ${rawBody}`;
    const body = core.channel.reply.formatAgentEnvelope({
        channel: "Yach",
        from: isGroup ? `${conversationId}:${senderId}` : senderId,
        timestamp: new Date(),
        envelope: core.channel.reply.resolveEnvelopeFormatOptions(cfg),
        body: messageBody,
    });
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: body,
        BodyForAgent: rawBody,
        InboundHistory: undefined,
        RawBody: rawBody,
        CommandBody: rawBody,
        CommandAuthorized: true,
        From: senderId,
        To: sendToUser,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        Provider: "yach",
        Surface: "yach",
        ChatType: isGroup ? "group" : "direct",
        GroupSubject: isGroup ? conversationId : undefined,
        SenderName: senderName,
        SenderTag: undefined,
        SenderId: senderId,
        MessageSid: message.msgId,
        Timestamp: Date.now(),
        OriginatingChannel: "yach",
        OriginatingTo: sendToUser,
        OwnerAllowFrom: isGroup ? [] : [senderId],
    });
    let fullReplyText = "";
    let chunkCount = 0;
    const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
        responsePrefix: "",
        responsePrefixContextProvider: () => ({}),
        humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, route.agentId),
        onReplyStart: () => { },
        onIdle: async () => {
            logger.info("[yach] callback reply dispatcher idle");
        },
        onCleanup: () => { },
        deliver: async () => { },
    });
    const buildBasePostData = (replyText, done) => {
        if (mode === "full") {
            return {
                unique_key: uniqueKey,
                content: replyText,
            };
        }
        const row = {
            unique_key: uniqueKey,
            content: replyText,
            done,
            chunk_index: chunkCount,
        };
        return row;
    };
    try {
        await core.channel.reply.withReplyDispatcher({
            dispatcher,
            onSettled: () => {
                markDispatchIdle();
            },
            run: () => core.channel.reply.dispatchReplyFromConfig({
                ctx: ctxPayload,
                cfg: getYachConfig(),
                dispatcher,
                replyOptions: {
                    ...replyOptions,
                    onPartialReply: (payload) => {
                        const next = mergePartialAssistantText(fullReplyText, payload);
                        if (next === null)
                            return;
                        fullReplyText = next;
                        chunkCount++;
                        if (mode === "streaming") {
                            void postToCallbackUrl(callbackUrl, buildBasePostData(fullReplyText, false), logger);
                        }
                    },
                    disableBlockStreaming: true,
                },
            }),
        });
        if (mode === "full") {
            await postToCallbackUrl(callbackUrl, buildBasePostData(fullReplyText, true), logger);
        }
        else {
            await postToCallbackUrl(callbackUrl, buildBasePostData('', true), logger);
        }
    }
    catch (err) {
        log.error("[yach] callback AI dispatch error: " + String(err));
    }
}
//# sourceMappingURL=callback-handler.js.map