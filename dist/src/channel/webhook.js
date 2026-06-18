import { createHmac } from "node:crypto";
import { readJsonBodyWithLimit } from "openclaw/plugin-sdk/infra-runtime";
import { registerPluginHttpRoute, registerWebhookTarget, resolveSingleWebhookTarget, resolveWebhookTargets, } from "openclaw/plugin-sdk/webhook-ingress";
import { handleInboundMessage } from "../messaging/inbound/handler.js";
import { reportError } from "../core/reporter.js";

// Yach sends X-Yach-Signature: sha256=<hex> computed over timestamp+appKey+nonce+body
// with the appSecret as the HMAC key, and X-Yach-Timestamp within ±5 minutes.
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

function verifyYachSignature(req, rawBody, appSecret) {
    const sig = req.headers["x-yach-signature"] ?? req.headers["x-tal-signature"] ?? "";
    const ts = req.headers["x-yach-timestamp"] ?? req.headers["x-tal-timestamp"] ?? "";
    const nonce = req.headers["x-yach-nonce"] ?? req.headers["x-tal-nonce"] ?? "";
    // If the provider sends no signature header at all, reject — don't silently allow unsigned.
    if (!sig || !ts) return false;
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    if (Math.abs(Date.now() - tsNum) > WEBHOOK_TIMESTAMP_TOLERANCE_MS) return false;
    const payload = ts + appSecret + nonce + rawBody;
    const expected = createHmac("sha256", appSecret).update(payload, "utf8").digest("hex");
    const prefix = "sha256=";
    const received = sig.startsWith(prefix) ? sig.slice(prefix.length) : sig;
    // Constant-time compare to prevent timing attacks
    if (expected.length !== received.length) return false;
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    return a.length === b.length && Buffer.compare(a, b) === 0;
}
const YACH_MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB
function rejectNonPostWebhookRequest(req, res) {
    if ((req.method ?? "GET").toUpperCase() === "POST")
        return false;
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "POST" });
    res.end("Method Not Allowed");
    return true;
}
const webhookTargets = new Map();
function registerYachWebhookTarget(target) {
    return registerWebhookTarget(webhookTargets, target).unregister;
}
export function monitorWebhook(options) {
    const { account, cfg, logger, statusSink } = options;
    if (!account.appKey) {
        logger.error("[yach] account " + account.accountId + " has no appKey, cannot register webhook");
        reportError("channel.webhook", "account missing appKey", { accountId: account.accountId });
        return () => { };
    }
    const path = account.config.webhookPath ?? "/yach/" + account.accountId + "/messages";
    logger.info("[yach] registering webhook at " + path + " (accountId=" + account.accountId + ")");
    const unregisterTarget = registerYachWebhookTarget({ path, account, cfg, logger, statusSink });
    const unregisterRoute = registerPluginHttpRoute({
        path,
        pluginId: "yach",
        accountId: account.accountId,
        auth: "plugin",
        match: "exact",
        log: (message) => logger.info(message),
        handler: async (req, res) => {
            const handled = await handleYachWebhookRequest(req, res);
            if (!handled && !res.headersSent) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end("Not Found");
            }
        },
    });
    return () => {
        unregisterTarget();
        unregisterRoute();
    };
}
async function handleYachWebhookRequest(req, res) {
    const resolved = resolveWebhookTargets(req, webhookTargets);
    if (!resolved)
        return false;
    const { targets } = resolved;
    let matched = resolveSingleWebhookTarget(targets, () => true);
    if (matched.kind === "ambiguous") {
        const first = targets[0];
        if (first) {
            first.logger.warn("[yach] ambiguous webhook targets for path " + resolved.path +
                " (" + targets.length + " entries), using first; consider stopping the channel before restart");
            matched = { kind: "single", target: first };
        }
    }
    if (matched.kind === "ambiguous") {
        res.writeHead(409);
        res.end("ambiguous webhook target");
        return true;
    }
    if (matched.kind === "none")
        return false;
    if (rejectNonPostWebhookRequest(req, res))
        return true;
    const { account, cfg, logger } = matched.target;
    if (!account.configured || !account.appKey || !account.appSecret) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "appKey/appSecret not configured" }));
        return true;
    }
    const bodyResult = await readJsonBodyWithLimit(req, { maxBytes: YACH_MAX_BODY_BYTES });
    if (!bodyResult.ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid request body" }));
        return true;
    }
    // Verify the request actually came from Yach before touching any business logic.
    const rawBodyStr = typeof bodyResult.rawBody === "string"
        ? bodyResult.rawBody
        : (bodyResult.rawBody ? Buffer.from(bodyResult.rawBody).toString("utf8") : JSON.stringify(bodyResult.value));
    if (!verifyYachSignature(req, rawBodyStr, account.appSecret)) {
        logger.warn("[yach] webhook signature verification failed for account " + account.accountId + " — rejecting request");
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid signature" }));
        return true;
    }
    const raw = bodyResult.value;
    const message = (raw.value && typeof raw.value === "object" ? raw.value : raw);
    matched.target.statusSink?.({ lastInboundAt: Date.now() });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ msgtype: "empty" }));
    void handleInboundMessage({ message, account, cfg, logger });
    return true;
}
//# sourceMappingURL=webhook.js.map