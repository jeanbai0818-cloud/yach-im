import { buildAgentMediaPayload } from "openclaw/plugin-sdk/media-runtime";
import { resolveSenderCommandAuthorization } from "openclaw/plugin-sdk/command-auth";
import { isNormalizedSenderAllowed } from "openclaw/plugin-sdk/allow-from";
import { yachLogger } from "../../core/yach-logger.js";
import { reportEvent } from "../../core/reporter.js";
import { getAccountBotCfg } from "../../accounts/index.js";
import { maybeCreateDynamicAgent } from "../../channel/dynamic-agent.js";
import { createYachReplyDispatcher } from "../outbound/reply-dispatcher.js";
import { getYachRuntime, getYachConfig } from "../../core/runtime.js";
import { resolveMessageBody, stripBotMention, parseHistoryChatRecord, resolveHistoryEntryBody } from "./parse.js";
import { resolveYachMediaList } from "./media.js";
const log = yachLogger("messaging/inbound");
export async function processMessage(params) {
    const { ctx, account, cfg } = params;
    const { senderId, conversationId, msgId, senderName, senderTag, conversationType, isGroup, chatId, toId, message } = ctx;
    const botCfg = getAccountBotCfg(account);
    const core = getYachRuntime();
    let effectiveCfg = getYachConfig();
    let route = core.channel.routing.resolveAgentRoute({
        cfg: effectiveCfg,
        channel: "yach",
        accountId: account.appKey,
        peer: { kind: isGroup ? "group" : "direct", id: toId },
    });
    if (route.matchedBy === "default") {
        const dynamicCfg = account.config.dynamicAgentCreation;
        if (dynamicCfg?.enabled) {
            const peerKind = isGroup ? "group" : "direct";
            const result = await maybeCreateDynamicAgent({
                cfg: effectiveCfg,
                accountId: account.appKey,
                peerId: toId,
                peerKind,
                dynamicCfg,
                log: (msg) => log.info(msg),
            });
            if (result.created) {
                effectiveCfg = result.updatedCfg;
                route = core.channel.routing.resolveAgentRoute({
                    cfg: effectiveCfg,
                    channel: "yach",
                    accountId: account.appKey,
                    peer: { kind: peerKind, id: toId },
                });
            }
        }
    }
    log.info("dispatching to agent", { accountId: account.accountId, session: route.sessionKey });
    reportEvent("inbound.dispatch", "dispatching to agent", {
        accountId: account.accountId,
        source: "inbound",
        action: "dispatch.start",
        result: "accepted",
        msgType: message.msgtype,
    });
    const rawBody = isGroup
        ? stripBotMention(resolveMessageBody(message), message.chatbotUserName)
        : resolveMessageBody(message);
    const preview = rawBody.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = isGroup
        ? `Yach[${account.accountId}] message in group ${conversationId}`
        : `Yach[${account.accountId}] DM from ${senderId}`;
    core.system.enqueueSystemEvent(`${inboundLabel}: ${preview}`, {
        sessionKey: route.sessionKey,
        contextKey: `yach:message:${toId}:${msgId}`,
    });
    let messageBody = rawBody;
    if (message.replyMsgId) {
        messageBody = `[Replying to: ${message.replyContent}]\n\n${rawBody}`;
    }
    messageBody = `${senderName}: ${messageBody}`;
    const yachAccountCfg = account.config;
    const inboundHistory = (() => {
        if (!yachAccountCfg.chatHistoryEnabled)
            return undefined;
        const history = parseHistoryChatRecord(message.historyChatRecord);
        const limit = yachAccountCfg.chatHistoryLimit ?? 20;
        log.info("chatHistory", { parsed: history.length, limit });
        if (!history.length)
            return undefined;
        return history.slice(-limit).map((r) => ({
            sender: r.senderName,
            body: resolveHistoryEntryBody(r),
            timestamp: r.time,
        }));
    })();
    const fromUser = senderId;
    const sendToUser = isGroup ? `group:${conversationId}` : `user:${senderId}`;
    const mediaList = await resolveYachMediaList({ message, core, appKey: botCfg.appKey, log: (msg) => log.info(msg) });
    const mediaPayload = buildAgentMediaPayload(mediaList);
    const yachCfg = account.config;
    const dmPolicy = yachCfg.dmPolicy ?? "open";
    const configuredAllowFrom = [
        ...(yachCfg.allowFrom ?? []).map(String),
        ...(!isGroup && dmPolicy === "open" ? [senderId] : []),
    ];
    const configuredGroupAllowFrom = (() => {
        if (!isGroup)
            return undefined;
        const combined = (yachCfg.commandAllowFrom ?? []).map(String);
        if (combined.length > 0)
            return combined;
        return yachCfg.groupPolicy === "open" ? ["*"] : [];
    })();
    const { commandAuthorized } = await resolveSenderCommandAuthorization({
        cfg,
        rawBody,
        isGroup,
        dmPolicy,
        configuredAllowFrom,
        configuredGroupAllowFrom,
        senderId,
        isSenderAllowed: (id, allowFrom) => isNormalizedSenderAllowed({ senderId: id, allowFrom }),
        readAllowFromStore: () => core.channel.pairing
            .readAllowFromStore({ channel: "yach", accountId: account.accountId })
            .catch(() => []),
        shouldComputeCommandAuthorized: core.channel.commands.shouldComputeCommandAuthorized,
        resolveCommandAuthorizedFromAuthorizers: core.channel.commands.resolveCommandAuthorizedFromAuthorizers,
    });
    if (commandAuthorized === false) {
        log.info("command blocked for unauthorized sender", { accountId: account.accountId });
        return;
    }
    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const envelopeFrom = isGroup ? `${conversationId}:${senderId}` : senderId;
    const body = core.channel.reply.formatAgentEnvelope({
        channel: "Yach",
        from: envelopeFrom,
        timestamp: new Date(),
        envelope: envelopeOptions,
        body: messageBody,
    });
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: body,
        BodyForAgent: rawBody,
        InboundHistory: inboundHistory,
        RawBody: rawBody,
        CommandBody: rawBody,
        CommandAuthorized: commandAuthorized,
        From: fromUser,
        To: sendToUser,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        Provider: "yach",
        Surface: "yach",
        ChatType: isGroup ? "group" : "direct",
        GroupSubject: isGroup ? conversationId : undefined,
        SenderName: senderName || senderId,
        SenderTag: senderTag,
        SenderId: senderId,
        MessageSid: msgId,
        ReplyToBody: message.replyContent ?? undefined,
        Timestamp: Date.now(),
        OriginatingChannel: "yach",
        OriginatingTo: sendToUser,
        OwnerAllowFrom: isGroup ? [] : [senderId],
        ...mediaPayload,
    });
    const { dispatcher, replyOptions, markDispatchIdle } = createYachReplyDispatcher({
        cfg: effectiveCfg,
        agentId: route.agentId,
        chatId,
        replyToMessageId: message.quoteMsgId ?? message.msgIdClient,
        accountId: account.appKey,
        fromUserId: senderId,
    });
    try {
        const { queuedFinal, counts } = await core.channel.reply.withReplyDispatcher({
            dispatcher,
            onSettled: () => { markDispatchIdle(); },
            run: () => core.channel.reply.dispatchReplyFromConfig({
                ctx: ctxPayload,
                cfg: effectiveCfg,
                dispatcher,
                replyOptions,
            }),
        });
        log.info("dispatch complete", { accountId: account.accountId, queuedFinal, replies: counts.final });
        reportEvent("inbound.dispatch", "dispatch complete", {
            accountId: account.accountId,
            source: "inbound",
            action: "dispatch.complete",
            result: "success",
            msgType: message.msgtype,
        });
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error("dispatch error", { err: errMsg, msgType: message.msgtype, senderId, chatId, chatType: isGroup ? "group" : "direct" });
    }
}
//# sourceMappingURL=dispatcher.js.map