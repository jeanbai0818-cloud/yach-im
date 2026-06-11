/**
 * 周报草稿纯逻辑（无副作用，可独立单元测试）
 *
 * 这里只放草稿内容的合并、归一、补齐固定结构与结构校验等纯函数；
 * 所有 HTTP / OAuth / client 相关的 IO 编排留在 index.ts。
 * 本文件仅 `import type`，运行时不加载任何外部依赖，便于测试隔离。
 */
// 生成草稿内容项的去重 key，供合并时匹配同一内容块
export function weeklyDraftContentKey(item) {
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
export function mergeContentText(existing, incoming) {
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
export function findExistingWeeklyTemplate(item, existingContent) {
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
export function normalizeIncomingDraftContent(item, existingContent) {
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
export function stripOkrFieldsForNonOkrWeekly(weeklyType, items) {
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
export function mergeDraftContent(existingContent, incomingContent, weeklyType, replaceContent = false) {
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
export function mergeDraftAttachments(existingAttachments, incomingAttachments) {
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
export function requiredDraftContentItems(weeklyType) {
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
export function ensureDraftContentStructure(weeklyType, content) {
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
export function extractFirstValidKrId(content) {
    for (const item of content) {
        if (item.type === "weekly" && item.kr_id !== undefined && item.kr_id !== -1) {
            return item.kr_id;
        }
    }
    return undefined;
}
// 保存前校验草稿结构是否满足各周报类型的固定块约束，返回错误描述或 null
export function validateDraftContentStructure(weeklyType, content) {
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
            // user_thinking 在复盘周报里可有可无（0 或 1 个均可），但不允许重复
            const userThinking = content.filter((i) => i.type === "user_thinking");
            if (userThinking.length > 1)
                return `复盘周报字段重复（user_thinking 出现了 ${userThinking.length} 次，最多 1 次）`;
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
//# sourceMappingURL=draft-logic.js.map