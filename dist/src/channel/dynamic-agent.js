import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getYachRuntime, getYachConfig } from "../core/runtime.js";
import { reportEvent } from "../core/reporter.js";
/** Promise-chain mutex：保证 maybeCreateDynamicAgent 串行执行 */
let configMutex = Promise.resolve();
function withConfigLock(fn) {
    let release;
    const next = new Promise((resolve) => {
        release = resolve;
    });
    const result = configMutex.then(fn);
    configMutex = result.then(() => release(), () => release());
    return result;
}
/**
 * 检查是否需要为私聊用户或群聊创建动态 Agent，并在需要时创建。
 * 私聊每位用户一个 Agent，群聊每个群一个 Agent，各有独立 workspace。
 *
 * 使用互斥锁串行化，防止并发读-写导致配置数据丢失。
 */
export function maybeCreateDynamicAgent(params) {
    return withConfigLock(() => maybeCreateDynamicAgentUnsafe(params));
}
async function maybeCreateDynamicAgentUnsafe(params) {
    const { peerId, peerKind, dynamicCfg, accountId, log } = params;
    const runtime = getYachRuntime();
    // 在锁内重新读取最新配置，避免使用调用方传入的可能已过期的快照
    const cfg = getYachConfig();
    // 检查该用户/群是否已有绑定
    const existingBindings = cfg.bindings ?? [];
    const hasBinding = existingBindings.some((b) => b.match?.channel === "yach" &&
        b.match?.peer?.kind === peerKind &&
        b.match?.peer?.id === peerId &&
        b.match?.accountId === accountId);
    if (hasBinding) {
        return { created: false, updatedCfg: cfg };
    }
    // 检查 maxAgents 上限
    if (dynamicCfg.maxAgents !== undefined) {
        const yachAgentCount = (cfg.agents?.list ?? []).filter((a) => a.id.startsWith("yach-")).length;
        if (yachAgentCount >= dynamicCfg.maxAgents) {
            log(`yach: maxAgents limit (${dynamicCfg.maxAgents}) reached, not creating agent for ${peerKind}:${peerId}`);
            reportEvent("channel.dynamic-agent", "maxAgents limit reached", { accountId, peerId, peerKind, maxAgents: String(dynamicCfg.maxAgents) });
            return { created: false, updatedCfg: cfg };
        }
    }
    const agentId = peerKind === "group"
        ? `yach-${accountId}-group-${peerId}`
        : `yach-${accountId}-${peerId}`;
    // Agent 已存在但缺少绑定 —— 仅补充绑定
    const existingAgent = (cfg.agents?.list ?? []).find((a) => a.id === agentId);
    if (existingAgent) {
        log(`yach: agent "${agentId}" exists, adding missing binding for ${peerKind}:${peerId}`);
        const updatedCfg = {
            ...cfg,
            bindings: [
                ...existingBindings,
                {
                    agentId,
                    match: {
                        accountId: accountId,
                        channel: "yach",
                        peer: { kind: peerKind, id: peerId },
                    },
                },
            ],
        };
        await runtime.config.writeConfigFile(updatedCfg);
        reportEvent("channel.dynamic-agent", "binding added to existing agent", { accountId, peerId, peerKind, agentId });
        return { created: true, updatedCfg, agentId };
    }
    // 解析路径模板
    const workspaceTemplate = dynamicCfg.workspaceTemplate ?? "~/.openclaw/workspace-{agentId}";
    const agentDirTemplate = dynamicCfg.agentDirTemplate ?? "~/.openclaw/agents/{agentId}/agent";
    const workspace = resolveUserPath(workspaceTemplate.replace("{userId}", peerId).replace("{agentId}", agentId));
    const agentDir = resolveUserPath(agentDirTemplate.replace("{userId}", peerId).replace("{agentId}", agentId));
    log(`yach: creating dynamic agent "${agentId}" for ${peerKind}:${peerId}`);
    log(`  workspace: ${workspace}`);
    log(`  agentDir: ${agentDir}`);
    // 创建目录
    await fs.promises.mkdir(workspace, { recursive: true });
    await fs.promises.mkdir(agentDir, { recursive: true });
    // 写入更新后的配置
    const updatedCfg = {
        ...cfg,
        agents: {
            ...cfg.agents,
            defaults: {
                ...cfg.agents?.defaults,
                // heartbeat: {
                //   ...cfg.agents?.defaults?.heartbeat,
                //   ackMaxChars: Math.floor(Math.random() * 2) + 29,
                // }
            },
            list: [...(cfg.agents?.list ?? []), {
                    id: agentId,
                    workspace,
                    agentDir,
                    // heartbeat:{} 
                }],
        },
        bindings: [
            ...existingBindings,
            {
                agentId,
                match: {
                    accountId: accountId,
                    channel: "yach",
                    peer: { kind: peerKind, id: peerId },
                },
            },
        ],
    };
    await runtime.config.writeConfigFile(updatedCfg);
    reportEvent("channel.dynamic-agent", "agent created", { accountId, peerId, peerKind, agentId });
    return { created: true, updatedCfg, agentId };
}
/**
 * 将以 ~ 开头的路径展开为用户主目录。
 */
function resolveUserPath(p) {
    if (p.startsWith("~/")) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}
//# sourceMappingURL=dynamic-agent.js.map