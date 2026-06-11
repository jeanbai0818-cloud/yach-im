import { aesDecrypt } from "../../core/aes.js";
import { processMessage } from "./dispatcher.js";
import { YachClient } from "../../core/yach-client.js";
import { getYachRuntime } from "../../core/runtime.js";
import { isMessageExpired, getMessageDedup } from "./dedup.js";
import { enqueueChatTask } from "../outbound/chat-queue.js";
import { extractYachAbortText, isLikelyAbortText } from "./abort-detect.js";
import { getAccountBotCfg } from "../../accounts/index.js";
import { withYachTicket } from "../../core/yach-ticket.js";
import { handleCallbackMessage } from "./callback-handler.js";
import { reportError } from "../../core/reporter.js";
// ── 消息类型白名单 ────────────────────────────────────────────────────────────
export function shouldHandle(msgtype) {
    if (!msgtype)
        return false;
    const HANDLED = new Set([
        "text", "audio", "image", "file", "video", "reply",
        "fold", "link", "merge_forward", "start_new_session",
        "callback",
    ]);
    return HANDLED.has(msgtype);
}
// ── 入站消息主处理 ────────────────────────────────────────────────────────────
export async function handleInboundMessage(params) {
    const { message, account, cfg, logger } = params;
    const msgtype = message?.msgtype;
    logger.info("yach[" + account.accountId + "]: received " + msgtype + " from " + message?.senderId);
    if (!shouldHandle(msgtype))
        return;
    if (!account.configured || !account.appKey || !account.appSecret) {
        logger.error("[yach] account " + account.accountId + " appKey/appSecret not configured");
        reportError("inbound.handler", "account not configured", { accountId: account.accountId, msgType: msgtype });
        return;
    }
    // P1: 消息过期检查
    if (isMessageExpired(message.createAt)) {
        logger.info("yach[" + account.accountId + "]: discarding expired message (createAt=" + message.createAt + ")");
        return;
    }
    const botCfg = getAccountBotCfg(account);
    let senderId;
    let conversationId;
    let msgId;
    let chatbotUserId;
    try {
        senderId = aesDecrypt(message.senderId, botCfg.appKey);
        conversationId = message.conversationId ? aesDecrypt(message.conversationId, botCfg.appKey) : "";
        msgId = message.msgId ? aesDecrypt(message.msgId, botCfg.appKey) : "";
        if (message.chatbotUserId) {
            try {
                chatbotUserId = aesDecrypt(message.chatbotUserId, botCfg.appKey);
            }
            catch { /* non-critical */ }
        }
        if (msgtype === "file") {
            message.content = aesDecrypt(message.content, botCfg.appKey);
        }
    }
    catch (err) {
        logger.error("[yach] decrypt failed: " + String(err));
        reportError("inbound.handler", "decrypt failed", { err: String(err), accountId: account.accountId, msgType: msgtype });
        return;
    }
    // P0: 消息去重
    const dedupKey = msgId || message.msgIdClient;
    if (dedupKey) {
        const dedup = getMessageDedup(account.accountId);
        if (!dedup.tryRecord(dedupKey, account.accountId)) {
            logger.info("yach[" + account.accountId + "]: duplicate message dropped (msgId=" + dedupKey + ")");
            return;
        }
    }
    const conversationType = message.conversationType === "2" ? "2" : "1";
    const isGroup = conversationType === "2";
    let senderName = message.senderNickName ?? message.senderNick ?? senderId;
    let senderTag;
    if (message.userJson) {
        try {
            const user = JSON.parse(message.userJson);
            if (user.name)
                senderName = user.name;
            const tagLines = [];
            if (user.workCode)
                tagLines.push(`work_code: ${user.workCode}`);
            if (user.name)
                tagLines.push(`name: ${user.name}`);
            if (user.deptName)
                tagLines.push(`department: ${user.deptName}`);
            if (tagLines.length > 0)
                senderTag = tagLines.join("\n");
        }
        catch { /* ignore */ }
    }
    const toId = isGroup ? conversationId : senderId;
    // ── 访问控制 ──────────────────────────────────────────────────────────────
    const accountCfg = account.config;
    if (isGroup) {
        const groupPolicy = accountCfg.groupPolicy ?? "open";
        if (groupPolicy === "disabled") {
            logger.info("[yach] group message rejected: groupPolicy=disabled");
            return;
        }
        if (groupPolicy === "allowlist") {
            const allowed = (accountCfg.groupAllowFrom ?? []).map(String);
            if (!allowed.includes("*") && !allowed.includes(conversationId)) {
                logger.info("[yach] group " + conversationId + " not in groupAllowFrom, ignored");
                return;
            }
        }
    }
    else {
        const dmPolicy = accountCfg.dmPolicy ?? "open";
        if (dmPolicy === "disabled") {
            logger.info("[yach] blocked DM sender " + senderId + " (dmPolicy=disabled)");
            return;
        }
        if (dmPolicy !== "open") {
            const core = getYachRuntime();
            const configAllowFrom = (accountCfg.allowFrom ?? []).map(String);
            const storeAllowFrom = await core.channel.pairing
                .readAllowFromStore({ channel: "yach", accountId: account.accountId })
                .catch(() => []);
            const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom];
            const allowed = effectiveAllowFrom.includes("*") || effectiveAllowFrom.includes(senderId);
            if (!allowed) {
                if (dmPolicy === "pairing") {
                    const { code, created } = await core.channel.pairing.upsertPairingRequest({
                        channel: "yach",
                        accountId: account.accountId,
                        id: senderId,
                        meta: { name: senderName },
                    });
                    if (created) {
                        logger.info("[yach] pairing request: sender=" + senderId + " name=" + senderName);
                        const replyText = core.channel.pairing.buildPairingReply({
                            channel: "yach",
                            idLine: "Your Yach user id: " + senderId,
                            code,
                        });
                        await YachClient.fromAccount(account).im.sendMessage({
                            toId: senderId,
                            conversationType: "1",
                            payload: { msgtype: "text", text: { content: replyText } },
                        }).catch((e) => logger.error("[yach] pairing reply failed: " + String(e)));
                    }
                }
                else {
                    logger.info("[yach] blocked unauthorized sender " + senderId + " (dmPolicy=" + dmPolicy + ")");
                }
                return;
            }
        }
    }
    // ── Callback 类型特殊处理：交给 AI 处理后 POST 结果到 callback_url ──────────────────────
    if (msgtype === "callback") {
        await handleCallbackMessage({
            message,
            account,
            cfg,
            logger,
            // 传入已解析的参数，避免重复解密
            senderId,
            conversationId,
            isGroup,
            senderName,
            toId,
        });
        return;
    }
    // ── 构建入站消息上下文 ────────────────────────────────────────────────────
    const chatId = isGroup ? `group:${conversationId}` : `user:${senderId}`;
    const ctx = {
        senderId, conversationId, msgId, senderName, senderTag,
        conversationType, isGroup, chatId, toId, message,
    };
    const ticket = {
        msgId,
        msgIdClient: message.msgIdClient,
        toId,
        senderId,
        accountId: account.accountId,
        conversationType,
        startTime: Date.now(),
        chatbotUserId,
    };
    // P1: Abort 快速路径
    const abortText = extractYachAbortText({
        msgtype,
        content: message.content,
        isGroup,
        botName: message.chatbotUserName,
    });
    if (abortText && isLikelyAbortText(abortText)) {
        logger.info("yach[" + account.accountId + "]: abort fast-path for sender=" + senderId +
            " text=" + JSON.stringify(abortText));
        void Promise.resolve(withYachTicket(ticket, () => processMessage({ ctx, account, cfg }))).catch((err) => {
            logger.error("[yach] abort processMessage error: " + String(err));
            reportError("inbound.handler.abort", "processMessage error", { err: String(err), accountId: account.accountId, msgId, senderId, chatId, conversationType, msgType: msgtype });
        });
        return;
    }
    // P0: Per-chat 串行队列
    const { status } = enqueueChatTask({
        accountId: account.accountId,
        chatId,
        task: () => Promise.resolve(withYachTicket(ticket, () => processMessage({ ctx, account, cfg }))).catch((err) => {
            logger.error("[yach] processMessage uncaught error: " + String(err));
            reportError("inbound.handler.queue", "processMessage uncaught error", { err: String(err), accountId: account.accountId, msgId, senderId, chatId, conversationType, msgType: msgtype });
        }),
    });
    if (status === "queued") {
        logger.info("yach[" + account.accountId + "]: message queued for chat=" + chatId + " (queue not empty)");
    }
}
//# sourceMappingURL=handler.js.map