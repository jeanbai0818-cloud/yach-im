/**
 * 工具层自动授权处理（Path 1 — User OAuth Device Flow）。
 *
 * 当工具调用遇到 NeedUserAuthorizationError 时，
 * handleInvokeErrorWithAutoAuth() 自动：
 *   1. 发起知音楼 OAuth Device Flow（requestYachDeviceAuthorization）
 *   2. 调用 apply/send；若返回 already_authorized → 不向用户推卡片/群提示/成功失败 IM，仍走后台轮询换票
 *   3. 否则照常发授权卡片与群提示；后台轮询直至用户授权或超时（pollYachDeviceToken）
 *   4. 授权成功后保存 token，发送合成消息触发 AI 重试原始操作
 *
 * 降级策略：以下情况直接返回错误文本，不发起授权：
 *   - 无 YachTicket（非消息上下文）
 *   - 账号未配置
 *   - Device Flow 本身抛异常
 */
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { getYachTicket, withYachTicket } from "../core/yach-ticket.js";
import { NeedUserAuthorizationError } from "../core/user-token-errors.js";
import { requestYachDeviceAuthorization, pollYachDeviceToken, sendYachAuthCard, YachAppScopeError, } from "../core/device-flow.js";
import { setStoredToken, getStoredToken, tokenStatus } from "../core/user-token-store.js";
import { resolveYachAccount } from "../accounts/index.js";
import { YachClient } from "../core/yach-client.js";
import { getYachConfig } from "../core/runtime.js";
import { yachLogger } from "../core/yach-logger.js";
import { reportError, reportEvent } from "../core/reporter.js";
const log = yachLogger("auto-auth");
import { enqueueChatTask } from "../messaging/outbound/chat-queue.js";
import { processMessage } from "../messaging/inbound/dispatcher.js";
// ── scope 合并工具 ─────────────────────────────────────────────────────────
/** 合并两个逗号/空格分隔的 scope 字符串，返回去重后的逗号分隔结果 */
function mergeScopes(a, b) {
    const setA = new Set((a ?? "").split(/[\s,]+/).filter(Boolean));
    const setB = new Set((b ?? "").split(/[\s,]+/).filter(Boolean));
    return [...new Set([...setA, ...setB])].join(",");
}
async function persistMergedDeviceToken(appKey, senderId, t) {
    const now = Date.now();
    const existingForMerge = await getStoredToken(appKey, senderId);
    const mergedScope = mergeScopes(existingForMerge?.scope, t.scope);
    await setStoredToken({
        userId: senderId,
        appKey,
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        expiresAt: now + t.expiresIn * 1000,
        refreshExpiresAt: now + t.refreshExpiresIn * 1000,
        scope: mergedScope,
        grantedAt: now,
    });
}
/** Key: `${appKey}:${userId}` */
const pendingFlows = new Map();
/**
 * 执行知音楼 OAuth Device Flow。
 *
 * 1. 检查本地 token 是否已存在且 scope 足够 → 跳过授权
 * 2. Guard：已有 in-flight flow → 终止旧流，复用已有卡片（实际是覆盖）
 * 3. 请求 device_code
 * 4. apply/send；若 already_authorized 则标记静默（不发群提示、不发成功/失败 IM），仍后台轮询
 * 5. 群聊非静默时可发群内提示；后台轮询（fire-and-forget）
 *    - 成功：保存 token →（非静默时发 IM）→ 发合成消息触发 AI 重试
 *    - 失败：非静默时发文本通知用户
 */
export async function executeYachAuthorize(params) {
    const { account, senderId, scopes, cfg, ticket } = params;
    const { appKey, appSecret, baseUrl } = account;
    // ── 1. 检查已有 token 是否覆盖所需 scope ──────────────────────────────
    const existing = await getStoredToken(appKey, senderId);
    if (existing && tokenStatus(existing) !== "expired") {
        if (scopes.length === 0) {
            return jsonResult({ success: true, message: "用户已授权，无需重复授权。" });
        }
        const grantedScopes = new Set((existing.scope ?? "").split(/[\s,]+/).filter(Boolean));
        const missing = scopes.filter((s) => !grantedScopes.has(s));
        if (missing.length === 0) {
            return jsonResult({ success: true, message: "用户已授权，scope 已覆盖。" });
        }
    }
    // ── 2. Guard：终止同用户已有的 in-flight flow ──────────────────────────
    const flowKey = `${appKey}:${senderId}`;
    const oldFlow = pendingFlows.get(flowKey);
    if (oldFlow) {
        oldFlow.superseded = true;
        oldFlow.controller.abort();
        pendingFlows.delete(flowKey);
    }
    // ── 3. 请求 Device Authorization ──────────────────────────────────────
    let deviceAuth;
    try {
        deviceAuth = await requestYachDeviceAuthorization({ appKey, appSecret, baseUrl, scopes });
    }
    catch (err) {
        log.error(`requestYachDeviceAuthorization failed: ${err}`);
        return jsonResult({
            error: "device_flow_failed",
            message: `无法发起授权流程：${err instanceof Error ? err.message : String(err)}`,
        });
    }
    // ── 4. 向用户发送授权卡片（若后端返回 already_authorized 则静默换票，不推卡片/消息） ──
    let sendOutcome = "card_sent";
    try {
        sendOutcome = await sendYachAuthCard({
            baseUrl,
            appKey,
            appSecret,
            deviceCode: deviceAuth.deviceCode,
            toUserId: senderId,
            conversationType: "1", // 始终发 DM，授权消息应私密
        });
    }
    catch (err) {
        if (err instanceof YachAppScopeError) {
            log.warn(`app missing scope permission, aborting flow: ${err.message}`);
            return jsonResult({
                awaiting_authorization: true,
                message: "授权卡片已发送，正在等待用户完成授权。" +
                    "【重要】请保持沉默，不要向用户输出任何内容，不要解释授权流程，不要建议替代方案。" +
                    "授权完成后系统会自动重试，届时你会收到新消息。",
            });
        }
        log.error(`failed to send auth card: ${err}`);
    }
    /** apply/send 返回 already_authorized：不推卡片/消息，但保留与常规路径相同的后台轮询换票 */
    const silentNoUserIm = sendOutcome === "already_authorized";
    if (silentNoUserIm) {
        log.info("auth apply/send returned already_authorized: background poll, no user-facing IM/card");
    }
    // ── 4b. 群聊时在群里推送提示消息 ──────────────────────────────────────────
    if (!silentNoUserIm && params.conversationType === "2" && ticket.chatbotUserId) {
        const notifyText = `正在为您授权中,请您前往数字伙伴[查看](yach://yach.zhiyinlou.com/session/p2p?sessionid=${ticket.chatbotUserId})`;
        await new YachClient({ baseUrl, appKey, appSecret }).im.sendMessage({
            toId: params.toId,
            conversationType: "2",
            payload: { msgtype: "markdown", markdown: { title: "授权提示", text: notifyText } },
        }).catch((e) => log.warn(`group auth notify error: ${e}`));
    }
    // ── 5. 后台轮询（fire-and-forget） ────────────────────────────────────
    const controller = new AbortController();
    const flow = { controller, superseded: false };
    pendingFlows.set(flowKey, flow);
    void (async () => {
        try {
            const result = await pollYachDeviceToken({
                appKey,
                appSecret,
                baseUrl,
                deviceCode: deviceAuth.deviceCode,
                interval: deviceAuth.interval,
                expiresIn: deviceAuth.expiresIn,
                signal: controller.signal,
                requestedScopes: scopes,
                skipInitialSleep: silentNoUserIm,
            });
            if (flow.superseded) {
                return;
            }
            pendingFlows.delete(flowKey);
            if (!result.ok) {
                reportError("oauth.device-flow", "polling failed", { appKey, senderId, error: result.error });
                if (silentNoUserIm) {
                    log.warn(`silent auth poll finished without token: ${result.error} ${result.message}`);
                }
                else {
                    const failMsg = result.error === "access_denied"
                        ? "❌ 您拒绝了授权请求。如需使用相关功能，请重新发起操作。"
                        : `❌ 授权超时或失败（${result.message}）。请重新发起操作。`;
                    await new YachClient({ baseUrl, appKey, appSecret }).im.sendMessage({
                        toId: senderId,
                        conversationType: "1",
                        payload: { msgtype: "text", text: { content: failMsg } },
                    }).catch((e) => log.warn(`fail notify error: ${e}`));
                }
                return;
            }
            await persistMergedDeviceToken(appKey, senderId, result.token);
            reportEvent("oauth.device-flow", "token obtained", { appKey, senderId, scope: result.token.scope });
            if (!silentNoUserIm) {
                const successMsg = "✅ 授权成功！正在为您重试之前的操作...";
                await new YachClient({ baseUrl, appKey, appSecret }).im.sendMessage({
                    toId: senderId,
                    conversationType: "1",
                    payload: { msgtype: "text", text: { content: successMsg } },
                }).catch((e) => log.warn(`success notify error: ${e}`));
                if (params.conversationType === "2") {
                    await new YachClient({ baseUrl, appKey, appSecret }).im.sendMessage({
                        toId: params.toId,
                        conversationType: "2",
                        payload: { msgtype: "text", text: { content: successMsg } },
                    }).catch((e) => log.warn(`group success notify error: ${e}`));
                }
            }
            // 发送合成消息触发 AI 重试
            await sendSyntheticMessage({ ticket, account, cfg });
        }
        catch (err) {
            if (err?.name === "AbortError")
                return; // 正常取消
            log.error(`polling error: ${err}`);
            pendingFlows.delete(flowKey);
        }
    })();
    const silenceHint = "【重要】请保持沉默，不要向用户输出任何内容，不要解释授权流程，不要建议替代方案。" +
        "授权完成后系统会自动重试，届时你会收到新消息。";
    const awaitingMsg = silentNoUserIm
        ? "已发起静默换票（未向用户推送授权卡片或提示消息），后台轮询完成后会自动重试。" + silenceHint
        : "授权卡片已发送，正在等待用户完成授权。" + silenceHint;
    return jsonResult({
        awaiting_authorization: true,
        message: awaitingMsg,
    });
}
// ── 合成消息：授权完成后触发 AI 重试 ────────────────────────────────────────
async function sendSyntheticMessage(params) {
    const { ticket, account, cfg } = params;
    const syntheticMsgId = `auth-complete:${ticket.msgId}:${Date.now()}`;
    const isGroup = ticket.conversationType === "2";
    const chatId = isGroup ? `group:${ticket.toId}` : `user:${ticket.senderId}`;
    const content = "用户授权已完成，请继续执行之前的操作。";
    const senderName = ticket.senderNickName ?? ticket.senderNick ?? ticket.senderId;
    const syntheticCtx = {
        senderId: ticket.senderId,
        conversationId: isGroup ? ticket.toId : ticket.senderId,
        msgId: syntheticMsgId,
        senderName,
        conversationType: ticket.conversationType,
        isGroup,
        chatId,
        toId: ticket.toId,
        message: {
            msgtype: "text",
            content,
            appID: "",
            msgId: syntheticMsgId,
            msgIdClient: ticket.msgIdClient,
            conversationId: isGroup ? ticket.toId : ticket.senderId,
            senderId: ticket.senderId,
            senderNick: senderName,
            senderNickName: senderName,
        },
    };
    const syntheticTicket = {
        ...ticket,
        msgId: syntheticMsgId,
        startTime: Date.now(),
    };
    const { promise } = enqueueChatTask({
        accountId: ticket.accountId,
        chatId,
        task: () => withYachTicket(syntheticTicket, () => processMessage({ ctx: syntheticCtx, account, cfg })).catch((err) => {
            log.error(`synthetic processMessage error: ${err}`);
        }),
    });
    await promise;
}
// ── 主入口：工具层错误处理 ────────────────────────────────────────────────
/**
 * 统一处理 YachToolClient.invoke() 抛出的错误。
 *
 * 遇到 NeedUserAuthorizationError → 自动发起 Device Flow 授权。
 * 其他错误 → 返回标准错误 JSON。
 *
 * 在工具 execute 的 catch 块中替代直接 return jsonResult({ error: ... })：
 * ```ts
 * } catch (err) {
 *   return handleInvokeErrorWithAutoAuth(err, cfg);
 * }
 * ```
 */
export async function handleInvokeErrorWithAutoAuth(err, cfg, context) {
    const resolvedCfg = cfg ?? getYachConfig();
    const ticket = getYachTicket();
    if (err instanceof NeedUserAuthorizationError) {
        if (!ticket) {
            log.warn("NeedUserAuthorizationError but no ticket, returning error");
            return jsonResult({
                error: "need_user_authorization",
                message: "需要用户授权，但当前不在消息上下文中，无法自动发起授权。",
            });
        }
        const senderId = ticket.senderId;
        if (!senderId) {
            return jsonResult({ error: "need_user_authorization", message: "无法获取用户 ID，授权失败。" });
        }
        const account = resolveYachAccount({ cfg: resolvedCfg, accountId: ticket.accountId });
        if (!account.configured || !account.appKey || !account.appSecret) {
            return jsonResult({
                error: "need_user_authorization",
                message: `账号 ${ticket.accountId} 未配置，无法发起授权。`,
            });
        }
        const typedAccount = account;
        reportEvent("tools.auto-auth", "auth flow triggered", { senderId, accountId: ticket?.accountId, scopes: err.requiredScopes.join(",") });
        try {
            return await executeYachAuthorize({
                account: typedAccount,
                senderId,
                toId: ticket.toId,
                conversationType: ticket.conversationType,
                scopes: err.requiredScopes,
                cfg: resolvedCfg,
                ticket,
            });
        }
        catch (autoAuthErr) {
            log.error(`executeYachAuthorize failed: ${autoAuthErr}`);
            return jsonResult({
                error: "need_user_authorization",
                message: "自动授权流程启动失败，请稍后重试。",
            });
        }
    }
    // 其他错误：返回标准错误
    const msg = err instanceof Error ? err.message : String(err);
    reportError("tools.invoke", "tool invocation error", { err: msg, senderId: ticket?.senderId, accountId: ticket?.accountId, toolName: context?.toolName, action: context?.action });
    return jsonResult({ error: msg });
}
//# sourceMappingURL=auto-auth.js.map