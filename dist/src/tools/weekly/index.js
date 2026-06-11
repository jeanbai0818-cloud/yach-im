/**
 * yach_weekly — 周报工具（user_access_token）
 *
 * 支持 action：list / save_draft
 */
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
const WeeklyDraftContentSchema = Type.Object({
    type: Type.String({ description: "内容类型，如 weekly、user_thinking、experience、introspection、remark" }),
    content: Type.String({ description: "本段周报内容" }),
    cycle: Type.Optional(Type.Number({ description: "weekly 类型周期：1 本周，2 下周" })),
    kr_id: Type.Optional(Type.Number({ description: "OKR 周报关联 KR ID；非 OKR 事项传 -1" })),
    object_id: Type.Optional(Type.Union([Type.Number(), Type.String()], { description: "OKR Objective ID 或其他分类标识" })),
    okr_title: Type.Optional(Type.String({ description: "OKR 目标标题或分类名称" })),
}, {
    additionalProperties: true,
    description: "周报草稿内容项；保存草稿时会按 type/cycle/kr_id/object_id/okr_title 与已有草稿合并，并按周报类型补齐固定段落",
});
const WeeklyDraftAttachmentSchema = Type.Object({
    name: Type.String({ description: "附件名称" }),
    origin_url: Type.String({ description: "附件原始下载/预览链接" }),
}, {
    additionalProperties: true,
    description: "周报附件",
});
const WeeklySchema = Type.Object({
    action: StringEnum(["list", "get_draft", "save_draft"], {
        description: "操作类型：list 查询周报列表；get_draft 读取我的周报草稿；save_draft 保存周报草稿（默认合并追加；传 overwrite=true 覆盖旧草稿；传 replace_content=true 替换匹配块内容）",
    }),
    query_type: Type.Optional(StringEnum(["person", "department", "team_id", "team_name"], {
        description: "筛选类型：person(用户), department(部门), team_id(我的伙伴分组ID), team_name(我的伙伴分组名称)。当此参数存在时，query_value 为必填",
    })),
    query_value: Type.Optional(Type.String({ description: "筛选值。若传了 query_type 则必填。对应：工号/部门ID/分组ID/分组名称" })),
    start_date: Type.Optional(Type.String({ description: "开始日期，格式 YYYY-MM-DD（UTC+0），不传默认前一天。如 2026-04-14" })),
    end_date: Type.Optional(Type.String({ description: "结束日期，格式 YYYY-MM-DD（UTC+0），不传默认今天。如 2026-04-14" })),
    unread: Type.Optional(Type.Boolean({ description: "是否只返回未读。默认为 false（即返回包含已读的所有数据）" })),
    sort: Type.Optional(StringEnum(["asc", "desc"], { description: "排序方式。支持 asc（升序）或 desc（降序，默认）" })),
    next_page: Type.Optional(Type.String({ description: "分页标识，由上一次查询返回" })),
    weekly_type: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)], {
        description: "周报类型（save_draft 必填）：1 普通周报，2 复盘周报，3 OKR 周报",
    })),
    content: Type.Optional(Type.Array(WeeklyDraftContentSchema, {
        description: "本次新增的周报内容（save_draft 必填）。工具会先读取已有草稿，再与此内容合并，并按周报类型补齐固定段落后保存",
    })),
    recipient_change_reason: Type.Optional(Type.String({
        description: "【修改接收设置前必须先填本字段】说明用户本次为什么要修改接收人/接收部门/接收群组。" +
            "理由必须来自用户本轮的明确诉求（例如用户原话包含『把周报发给』『抄送』『接收人改成』『加上部门』等措辞），并在此引用对应关键词。" +
            "如果用户本轮并没有要求改动接收设置，此字段必须留空，且 recipient_fields_allowed_to_change 必须为空数组。",
    })),
    recipient_fields_allowed_to_change: Type.Optional(Type.Array(StringEnum(["receive_work_codes", "receive_og_ids", "receive_groups"]), {
        description: "用户明确授权本次可修改的接收设置字段清单（receive_work_codes=接收人工号，receive_og_ids=接收部门，receive_groups=接收群组）。" +
            "只有列入此数组的字段，对应入参才会生效；未列入的字段一律沿用旧草稿、绝不改动。" +
            "必须先在 recipient_change_reason 写明用户诉求后再填本字段；若 recipient_change_reason 为空，本字段必须为空数组。",
    })),
    receive_work_codes: Type.Optional(Type.Array(Type.String(), { description: "除默认接收人以外的接收人工号。仅当 receive_work_codes 列入 recipient_fields_allowed_to_change 时才会被采用" })),
    receive_og_ids: Type.Optional(Type.Array(Type.String(), { description: "接收部门 ID。仅当 receive_og_ids 列入 recipient_fields_allowed_to_change 时才会被采用" })),
    receive_groups: Type.Optional(Type.Array(Type.String(), { description: "接收群组 ID。仅当 receive_groups 列入 recipient_fields_allowed_to_change 时才会被采用" })),
    is_send_group: Type.Optional(Type.Boolean({ description: "是否推送到群聊，receive_groups 不为空时生效，默认 false" })),
    attachment: Type.Optional(Type.Array(WeeklyDraftAttachmentSchema, { description: "本次新增附件，会与已有草稿附件合并去重" })),
    replace_content: Type.Optional(Type.Boolean({ description: "仅 save_draft 有效。默认 false（合并追加）；传 true 时匹配到的旧草稿内容块会被新内容整体替换，而非追加。仅在用户明确要求修改某块旧内容时才传 true" })),
    overwrite: Type.Optional(Type.Boolean({ description: "仅 save_draft 有效。默认 false；传 true 时不读取旧草稿，直接用新内容整体覆盖保存。仅在用户明确表达全部重新写、不要旧草稿时才传 true" })),
});
// 生成草稿内容项的去重 key，供合并时匹配同一内容块
function weeklyDraftContentKey(item) {
    // OKR/其他工作块由左侧选择产生，同一 KR 下只区分本周/下周，避免因标题等元信息不同重复建块。
    if (item.type === "weekly" && item.kr_id !== undefined) {
        return [item.type, item.cycle ?? "", item.kr_id].join("|");
    }
    // cycle 只对 type=weekly 有意义；底部固定段落（user_thinking/experience 等）忽略 cycle，
    // 防止 AI 误传 cycle 导致与 ensureDraftContentStructure 补出的无 cycle 项 key 不同而重复建块。
    const cycle = item.type === "weekly" ? (item.cycle ?? "") : "";
    return [
        item.type,
        cycle,
        item.kr_id ?? "",
        item.object_id ?? "",
        item.okr_title ?? "",
    ].join("|");
}
// 将新文本追加到已有文本，完全重复时跳过追加
function mergeContentText(existing, incoming) {
    // 同一块重复保存时只追加新增文本，避免把完全相同的内容写两遍。
    if (!existing)
        return incoming ?? "";
    if (!incoming)
        return existing;
    const trimmedExisting = existing.trimEnd();
    const trimmedIncoming = incoming.trimStart();
    // 基于 trim 后内容判断重复，避免因边界换行差异漏判。
    if (trimmedExisting.includes(trimmedIncoming))
        return existing;
    return `${trimmedExisting}\n\n${trimmedIncoming}`;
}
// 在已有草稿中找与入参 weekly 块匹配的模板项，用于对齐 kr_id / object_id 等元信息
function findExistingWeeklyTemplate(item, existingContent) {
    if (item.type !== "weekly")
        return undefined;
    const sameCycle = (candidate) => item.cycle === undefined || candidate.cycle === item.cycle;
    // 归类语义由大模型完成；工具层只按明确 ID 对齐已有草稿结构，避免代码猜测归属。
    if (item.kr_id !== undefined && item.kr_id !== -1) {
        const byKrId = existingContent.find((candidate) => candidate.type === "weekly" &&
            candidate.kr_id === item.kr_id &&
            sameCycle(candidate));
        if (byKrId)
            return byKrId;
    }
    if (item.object_id !== undefined) {
        const byObjectId = existingContent.find((candidate) => candidate.type === "weekly" &&
            candidate.object_id === item.object_id &&
            sameCycle(candidate));
        if (byObjectId)
            return byObjectId;
    }
    // kr_id=-1 是明确的“其他工作”，只在没有 KR/object_id 时作为兜底匹配。
    if (item.kr_id !== undefined) {
        return existingContent.find((candidate) => candidate.type === "weekly" &&
            candidate.kr_id === item.kr_id &&
            sameCycle(candidate));
    }
    return undefined;
}
// 将入参内容块与已有草稿对齐：用草稿中的 kr_id / object_id / okr_title 覆盖入参，防止 AI 自行填写元信息
function normalizeIncomingDraftContent(item, existingContent) {
    const template = findExistingWeeklyTemplate(item, existingContent);
    // okr_title 只能来自已读取到的草稿结构；入参中的标题只用于匹配，不直接写入。
    const { okr_title: _ignoredOkrTitle, ...normalized } = item;
    if (template) {
        return {
            ...template,
            ...normalized,
            kr_id: template.kr_id,
            object_id: template.object_id,
            okr_title: template.okr_title,
        };
    }
    return normalized;
}
// 非 OKR 周报的 weekly 块不应携带 OKR 维度字段，防止产生与固定块 key 不同的重复块
function stripOkrFieldsForNonOkrWeekly(weeklyType, items) {
    // 普通/复盘周报的 weekly 块不含 OKR 维度；AI 误传 kr_id 等字段会导致 key 与
    // ensureDraftContentStructure 补出的固定块不同，产生重复的本周/下周块。
    if (weeklyType === 3)
        return items;
    return items.map((item) => {
        if (item.type !== "weekly")
            return item;
        const { kr_id: _kr, object_id: _oid, okr_title: _okr, ...rest } = item;
        return rest;
    });
}
// 将新增内容与已有草稿合并；replaceContent=true 时替换匹配块，否则追加
function mergeDraftContent(existingContent, incomingContent, weeklyType, replaceContent = false) {
    // 先以当前草稿为底，再把本次新增内容合并进去，保证未触碰的旧内容不丢。
    const merged = [...(existingContent ?? [])];
    const indexByKey = new Map();
    for (const [index, item] of merged.entries()) {
        indexByKey.set(weeklyDraftContentKey(item), index);
    }
    const normalizedIncoming = stripOkrFieldsForNonOkrWeekly(weeklyType, incomingContent);
    for (const rawItem of normalizedIncoming) {
        const item = normalizeIncomingDraftContent(rawItem, existingContent ?? []);
        const key = weeklyDraftContentKey(item);
        const existingIndex = indexByKey.get(key);
        if (existingIndex === undefined) {
            indexByKey.set(key, merged.length);
            merged.push(item);
            continue;
        }
        const existing = merged[existingIndex];
        merged[existingIndex] = {
            ...existing,
            ...item,
            content: replaceContent ? (item.content ?? existing.content) : mergeContentText(existing.content, item.content),
        };
    }
    return merged;
}
// 合并附件列表，按文件名 + 原始链接去重
function mergeDraftAttachments(existingAttachments, incomingAttachments) {
    // 附件没有稳定 ID，按文件名和原始链接做轻量去重。
    if (!incomingAttachments)
        return existingAttachments;
    const merged = [...(existingAttachments ?? [])];
    const seen = new Set(merged.map((item) => `${item.name}|${item.origin_url}`));
    for (const item of incomingAttachments) {
        const key = `${item.name}|${item.origin_url}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        merged.push(item);
    }
    return merged;
}
// 返回各周报类型的固定必填块模板，用于补齐草稿结构
function requiredDraftContentItems(weeklyType) {
    // 不同周报类型有固定底部字段；即使为空也要保留，避免保存后页面缺输入区。
    switch (weeklyType) {
        case 1:
            return [
                { type: "weekly", cycle: 1, content: "" },
                { type: "weekly", cycle: 2, content: "" },
                { type: "user_thinking", content: "" },
                { type: "experience", content: "" },
                { type: "introspection", content: "" },
                { type: "remark", content: "" },
            ];
        case 2:
            return [
                { type: "weekly", cycle: 1, content: "" },
                { type: "user_thinking", content: "" },
            ];
        case 3:
            return [
                { type: "user_thinking", content: "" },
                { type: "experience", content: "" },
                { type: "introspection", content: "" },
                { type: "remark", content: "" },
            ];
    }
}
// 补齐草稿中缺失的固定结构块，已存在的块不重复插入
function ensureDraftContentStructure(weeklyType, content) {
    // 只补齐固定结构；OKR 的 KR 内容块依赖左侧选择，不能在这里凭空创建。
    const normalized = [...content];
    const existingKeys = new Set(normalized.map(weeklyDraftContentKey));
    for (const item of requiredDraftContentItems(weeklyType)) {
        const key = weeklyDraftContentKey(item);
        if (!existingKeys.has(key)) {
            existingKeys.add(key);
            normalized.push(item);
        }
    }
    return normalized;
}
// 从草稿 content 中提取第一个有效 kr_id（排除 -1 和不存在的情况）
function extractFirstValidKrId(content) {
    for (const item of content) {
        if (item.type === "weekly" && item.kr_id !== undefined && item.kr_id !== -1) {
            return item.kr_id;
        }
    }
    return undefined;
}
// OKR 周报专用：读取草稿后查 OKR 详情作为后续写周报的依据。
// 优先用草稿中已有的 kr_id 定位 OKR；草稿无有效 kr_id 时用 current=true 查当前季度 OKR。
async function fetchOkrDetailForWeekly(c, draftContent) {
    const krId = extractFirstValidKrId(draftContent);
    const detail = await c.okr.getDetail(krId !== undefined ? { kr_id: krId } : { current: true });
    return detail.content ?? null;
}
// 保存前校验草稿结构是否满足各周报类型的固定块约束，返回错误描述或 null
function validateDraftContentStructure(weeklyType, content) {
    switch (weeklyType) {
        case 1: {
            const cycle1 = content.filter((i) => i.type === "weekly" && i.cycle === 1);
            const cycle2 = content.filter((i) => i.type === "weekly" && i.cycle === 2);
            if (cycle1.length !== 1)
                return `普通周报本周内容块数量有误（应为 1，实际 ${cycle1.length}）`;
            if (cycle2.length !== 1)
                return `普通周报下周内容块数量有误（应为 1，实际 ${cycle2.length}）`;
            for (const type of ["user_thinking", "experience", "introspection", "remark"]) {
                const count = content.filter((i) => i.type === type).length;
                if (count === 0)
                    return `普通周报缺少必要字段：${type}`;
                if (count > 1)
                    return `普通周报字段重复（${type} 出现了 ${count} 次，应为 1 次）`;
            }
            return null;
        }
        case 2: {
            const cycle1 = content.filter((i) => i.type === "weekly" && i.cycle === 1);
            if (cycle1.length !== 1)
                return `复盘周报本周复盘块数量有误（应为 1，实际 ${cycle1.length}）`;
            return null;
        }
        case 3: {
            for (const type of ["user_thinking", "experience", "introspection", "remark"]) {
                const count = content.filter((i) => i.type === type).length;
                if (count === 0)
                    return `OKR 周报缺少必要底部字段：${type}`;
                if (count > 1)
                    return `OKR 周报底部字段重复（${type} 出现了 ${count} 次，应为 1 次）`;
            }
            return null;
        }
    }
}
// 解析最终接收人/部门/群组：只有在用户明确授权（理由非空 + 字段列入白名单）时才采用入参，否则一律沿用旧草稿。
// 防止大模型在修改/覆盖正文时擅自删改接收设置；理由为空时白名单视为无效，全部回退旧草稿。
function resolveRecipientFields(params, currentDraft) {
    // 理由为空 → 视为用户未授权任何改动，白名单强制清空。
    const hasReason = !!params.recipient_change_reason && params.recipient_change_reason.trim().length > 0;
    const allowed = new Set(hasReason ? (params.recipient_fields_allowed_to_change ?? []) : []);
    return {
        receive_work_codes: allowed.has("receive_work_codes") ? params.receive_work_codes : currentDraft.receive_work_codes,
        receive_og_ids: allowed.has("receive_og_ids") ? params.receive_og_ids : currentDraft.receive_og_ids,
        receive_groups: allowed.has("receive_groups") ? params.receive_groups : currentDraft.receive_groups,
    };
}
// 创建 yach_weekly 工具定义，包含 list / get_draft / save_draft 三个 action
export function createWeeklyTool() {
    return {
        name: "yach_weekly",
        label: "知音楼周报",
        description: "知音楼周报（以当前用户身份操作，需 OAuth 授权）：" +
            "list 查询周报列表，支持按用户、部门、伙伴分组筛选，支持日期范围、未读筛选、排序和分页；" +
            "get_draft 读取我的周报草稿，返回当前草稿内容（不做任何修改）；" +
            "save_draft 保存周报草稿，默认先读旧草稿再合并新内容；传 replace_content=true 可替换匹配块内容；传 overwrite=true 可跳过读旧草稿直接覆盖。",
        parameters: WeeklySchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            // ========== 参数校验 ==========
            // 校验 1：query_type 存在时，query_value 必须填写
            if (params.query_type && !params.query_value) {
                return jsonResult({
                    ok: false,
                    error: `参数错误：query_type="${params.query_type}" 时，query_value 为必填参数`,
                    hint: "正确用法：query_type=person&query_value=167680",
                });
            }
            // 校验 2：日期格式校验 (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (params.start_date && !dateRegex.test(params.start_date)) {
                return jsonResult({
                    ok: false,
                    error: `参数错误：start_date 格式错误 "${params.start_date}"`,
                    hint: "正确格式：YYYY-MM-DD，如 2026-04-14",
                });
            }
            if (params.end_date && !dateRegex.test(params.end_date)) {
                return jsonResult({
                    ok: false,
                    error: `参数错误：end_date 格式错误 "${params.end_date}"`,
                    hint: "正确格式：YYYY-MM-DD，如 2026-04-14",
                });
            }
            // ========== 业务逻辑 ==========
            try {
                switch (params.action) {
                    case "list": {
                        const result = await client.invoke("yach_weekly_list", (c) => c.weekly.list({
                            query_type: params.query_type,
                            query_value: params.query_value,
                            start_date: params.start_date,
                            end_date: params.end_date,
                            unread: params.unread,
                            sort: params.sort,
                            next_page: params.next_page,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "get_draft": {
                        if (!params.weekly_type) {
                            return jsonResult({ ok: false, error: "请指定要查看的周报类型：1=普通周报，2=复盘周报，3=OKR 周报" });
                        }
                        const result = await client.invoke("yach_weekly_draft_get", (c) => c.weekly.getDraft(params.weekly_type), { as: "user" });
                        return jsonResult(result);
                    }
                    case "save_draft": {
                        if (!params.weekly_type) {
                            return jsonResult({ ok: false, error: "请指定要保存的周报类型：1=普通周报，2=复盘周报，3=OKR 周报" });
                        }
                        // 覆盖模式必须提供 content；合并模式下 content 可不传（仅更新接收人/附件等字段时）
                        if (params.overwrite && (!params.content || params.content.length === 0)) {
                            return jsonResult({ ok: false, error: "全量覆盖保存时必须提供周报正文内容" });
                        }
                        const result = await client.invoke("yach_weekly_draft_save", async (c) => {
                            let finalDraft;
                            let okrDetail = null;
                            // 所有模式都先读旧草稿：用于接收人字段保护（未授权字段一律沿用旧草稿）
                            const currentDraft = await c.weekly.getDraft(params.weekly_type);
                            const recipients = resolveRecipientFields(params, currentDraft);
                            if (params.overwrite) {
                                // 覆盖模式：先查 OKR（用入参内容中的 kr_id 或 current=true），再构建草稿
                                if (params.weekly_type === 3) {
                                    okrDetail = await fetchOkrDetailForWeekly(c, params.content);
                                    if (!okrDetail) {
                                        return { ok: false, error: "未查询到 OKR，请先创建 OKR 后再编辑 OKR 周报" };
                                    }
                                }
                                const normalizedContent = stripOkrFieldsForNonOkrWeekly(params.weekly_type, params.content);
                                finalDraft = {
                                    weekly_type: params.weekly_type,
                                    receive_work_codes: recipients.receive_work_codes,
                                    receive_og_ids: recipients.receive_og_ids,
                                    receive_groups: recipients.receive_groups,
                                    is_send_group: params.is_send_group ?? currentDraft.is_send_group,
                                    content: ensureDraftContentStructure(params.weekly_type, normalizedContent),
                                    attachment: params.attachment,
                                };
                            }
                            else {
                                // 默认合并模式：用旧草稿的 kr_id 查 OKR，再合并
                                if (params.weekly_type === 3) {
                                    okrDetail = await fetchOkrDetailForWeekly(c, currentDraft.content);
                                    if (!okrDetail) {
                                        return { ok: false, error: "未查询到 OKR，请先创建 OKR 后再编辑 OKR 周报" };
                                    }
                                }
                                // content 未传时直接沿用旧草稿内容，避免 AI 重传已有内容导致误合并
                                const baseContent = (params.content && params.content.length > 0)
                                    ? mergeDraftContent(currentDraft.content, params.content, params.weekly_type, params.replace_content ?? false)
                                    : (currentDraft.content ?? []);
                                finalDraft = {
                                    ...currentDraft,
                                    weekly_type: params.weekly_type,
                                    receive_work_codes: recipients.receive_work_codes,
                                    receive_og_ids: recipients.receive_og_ids,
                                    receive_groups: recipients.receive_groups,
                                    is_send_group: params.is_send_group ?? currentDraft.is_send_group,
                                    content: ensureDraftContentStructure(params.weekly_type, baseContent),
                                    attachment: mergeDraftAttachments(currentDraft.attachment, params.attachment),
                                };
                            }
                            const structureError = validateDraftContentStructure(params.weekly_type, finalDraft.content);
                            if (structureError)
                                return { ok: false, error: structureError };
                            await c.weekly.saveDraft(finalDraft);
                            if (okrDetail) {
                                return {
                                    ok: true,
                                    weekly_type: finalDraft.weekly_type,
                                    content: finalDraft.content,
                                    attachment: finalDraft.attachment,
                                    okr: okrDetail.okr,
                                };
                            }
                            return {
                                ok: true,
                                weekly_type: finalDraft.weekly_type,
                                content: finalDraft.content,
                                attachment: finalDraft.attachment,
                            };
                        }, { as: "user" });
                        return jsonResult(result);
                    }
                    default:
                        return jsonResult({ ok: false, error: `不支持的操作类型：${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_weekly", action: String(params.action) });
            }
        },
    };
}
// 向插件 API 注册周报工具
export function registerWeeklyTools(api) {
    api.registerTool(createWeeklyTool());
}
//# sourceMappingURL=index.js.map