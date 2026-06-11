import {
  createChannelPluginBase,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/channel-core";

type YachResolvedAccount = {
  accountId: string;
  appKey?: string;
  appSecret?: string;
  baseUrl?: string;
  allowFrom: string[];
};

function resolveYachAccount(cfg: OpenClawConfig, accountId?: string | null): YachResolvedAccount {
  const channels = (cfg.channels ?? {}) as Record<string, unknown>;
  const yachSection = (channels["yach-im"] ?? {}) as Record<string, unknown>;
  const key = accountId ?? "default";
  const scoped = (yachSection[key] ?? yachSection) as Record<string, unknown>;
  return {
    accountId: key,
    appKey: typeof scoped.appKey === "string" ? scoped.appKey : undefined,
    appSecret: typeof scoped.appSecret === "string" ? scoped.appSecret : undefined,
    baseUrl: typeof scoped.baseUrl === "string" ? scoped.baseUrl : undefined,
    allowFrom: Array.isArray(scoped.allowFrom)
      ? scoped.allowFrom.filter((v): v is string => typeof v === "string")
      : [],
  };
}

function listYachAccountIds(cfg: OpenClawConfig): string[] {
  const channels = (cfg.channels ?? {}) as Record<string, unknown>;
  const yachSection = (channels["yach-im"] ?? {}) as Record<string, unknown>;
  const ids = Object.keys(yachSection).filter((key) => {
    const entry = yachSection[key];
    return typeof entry === "object" && entry !== null;
  });
  return ids.length > 0 ? ids : ["default"];
}

export const yachImPlugin = createChannelPluginBase<YachResolvedAccount>({
  id: "yach-im",
  config: {
    listAccountIds: listYachAccountIds,
    resolveAccount: resolveYachAccount,
    inspectAccount(cfg: OpenClawConfig, accountId?: string | null) {
      const account = resolveYachAccount(cfg, accountId);
      const configured = Boolean(account.appKey && account.appSecret && account.baseUrl);
      return {
        enabled: configured,
        configured,
        tokenStatus: configured ? "available" : "missing",
      };
    },
  },
  setup: {
    applyAccountConfig({ cfg, accountId, input }) {
      const channels = { ...(cfg.channels ?? {}) } as Record<string, unknown>;
      const yachSection = { ...((channels["yach-im"] as Record<string, unknown> | undefined) ?? {}) };
      yachSection[accountId] = {
        ...(yachSection[accountId] as Record<string, unknown> | undefined),
        ...(input as Record<string, unknown>),
      };
      channels["yach-im"] = yachSection;
      return {
        ...cfg,
        channels,
      };
    },
  },
});
