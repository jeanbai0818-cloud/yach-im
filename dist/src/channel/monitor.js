import { monitorWebhook } from "./webhook.js";
import { monitorChannel } from "./sdk.js";
export function monitorSingleAccount(options) {
    const { account, logger } = options;
    const connectionMode = account.config.connectionMode ?? "channel";
    logger.info("[yach] account " + account.accountId + " starting in " + connectionMode + " mode");
    if (connectionMode === "channel") {
        return monitorChannel(options);
    }
    return monitorWebhook(options);
}
//# sourceMappingURL=monitor.js.map