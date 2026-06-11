import { oapiFetch } from "../core/fetch.js";
import { yachLogger } from "../core/yach-logger.js";
import { YachApiError } from "./errors.js";
const log = yachLogger("oapi/im");
// ── YachImApi ─────────────────────────────────────────────────────────────────
export class YachImApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    async sendMessage(params) {
        const { toId, conversationType, payload, toWorkCode, at } = params;
        const token = await this.getToken();
        const isGroup = conversationType === "2";
        const messageObj = { ...payload };
        if (isGroup && at && (at.isAtAll || at.atMobiles?.length || at.atWorkCodes?.length)) {
            messageObj.at = { atMobiles: at.atMobiles ?? [], atWorkCodes: at.atWorkCodes ?? [], isAtAll: at.isAtAll ?? false };
        }
        const message = JSON.stringify(messageObj);
        let url;
        let body;
        if (isGroup) {
            url = `${this.baseUrl}/group/robot/message/send?access_token=${token}`;
            body = new URLSearchParams({ group_id: toId, message });
        }
        else if (toWorkCode) {
            url = `${this.baseUrl}/v1/single/message/send?access_token=${token}`;
            body = new URLSearchParams({ to_work_code: toWorkCode, message });
        }
        else {
            url = `${this.baseUrl}/v1/single/message/send?access_token=${token}`;
            body = new URLSearchParams({ to_user_id: toId, message });
        }
        const apiPath = isGroup ? "/group/robot/message/send" : "/v1/single/message/send";
        log.debug("sendMessage", { apiPath, toId, msgtype: payload.msgtype });
        const res = await oapiFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const resultText = await res.text();
        const result = JSON.parse(resultText);
        if (!res.ok) {
            throw new Error(`[yach-oapi] sendMessage failed: HTTP ${res.status}`);
        }
        if (result.code !== 200) {
            throw new YachApiError(`[yach-oapi] sendMessage error: ${resultText}\n` +
                `  request: ${apiPath} ${isGroup ? "group_id" : "to_user_id"}=${toId} message=${message}`, result.code);
        }
        // 从原始文本中提取 yachMid，避免 JSON.parse 解析大整数时丢失精度
        const yachMidMatch = resultText.match(/"yachMid"\s*:\s*(\d+)/);
        const yachMid = yachMidMatch ? yachMidMatch[1] : undefined;
        log.debug("sendMessage ok", { toId, msgId: yachMid });
        return yachMid;
    }
    // ── 读取 ─────────────────────────────────────────────────────────────────
    /** 获取会话历史消息（GET /openapi/v2/im/messages） */
    async getMessages(params) {
        const token = await this.getToken();
        const qs = new URLSearchParams({
            access_token: token,
            group_id: params.groupId,
            start_time: String(params.startTime),
            end_time: String(params.endTime),
            page_size: String(params.pageSize ?? 50),
        });
        if (params.descending !== undefined)
            qs.set("descending", String(params.descending));
        if (params.pageToken)
            qs.set("page_token", params.pageToken);
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/im/messages?${qs}`);
        const data = (await res.json());
        if (data.code !== 200 && data.code !== 0) {
            throw new YachApiError(`[yach-oapi] getMessages error: ${JSON.stringify(data)}`, data.code);
        }
        return {
            messages: data.obj?.messages ?? [],
            hasMore: data.obj?.page_info?.has_more ?? false,
            pageToken: data.obj?.page_info?.page_token ?? "",
        };
    }
    /** 获取群基本信息（POST /group/info，form-urlencoded） */
    async getGroupInfo(groupId) {
        const token = await this.getToken();
        const res = await oapiFetch(`${this.baseUrl}/group/info?access_token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ group_tid: groupId }).toString(),
        });
        const data = (await res.json());
        if ((data.code !== 200 && data.code !== 0) || !data.obj) {
            throw new YachApiError(`[yach-oapi] getGroupInfo error: ${JSON.stringify(data)}`, data.code);
        }
        return data.obj;
    }
    /** 撤回消息（POST /openapi/v2/msg/recall） */
    async recallMessage(params) {
        const { yach_mid } = params;
        const token = await this.getToken();
        log.debug("recallMessage", { yach_mid });
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/msg/recall`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                access_token: token,
                yach_mid,
            }),
        });
        const result = (await res.json());
        if (result.code !== 200) {
            throw new YachApiError(`[yach-oapi] recallMessage error: ${JSON.stringify(result)}\n` +
                `  request: /openapi/v2/msg/recall yach_mid=${yach_mid}`, result.code);
        }
        log.debug("recallMessage ok", { yach_mid });
        return true;
    }
}
//# sourceMappingURL=im.js.map