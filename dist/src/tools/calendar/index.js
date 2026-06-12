/**
 * yach_calendar — 日历工具（user_access_token）
 *
 * 支持 action：list / detail / create / update / cancel
 * 时间均为 ISO 8601 / RFC 3339 格式（含时区），例如 '2024-01-01T00:00:00+08:00'；参与人传用户 ID，多个逗号分隔。
 * list 支持按工号筛选日程（work_code 参数，最多10个工号）。当指定 work_code 查询他人日程时，has_self 默认为 0（不包含自己）。
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum, isoToUnix } from "../helpers.js";
import { yachLogger } from "../../core/yach-logger.js";
const log = yachLogger("calendar");
/**
 * 将 Unix 时间戳转换为可读的时间字符串
 * @param unixTime - Unix 时间戳（秒）
 * @param timezone - 时区，默认为 Asia/Shanghai
 * @returns 格式化的时间字符串，如 "2025/1/18 10:00:00"
 */
function unixToReadableString(unixTime, timezone = "Asia/Shanghai") {
    return new Date(unixTime * 1000).toLocaleString("zh-CN", {
        timeZone: timezone,
        hour12: false,
    });
}
const CalendarSchema = Type.Object({
    action: StringEnum(["list", "detail", "create", "update", "cancel"], {
        description: "操作类型：list 查询列表；detail 获取详情；create 创建；update 修改；cancel 取消",
    }),
    // list
    start_time: Type.Optional(Type.String({ description: "查询/日程开始时间，ISO 8601 / RFC 3339 格式含时区，例如 '2024-01-01T00:00:00+08:00'（list/create/update 必填）" })),
    end_time: Type.Optional(Type.String({ description: "查询/日程结束时间，ISO 8601 / RFC 3339 格式含时区，例如 '2024-01-01T23:59:59+08:00'（list/create/update 必填）" })),
    has_cancel: Type.Optional(Type.Number({ description: "是否包含已取消日程（1=包含 0=不包含，list 可选）" })),
    has_refuse: Type.Optional(Type.Number({ description: "是否包含已拒绝日程（1=包含 0=不包含，list 可选）" })),
    has_self: Type.Optional(Type.Number({ description: "是否包含自己的日程（1=包含 0=不包含，list 可选，默认值：指定 work_code 时为0，否则为1）" })),
    work_code: Type.Optional(Type.Array(Type.String({
        description: "工号数组，最多10个，用于筛选指定人员的日程（list 可选）",
    }), {
        maxItems: 10,
    })),
    // detail / update / cancel
    schedule_id: Type.Optional(Type.String({ description: "日程 ID（detail/update/cancel 必填）" })),
    // create / update
    title: Type.Optional(Type.String({ description: "日程标题（create 必填）" })),
    participant: Type.Optional(Type.String({ description: "参与人用户 ID，多个用英文逗号分隔" })),
    remark: Type.Optional(Type.String({ description: "日程描述" })),
    address: Type.Optional(Type.String({ description: "日程地点（不填默认线上，无需传此字段）" })),
    visibility: Type.Optional(Type.Number({ description: "可见性：1=公开（默认）2=私密" })),
    timezone: Type.Optional(Type.String({ description: "时区，如 Asia/Shanghai（默认）" })),
    is_full: Type.Optional(Type.Number({ description: "是否全天日程：0=否 1=是" })),
    scope: Type.Optional(Type.Number({ description: "修改/取消范围：0=全部 1=仅本次 2=本次及以后（update/cancel 可选）" })),
    remind_time: Type.Optional(Type.String({ description: "提醒时间，逗号分隔整数（create/update 可选，默认 '300' 即5分钟前）：-1=不提醒，0=开始时提醒，180=3分钟前，300=5分钟前，900=15分钟前，1800=30分钟前，3600=1小时前，86400=1天前，604800=1周前" })),
    repeat: Type.Optional(Type.Number({ description: "重复类型（create/update 可选）：0=不重复，1=按日，2=按周，3=按月，4=按年" })),
    repeat_end_time: Type.Optional(Type.String({ description: "重复结束时间，ISO 8601 / RFC 3339 格式含时区，例如 '2024-12-31T23:59:59+08:00'；不填或填 '0' 表示不限（create/update 可选）" })),
    repeat_custom: Type.Optional(Type.Object({
        freq: Type.Number({ description: "重复频率：1=按日 2=按周 3=按月 4=按年" }),
        interval: Type.Number({ description: "重复间隔（按日/周最大30，按月/年最大10）" }),
        values: Type.String({ description: "按日固定填 '1'；按周填星期几逗号分隔（1=周一…7=周日）；按月填日期逗号分隔（如 '23,24,25'）" }),
        until: Type.Number({ description: "重复次数上限，0=不限（结束时间由 repeat_end_time 决定）" }),
    }, { description: "自定义重复规则（设置 repeat 时填写）" })),
    // cancel
    reason: Type.Optional(Type.String({ description: "取消原因（cancel 可选，不传则静默取消）" })),
    confirm_risk: Type.Optional(Type.Boolean({ description: "创建/修改/取消日程为高风险操作，必须显式传 true 才执行" })),
});
export function createCalendarTool() {
    return {
        name: "yach_calendar",
        label: "知音楼日历",
        description: "知音楼日历（以当前用户身份操作，需 OAuth 授权）：" +
            "list 查询日程列表（支持按工号筛选，最多10个工号）；detail 获取日程详情；create 创建日程；update 修改日程；cancel 取消日程。" +
            "时间参数均为 ISO 8601 / RFC 3339 格式（含时区），例如 '2024-01-01T00:00:00+08:00'；participant 填用户 ID，不接受工号。",
        parameters: CalendarSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const toUnix = (iso) => iso !== undefined ? isoToUnix(iso) : undefined;
            const repeatEndUnix = (iso) => iso === undefined || iso === "0" ? 0 : isoToUnix(iso);
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "list": {
                        if (!params.start_time || !params.end_time) {
                            return jsonResult({ ok: false, error: "list: start_time、end_time 为必填" });
                        }
                        // 验证 work_code 参数
                        if (params.work_code && params.work_code.length > 10) {
                            return jsonResult({ ok: false, error: "list: work_code 数量不能超过10个" });
                        }
                        // 智能判断 has_self 默认值：查询其他人日程时默认不包含自己
                        const hasSelfDefault = params.work_code && params.work_code.length > 0 ? 0 : 1;
                        const result = await client.invoke("yach_calendar_list", (c) => c.calendar.listSchedules({
                            start_time: isoToUnix(params.start_time),
                            end_time: isoToUnix(params.end_time),
                            has_cancel: params.has_cancel,
                            has_refuse: params.has_refuse,
                            has_self: params.has_self ?? hasSelfDefault,
                            work_code: params.work_code,
                        }), { as: "user" });
                        // 把 Unix 时间戳（秒）转成可读时间字符串，避免模型误换算
                        if (result?.list) {
                            result.list = result.list.map((event) => ({
                                ...event,
                                begin_time_str: unixToReadableString(event.begin_time),
                                finish_time_str: unixToReadableString(event.finish_time),
                            }));
                        }
                        return jsonResult(result);
                    }
                    case "detail": {
                        if (!params.schedule_id) {
                            return jsonResult({ ok: false, error: "detail: schedule_id 为必填" });
                        }
                        const event = await client.invoke("yach_calendar_detail", (c) => c.calendar.getSchedule(params.schedule_id), { as: "user" });
                        log.info("yach_calendar_detail result", event);
                        if (event?.begin_time != null) {
                            event.begin_time_str = unixToReadableString(event.begin_time);
                        }
                        if (event?.finish_time != null) {
                            event.finish_time_str = unixToReadableString(event.finish_time);
                        }
                        return jsonResult(event);
                    }
                    case "create": {
                        if (!params.title || !params.start_time || !params.end_time) {
                            return jsonResult({ ok: false, error: "create: title、start_time、end_time 为必填" });
                        }
                        if (params.confirm_risk !== true) {
                            return jsonResult({ ok: false, error: "create: 创建日程为高风险操作。请显式传 confirm_risk=true 进行确认。" });
                        }
                        const result = await client.invoke("yach_calendar_create", (c) => c.calendar.createSchedule({
                            title: params.title,
                            start_time: isoToUnix(params.start_time),
                            end_time: isoToUnix(params.end_time),
                            participant: params.participant,
                            remark: params.remark,
                            address: params.address,
                            visibility: params.visibility,
                            timezone: params.timezone,
                            is_full: params.is_full,
                            remind_time: params.remind_time ?? "300",
                            repeat: params.repeat,
                            repeat_end_time: repeatEndUnix(params.repeat_end_time),
                            repeat_custom: params.repeat_custom,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "update": {
                        if (!params.schedule_id) {
                            return jsonResult({ ok: false, error: "update: schedule_id 为必填" });
                        }
                        if (params.confirm_risk !== true) {
                            return jsonResult({ ok: false, error: "update: 修改日程为高风险操作。请显式传 confirm_risk=true 进行确认。" });
                        }
                        const result = await client.invoke("yach_calendar_update", (c) => c.calendar.updateSchedule({
                            schedule_id: params.schedule_id,
                            title: params.title,
                            start_time: toUnix(params.start_time),
                            end_time: toUnix(params.end_time),
                            participant: params.participant,
                            remark: params.remark,
                            address: params.address,
                            visibility: params.visibility,
                            timezone: params.timezone,
                            is_full: params.is_full,
                            scope: params.scope,
                            remind_time: params.remind_time,
                            repeat: params.repeat,
                            repeat_end_time: params.repeat_end_time !== undefined ? repeatEndUnix(params.repeat_end_time) : undefined,
                            repeat_custom: params.repeat_custom,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "cancel": {
                        if (!params.schedule_id) {
                            return jsonResult({ ok: false, error: "cancel: schedule_id 为必填" });
                        }
                        if (params.confirm_risk !== true) {
                            return jsonResult({ ok: false, error: "cancel: 取消日程为高风险操作。请显式传 confirm_risk=true 进行确认。" });
                        }
                        await client.invoke("yach_calendar_cancel", (c) => c.calendar.cancelSchedule({
                            schedule_id: params.schedule_id,
                            scope: params.scope ?? 1,
                            reason: params.reason,
                        }), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_calendar", action: String(params.action) });
            }
        },
    };
}
export function registerCalendarTools(api) {
    api.registerTool(createCalendarTool());
}
//# sourceMappingURL=index.js.map