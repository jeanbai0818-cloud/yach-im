/**
 * Channel SDK 传输层：长连接消息接收。
 *
 * 使用 TalMsgClient SDK 建立长连接，监听 recvMsg 事件收取消息。
 * 断线重连策略：指数退避 5s → 10s → 20s → ... 上限 5 分钟。
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handleInboundMessage } from "../messaging/inbound/handler.js";
import { yachLogger } from "../core/yach-logger.js";
const log = yachLogger("channel/sdk");
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const CHANNEL_CONFIG = {
    appId: "yach20001",
    bizId: "97",
    proxy: {
        protocol: "https",
        hostname: "chatconf.msg.xescdn.com",
        port: 443,
        url: "/v4/proxy/config",
    },
    logServer: {
        protocol: "https",
        hostname: "log.xescdn.com",
        port: 443,
        url: "/log",
    },
};
function loadSdk() {
    const sdkPath = join(__dirname, "..", "vendor", "tal-msg-sdk", "index.cjs");
    return require(sdkPath);
}
const activeClients = new Map();
const NET_STATUS_CONNECTED = 2;
const NET_STATUS_DISCONNECT_SET = new Set([1, 2, 5]); // Unavailable, ServerFailed, DisConnected
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
export function monitorChannel(options) {
    const { account, cfg, logger } = options;
    const accountId = account.accountId;
    if (!account.appKey) {
        log.error("[yach-channel] account " + accountId + " has no appKey, cannot start channel SDK");
        return () => { };
    }
    let TalMsgClient;
    try {
        TalMsgClient = loadSdk();
        logger.info("[yach-channel] SDK version: " + TalMsgClient.getVersion());
    }
    catch (err) {
        log.error("[yach-channel][" + accountId + "] failed to load SDK: " + String(err));
        return () => { };
    }
    const userId = account.appKey;
    const appId = account.config.channelAppId ?? CHANNEL_CONFIG.appId;
    let client;
    let channel;
    try {
        client = new TalMsgClient(appId, "1.0.0");
        client.setSdkConfig({
            proxyConfig: {
                protocol: CHANNEL_CONFIG.proxy.protocol,
                hostname: CHANNEL_CONFIG.proxy.hostname,
                port: CHANNEL_CONFIG.proxy.port,
                url: CHANNEL_CONFIG.proxy.url,
            },
            remoteLogConfig: {
                protocol: CHANNEL_CONFIG.logServer.protocol,
                hostname: CHANNEL_CONFIG.logServer.hostname,
                port: CHANNEL_CONFIG.logServer.port,
                url: CHANNEL_CONFIG.logServer.url,
            },
            extra: { location: "China", logLevel: "warn" },
        });
        channel = client.getInstance(TalMsgClient.CHANNEL);
    }
    catch (err) {
        log.error("[yach-channel][" + accountId + "] failed to create SDK client: " + String(err));
        return () => { };
    }
    activeClients.set(accountId, { client, channel });
    let stopped = false;
    let reconnectTimer = null;
    let failCount = 0;
    function getReconnectDelay() {
        return Math.min(RECONNECT_BASE_MS * Math.pow(2, failCount), RECONNECT_MAX_MS);
    }
    function scheduleReconnect(reason) {
        if (stopped || reconnectTimer !== null)
            return;
        failCount++;
        const delay = getReconnectDelay();
        logger.warn("[yach-channel][" + accountId + "] " + reason +
            ", reconnecting in " + delay + "ms (attempt " + failCount + ")");
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!stopped)
                doInit(true);
        }, delay);
    }
    function doInit(isReconnect = false) {
        if (isReconnect) {
            try {
                channel.unInit();
            }
            catch (err) {
                logger.warn("[yach-channel][" + accountId + "] unInit before reconnect: " + String(err));
            }
        }
        try {
            const initResult = channel.init(CHANNEL_CONFIG.bizId, {
                userId,
                auth: { params: new Map([["app_key", account.appKey ?? ""], ["app_secret", account.appSecret ?? ""]]) },
            });
            logger.info("[yach-channel][" + accountId + "] " + (isReconnect ? "re" : "") +
                "init result: " + initResult + ", userId: " + userId);
        }
        catch (err) {
            log.error("[yach-channel][" + accountId + "] init threw: " + String(err));
            scheduleReconnect("init threw");
        }
    }
    const onNetStatus = (data) => {
        try {
            logger.info("[yach-channel][" + accountId + "] net status change: " + JSON.stringify(data));
            const raw = data !== null && typeof data === "object" ? data : {};
            const statusNum = typeof raw["netStatus"] === "number"
                ? raw["netStatus"]
                : typeof raw["status"] === "number" ? raw["status"] : undefined;
            if (statusNum === NET_STATUS_CONNECTED) {
                if (failCount > 0) {
                    logger.info("[yach-channel][" + accountId + "] reconnected successfully, resetting fail count");
                    failCount = 0;
                }
                return;
            }
            if (statusNum !== undefined && NET_STATUS_DISCONNECT_SET.has(statusNum)) {
                scheduleReconnect("netStatus=" + statusNum);
            }
        }
        catch (err) {
            log.error("[yach-channel][" + accountId + "] onNetStatus error: " + String(err));
        }
    };
    const onRecvMsg = (data) => {
        logger.info("[yach-channel][" + accountId + "] recvMsg received");
        logger.info("[yach-channel][" + accountId + "] recvMsg data: " + JSON.stringify(data));
        try {
            const envelope = (typeof data === "string" ? JSON.parse(data) : data);
            const inner = envelope["data"];
            const message = (typeof inner === "string" ? JSON.parse(inner) : inner);
            void handleInboundMessage({ message, account, cfg, logger });
        }
        catch (err) {
            log.error("[yach-channel][" + accountId + "] failed to handle recvMsg: " + String(err));
        }
    };
    const onKickout = (data) => {
        logger.warn("[yach-channel][" + accountId + "] kicked out: " + JSON.stringify(data));
        scheduleReconnect("kicked out");
    };
    const onAuthResponse = (data) => {
        logger.info("[yach-channel][" + accountId + "] auth response: " + JSON.stringify(data));
        if (data.code !== 0) {
            log.error("[yach-channel][" + accountId + "] 登录失败: 请检查 appKey 和 appSecret 是否正确！！！");
            try {
                channel.unInit();
            }
            catch (err) {
                logger.warn("[yach-channel][" + accountId + "] unInit on auth error: " + String(err));
            }
            scheduleReconnect("auth error");
        }
    };
    channel.on("netStatusChange", onNetStatus);
    channel.on("authResponse", onAuthResponse);
    channel.on("kickout", onKickout);
    channel.on("recvMsg", onRecvMsg);
    doInit(false);
    return () => {
        stopped = true;
        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        logger.info("[yach-channel][" + accountId + "] stopping channel SDK...");
        try {
            channel.unInit();
        }
        catch (err) {
            log.error("[yach-channel][" + accountId + "] unInit error: " + String(err));
        }
        activeClients.delete(accountId);
    };
}
//# sourceMappingURL=sdk.js.map