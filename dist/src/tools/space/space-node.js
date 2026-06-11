/**
 * yach_space_node — 知音楼知识库节点工具（user_access_token）
 *
 * import — 导入文件为知识库节点（全流程：COS 上传 + 异步导入 + 轮询）
 */
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
const EXT_TO_MIME = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv": "text/csv",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xmind": "application/octet-stream",
};
const SpaceNodeSchema = Type.Object({
    action: StringEnum(["create", "move", "get_properties", "set_properties", "list", "import", "export"], {
        description: "create 在知识库中新建节点（用户只需要新建一个可编辑的文档/表格/幻灯片/思维导图，无需导入已有内容时使用）；" +
            "get_properties 查看知识库节点的属性（标题/密级/分享模式等）；" +
            "set_properties 修改知识库节点属性（标题/密级/分享模式），合法值以 get_properties 返回的 secret_tag_info 和 share_mode_info 为准；" +
            "list 查询知识库或指定父节点下的子节点列表（支持分页、时间过滤、类型过滤）；" +
            "import 将本地文件或 Markdown 文本内容上传并导入为知识库节点（用户有具体文件或文本内容需要写入时使用）；" +
            "export 导出知识库节点为文件（返回 download_url）",
    }),
    // import — 内容来源二选一
    file_path: Type.Optional(Type.String({
        description: "本地文件路径（与 content 二选一）。支持 txt/md/doc/docx/csv/xls/xlsx/ppt/pptx/xmind",
    })),
    content: Type.Optional(Type.String({
        description: "Markdown 文本内容（与 file_path 二选一，作为 .md 文件导入）",
    })),
    filename: Type.Optional(Type.String({
        description: "文件名含扩展名（必填，如 文档.md、报告.docx），同时作为知识库节点标题",
    })),
    // 目标知识库（二选一）
    kn_space_id: Type.Optional(Type.String({ description: "知识库 ID（与 kn_space_url 二选一）" })),
    kn_space_url: Type.Optional(Type.String({
        description: "知识库 URL（与 kn_space_id 二选一，以 https://st.tal.com 或 https://s.tal.com 开头）",
    })),
    // 父节点（二选一，可选）
    kn_parent_node_id: Type.Optional(Type.String({ description: "父节点 ID（与 kn_parent_node_url 二选一）" })),
    kn_parent_node_url: Type.Optional(Type.String({ description: "父节点 URL（与 kn_parent_node_id 二选一）" })),
    // export — 导出参数
    kn_node_id: Type.Optional(Type.String({
        description: "知识库节点 ID（与 kn_node_url 二选一，export 时必填其一）",
    })),
    kn_node_url: Type.Optional(Type.String({
        description: "知识库节点 URL（与 kn_node_id 二选一，以 https://kn.tal.com 或 https://k.tal.com 开头）",
    })),
    format: Type.Optional(StringEnum(["pdf", "docx", "md", "jpg", "xlsx", "pptx", "jpeg", "xmind"], {
        description: "导出格式（export 时必填）。文档: pdf/docx/jpg/md；表格: xlsx；幻灯片: pptx/pdf；脑图: jpeg/xmind",
    })),
    // properties — 节点属性查询参数
    guid: Type.Optional(Type.String({
        description: "文档 GUID（properties 时三选一：kn_space_id+kn_node_id / guid / kn_node_url）",
    })),
    // create — 新建节点参数
    node_type: Type.Optional(StringEnum(["folder", "doc", "excel", "ppt", "mindmap"], {
        description: "节点类型（create 时必填）：folder 文件夹、doc 文档、excel 表格、ppt 幻灯片、mindmap 思维导图",
    })),
    name: Type.Optional(Type.String({ description: "节点名称（create 时可选）" })),
    // move — 移动节点参数（来源二选一，目标二选一）
    source_node_url: Type.Optional(Type.String({
        description: "来源节点 URL（与 source_topic_id+source_node_id 二选一）",
    })),
    source_topic_id: Type.Optional(Type.String({
        description: "来源知识库 ID（与 source_node_url 二选一，需同时填 source_node_id）",
    })),
    source_node_id: Type.Optional(Type.String({
        description: "来源节点 ID（与 source_node_url 二选一，需同时填 source_topic_id）",
    })),
    target_node_url: Type.Optional(Type.String({
        description: "目标父节点 URL（与 target_topic_id+target_node_id 二选一）",
    })),
    target_topic_id: Type.Optional(Type.String({
        description: "目标知识库 ID（与 target_node_url 二选一，需同时填 target_node_id）",
    })),
    target_node_id: Type.Optional(Type.String({
        description: "目标父节点 ID（与 target_node_url 二选一，需同时填 target_topic_id）",
    })),
    // set_properties — 可修改的属性字段
    title: Type.Optional(Type.String({ description: "节点标题（set_properties 时可选）" })),
    secret_tag: Type.Optional(Type.String({
        description: "密级标签值（set_properties 时可选），取值参考 get_properties 返回的 secret_tag_info[].tag",
    })),
    share_mode: Type.Optional(Type.String({
        description: "分享模式值（set_properties 时可选），取值参考 get_properties 返回的 share_mode_info[].value，需在当前密级允许范围内",
    })),
    // list — 节点列表查询参数
    next_page_token: Type.Optional(Type.String({ description: "分页标记（list 时可选），上一页返回的 next_page_token，首次查询不填" })),
    last_update_time: Type.Optional(Type.Number({ description: "时间过滤（list 时可选），只返回该秒级时间戳之后更新的节点" })),
    list_type: Type.Optional(StringEnum(["folder", "doc", "excel", "form", "ppt", "mindmap", "board", "md", "pdf"], {
        description: "节点类型过滤（list 时可选）：folder 文件夹、doc 文档、excel 表格、form 表单、ppt 幻灯片、mindmap 脑图、board 白板、md Markdown、pdf PDF",
    })),
    page_size: Type.Optional(Type.Number({ description: "每页条数（list 时可选），默认 20，最大 50" })),
});
export function createSpaceNodeTool() {
    return {
        name: "yach_space_node",
        label: "知音楼知识库节点",
        description: "知音楼知识库节点操作（需 OAuth 授权）。" +
            "【优先规则】只要用户意图含「新建/创建/建一个/建个」节点或文档，无论是否提到知识库，都应首先考虑 create action，除非用户明确提到要上传/导入某个文件或粘贴了具体内容。" +
            "create 在知识库中新建节点（folder 文件夹/doc 文档/excel 表格/ppt 幻灯片/mindmap 思维导图），成功后返回节点链接；" +
            "move 将知识库节点移动到另一位置（来源和目标各有两种定位方式）；【严禁】不得用「删除旧节点 + 新建节点」的方式替代 move，必须直接调用 move action；" +
            "get_properties 查看知识库节点属性（标题、创建人、更新时间、密级、分享模式等），节点定位三选一：kn_space_id+kn_node_id / guid / kn_node_url；" +
            "set_properties 修改知识库节点属性（title 标题、secret_tag 密级、share_mode 分享模式，均可选），节点定位三选一同 get_properties，密级和分享模式合法值及约束关系以接口返回的 secret_tag_info / share_mode_info 为准；" +
            "list 查询知识库或指定父节点下的子节点列表（父节点定位二选一：kn_node_id 或 kn_node_url，支持分页/时间过滤/类型过滤）；" +
            "import 导入文件为知识库节点（全流程，完成后返回节点 file_url），" +
            "export 导出知识库节点为文件（文档: pdf/docx/jpg/md；表格: xlsx；幻灯片: pptx/pdf；脑图: jpeg/xmind，完成后返回下载 URL）。",
        parameters: SpaceNodeSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "import": {
                        if (!params.file_path && !params.content) {
                            return jsonResult({
                                ok: false,
                                error: "import: file_path 或 content 必填其一",
                            });
                        }
                        if (!params.filename) {
                            return jsonResult({
                                ok: false,
                                error: "import: filename 为必填（如 文档.md、报告.docx）",
                            });
                        }
                        const result = await client.invoke("yach_space_node_import", async (c) => {
                            let fileBuffer;
                            const filename = params.filename;
                            if (params.file_path) {
                                fileBuffer = await readFile(params.file_path);
                            }
                            else {
                                fileBuffer = Buffer.from(params.content, "utf-8");
                            }
                            const ext = extname(filename).toLowerCase();
                            const nodeType = ext.replace(".", "") || "file";
                            const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream";
                            const cosUrl = await c.cos.upload({
                                filename,
                                data: fileBuffer,
                                contentType,
                                cosType: "file",
                            });
                            const taskId = await c.doc.loreImportAsync({
                                fileUrl: cosUrl,
                                title: filename,
                                nodeType,
                                spaceId: params.kn_space_id,
                                spaceUrl: params.kn_space_url,
                                parentNodeId: params.kn_parent_node_id,
                                parentNodeUrl: params.kn_parent_node_url,
                            });
                            return c.doc.pollLoreImport(taskId, nodeType);
                        }, { as: "user" });
                        return jsonResult(result);
                    }
                    case "export": {
                        if (!params.kn_node_id && !params.kn_node_url) {
                            return jsonResult({
                                ok: false,
                                error: "export: kn_node_id 或 kn_node_url 必填其一",
                            });
                        }
                        if (!params.format) {
                            return jsonResult({
                                ok: false,
                                error: "export: format 导出格式为必填（文档: pdf/docx/jpg/md；表格: xlsx；幻灯片: pptx/pdf；脑图: jpeg/xmind）",
                            });
                        }
                        const result = await client.invoke("yach_space_node_export", async (c) => {
                            const taskId = await c.doc.loreNodeExportAsync({
                                knNodeId: params.kn_node_id,
                                knNodeUrl: params.kn_node_url,
                                format: params.format,
                            });
                            return c.doc.pollLoreNodeExport(taskId);
                        }, { as: "user" });
                        return jsonResult(result);
                    }
                    case "move": {
                        const hasSource = params.source_node_url ||
                            (params.source_topic_id && params.source_node_id);
                        const hasTarget = params.target_node_url ||
                            (params.target_topic_id && params.target_node_id);
                        if (!hasSource) {
                            return jsonResult({
                                ok: false,
                                error: "move: 来源定位必填 — 方案一(source_topic_id + source_node_id) 或 方案二(source_node_url)",
                            });
                        }
                        if (!hasTarget) {
                            return jsonResult({
                                ok: false,
                                error: "move: 目标定位必填 — 方案一(target_topic_id + target_node_id) 或 方案二(target_node_url)",
                            });
                        }
                        const result = await client.invoke("yach_space_node_move", c => c.doc.loreNodeMove({
                            sourceNodeUrl: params.source_node_url,
                            sourceTopicId: params.source_topic_id,
                            sourceNodeId: params.source_node_id,
                            targetNodeUrl: params.target_node_url,
                            targetTopicId: params.target_topic_id,
                            targetNodeId: params.target_node_id,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "get_properties": {
                        const hasLocator = params.guid ||
                            params.kn_node_url ||
                            (params.kn_space_id && params.kn_node_id);
                        if (!hasLocator) {
                            return jsonResult({
                                ok: false,
                                error: "properties: 节点定位三选一 — kn_space_id+kn_node_id / guid / kn_node_url",
                            });
                        }
                        const result = await client.invoke("yach_space_node_get_properties", c => c.doc.loreNodeProperties({
                            topicId: params.kn_space_id,
                            nodeId: params.kn_node_id,
                            guid: params.guid,
                            url: params.kn_node_url,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "create": {
                        if (!params.node_type) {
                            return jsonResult({
                                ok: false,
                                error: "create: node_type 为必填（doc/excel/ppt/mindmap）",
                            });
                        }
                        const hasScheme1 = params.kn_space_id && params.kn_parent_node_id;
                        const hasScheme2 = !!params.kn_parent_node_url;
                        if (!hasScheme1 && !hasScheme2) {
                            return jsonResult({
                                ok: false,
                                error: "create: 请二选一 — 方案一(kn_space_id + kn_parent_node_id) 或 方案二(kn_parent_node_url)",
                            });
                        }
                        const result = await client.invoke("yach_space_node_create", c => c.doc.loreNodeCreate({
                            nodeType: params.node_type,
                            name: params.name,
                            topicId: params.kn_space_id,
                            parentNodeId: params.kn_parent_node_id,
                            parentNodeUrl: params.kn_parent_node_url,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "set_properties": {
                        const hasLocator = params.guid ||
                            params.kn_node_url ||
                            (params.kn_space_id && params.kn_node_id);
                        if (!hasLocator) {
                            return jsonResult({
                                ok: false,
                                error: "set_properties: 节点定位三选一 — kn_space_id+kn_node_id / guid / kn_node_url",
                            });
                        }
                        if (!params.title && !params.secret_tag && !params.share_mode) {
                            return jsonResult({
                                ok: false,
                                error: "set_properties: 至少填写一个要修改的字段（title / secret_tag / share_mode）",
                            });
                        }
                        // 代码强制：修改前必须先查询节点属性，获取动态枚举和约束关系
                        const currentProps = await client.invoke("yach_space_node_get_properties", c => c.doc.loreNodeProperties({
                            topicId: params.kn_space_id,
                            nodeId: params.kn_node_id,
                            guid: params.guid,
                            url: params.kn_node_url,
                        }), { as: "user" });
                        const { secretTagInfo, shareModeInfo } = currentProps;
                        // 校验 secret_tag（如果要修改）
                        if (params.secret_tag) {
                            const validTags = secretTagInfo.map(i => i.tag);
                            if (!validTags.includes(params.secret_tag)) {
                                return jsonResult({
                                    ok: false,
                                    error: `secret_tag "${params.secret_tag}" 不在可用密级列表中，请根据 secret_tag_info 选择合法值`,
                                    secret_tag_info: secretTagInfo,
                                    share_mode_info: shareModeInfo,
                                });
                            }
                        }
                        // 校验 share_mode（如果要修改），以修改后的密级为基准
                        if (params.share_mode) {
                            const effectiveTag = params.secret_tag ?? currentProps.secretTag;
                            const tagInfo = secretTagInfo.find(i => i.tag === effectiveTag);
                            if (tagInfo &&
                                !tagInfo.supportShareMode.includes(params.share_mode)) {
                                return jsonResult({
                                    ok: false,
                                    error: `密级 ${effectiveTag}（${tagInfo.name}）不支持分享模式 "${params.share_mode}"，该密级允许的分享模式为：${tagInfo.supportShareMode.join("、")}`,
                                    secret_tag_info: secretTagInfo,
                                    share_mode_info: shareModeInfo,
                                });
                            }
                        }
                        const result = await client.invoke("yach_space_node_set_properties", c => c.doc.loreNodeSetProperties({
                            topicId: params.kn_space_id,
                            nodeId: params.kn_node_id,
                            guid: params.guid,
                            url: params.kn_node_url,
                            title: params.title,
                            secretTag: params.secret_tag,
                            shareMode: params.share_mode,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "list": {
                        if (!params.kn_node_id && !params.kn_node_url) {
                            return jsonResult({
                                ok: false,
                                error: "list: kn_node_id 或 kn_node_url 必填其一（知识库 ID/URL 或父节点 ID/URL）",
                            });
                        }
                        const result = await client.invoke("yach_space_node_list", (c) => c.doc.loreNodeList({
                            knNodeId: params.kn_node_id,
                            knNodeUrl: params.kn_node_url,
                            nextPageToken: params.next_page_token,
                            lastUpdateTime: params.last_update_time,
                            type: params.list_type,
                            pageSize: params.page_size,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    default:
                        return jsonResult({
                            ok: false,
                            error: `未知 action: ${params.action}`,
                        });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, {
                    toolName: "yach_space_node",
                    action: String(params.action),
                });
            }
        },
    };
}
export function registerSpaceTools(api) {
    api.registerTool(createSpaceNodeTool());
}
//# sourceMappingURL=space-node.js.map