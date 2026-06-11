import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";
function getYachPluginCfg(cfg) {
    return cfg?.["channels"]?.["yach"] ?? {};
}
function listConfiguredAccountIds(cfg) {
    const accounts = getYachPluginCfg(cfg).accounts;
    if (!accounts || typeof accounts !== "object")
        return [];
    return Object.keys(accounts).filter(Boolean);
}
export function listYachAccountIds(cfg) {
    const ids = listConfiguredAccountIds(cfg);
    if (ids.length === 0)
        return [DEFAULT_ACCOUNT_ID];
    return [...ids].sort((a, b) => a.localeCompare(b));
}
function mergeYachAccountConfig(cfg, accountId) {
    const pluginCfg = getYachPluginCfg(cfg);
    const { accounts: _ignored, ...base } = pluginCfg;
    const accountOverrides = pluginCfg.accounts?.[accountId] ?? {};
    return { ...base, ...accountOverrides };
}
export function resolveYachAccount(params) {
    const accountId = normalizeAccountId(params.accountId);
    const pluginCfg = getYachPluginCfg(params.cfg);
    const baseEnabled = pluginCfg.enabled !== false;
    const merged = mergeYachAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const appKey = merged.appKey?.trim();
    const appSecret = merged.appSecret?.trim();
    const configured = Boolean(appKey && appSecret);
    return {
        accountId,
        name: merged.name,
        enabled: baseEnabled && accountEnabled,
        configured,
        appKey,
        appSecret,
        baseUrl: merged.baseUrl ?? "https://yach-oapi.zhiyinlou.com",
        config: merged,
    };
}
export function resolveYachAccountByBotId(params) {
    const { cfg, botId } = params;
    const pluginCfg = getYachPluginCfg(cfg);
    const accounts = pluginCfg.accounts;
    if (accounts) {
        const matchedKey = Object.entries(accounts).find(([, v]) => v?.appKey === botId)?.[0];
        const keyById = normalizeAccountId(botId);
        const resolvedKey = matchedKey ?? (accounts[keyById] ? keyById : undefined);
        if (resolvedKey) {
            return resolveYachAccount({ cfg, accountId: resolvedKey });
        }
    }
    return resolveYachAccount({ cfg, accountId: DEFAULT_ACCOUNT_ID });
}
export function resolveDefaultYachAccountId(cfg) {
    const ids = listYachAccountIds(cfg);
    if (ids.includes(DEFAULT_ACCOUNT_ID))
        return DEFAULT_ACCOUNT_ID;
    return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
export function getAccountBotCfg(account) {
    if (!account.appKey || !account.appSecret) {
        throw new Error(`[yach] account ${account.accountId} missing appKey/appSecret`);
    }
    return { appKey: account.appKey, appSecret: account.appSecret };
}
export function listEnabledYachAccounts(cfg) {
    return listYachAccountIds(cfg)
        .map((accountId) => resolveYachAccount({ cfg, accountId }))
        .filter((a) => a.enabled && a.configured);
}
//# sourceMappingURL=index.js.map