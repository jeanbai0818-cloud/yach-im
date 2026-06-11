import { readJsonBodyWithLimit } from "openclaw/plugin-sdk/infra-runtime";
import { registerPluginHttpRoute, registerWebhookTarget, resolveSingleWebhookTarget, resolveWebhookTargets, } from "openclaw/plugin-sdk/webhook-ingress";
import { handleInboundMessage } from "../messaging/inbound/handler.js";
import { reportError } from "../core/reporter.js";
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
    const raw = bodyResult.value;
    const message = (raw.value && typeof raw.value === "object" ? raw.value : raw);
    matched.target.statusSink?.({ lastInboundAt: Date.now() });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ msgtype: "empty" }));
    void handleInboundMessage({ message, account, cfg, logger });
    return true;
}
//# sourceMappingURL=webhook.js.map