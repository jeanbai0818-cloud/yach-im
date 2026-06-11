/**
 * 文档工具（user_access_token）
 *
 * yach_doc_summarize — 文档读取/总结（独立文件）
 *   读取文档内容，支持直接读取或导出后解析
 *
 * yach_doc_file — 文档文件操作（全流程封装）
 *   create_blank / import（含 COS 上传 + 轮询）/ export（含轮询）
 *
 * yach_doc_admin — 文档权限管理
 *   add_writer / add_admin
 *
 * yach_doc_append — 文档内容追加
 *   向文档末尾追加内容
 */
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
import { createDocSummarizeTool } from "./summarize.js";
// ── yach_doc_append ──────────────────────────────────────────────────────
const DocAppendSchema = Type.Object({
    file_url: Type.Optional(Type.String({ description: "文档链接（file_url / guid / kn_node_id 三选一）" })),
    guid: Type.Optional(Type.String({ description: "文档 guid" })),
    kn_node_id: Type.Optional(Type.String({ description: "知识库节点 ID" })),
    content: Type.String({ description: "要追加的内容" }),
});
export function createDocAppendTool() {
    return {
        name: "yach_doc_append",
        label: "知音楼文档追加内容",
        description: "向知音楼文档末尾追加内容（需 OAuth 授权）。" +
            "通过 file_url / guid / kn_node_id 定位文档或知识库节点。",
        parameters: DocAppendSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            const loc = { fileUrl: params.file_url, guid: params.guid, knNodeId: params.kn_node_id };
            try {
                await client.invoke("yach_doc_append", (c) => c.doc.append({ ...loc, content: params.content }), { as: "user" });
                return jsonResult({ ok: true });
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_doc_append" });
            }
        },
    };
}
// ── 扩展名 → 导入类型映射 ──────────────────────────────────────────────────
const EXT_TO_DOC_TYPE = {
    ".txt": "newdoc", ".md": "newdoc", ".doc": "newdoc", ".docx": "newdoc",
    ".csv": "mosheet", ".xls": "mosheet", ".xlsx": "mosheet",
    ".ppt": "presentation", ".pptx": "presentation",
    ".xmind": "mindmap",
};
const EXT_TO_MIME = {
    ".txt": "text/plain", ".md": "text/markdown",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv": "text/csv",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xmind": "application/octet-stream",
};
// ── yach_doc_file ─────────────────────────────────────────────────────────
const DocFileSchema = Type.Object({
    action: StringEnum(["create_blank", "import", "export"], {
        description: "create_blank 创建空白文档；import 导入文件为文档（全流程）；export 导出文档（全流程）",
    }),
    // create_blank
    name: Type.Optional(Type.String({ description: "文档名称（create_blank 可选）" })),
    doc_type: Type.Optional(StringEnum(["newdoc", "mosheet", "presentation", "mindmap", "form", "board", "folder"], { description: "文档类型（create_blank 必填）" })),
    parent_node_id: Type.Optional(Type.String({ description: "父目录 folder guid（create_blank/import 可选）" })),
    // import — 内容来源二选一
    file_path: Type.Optional(Type.String({ description: "本地文件路径（import 时与 content 二选一）。支持 txt/md/doc/docx/csv/xls/xlsx/ppt/pptx/xmind" })),
    content: Type.Optional(Type.String({ description: "Markdown 文本内容（import 时与 file_path 二选一，作为 .md 文件导入）" })),
    filename: Type.Optional(Type.String({ description: "原始文件名含扩展名（import 必填，如 周报.md、报告.docx）" })),
    // export
    file_url: Type.Optional(Type.String({ description: "文档链接（export 必填）" })),
    format: Type.Optional(StringEnum(["pdf", "docx", "md", "jpg", "xlsx", "pptx", "jpeg", "xmind"], { description: "导出格式（export 必填）。文档: pdf/docx/jpg/md；表格: xlsx；幻灯片: pptx/pdf；脑图: jpeg/xmind" })),
});
export function createDocFileTool() {
    return {
        name: "yach_doc_file",
        label: "知音楼文档文件操作",
        description: "知音楼文档文件操作（需 OAuth 授权）：" +
            "create_blank 创建空白文档；" +
            "import 导入文件为文档（全流程，完成后返回文档链接）；" +
            "export 导出文档（完成后返回下载链接）。",
        parameters: DocFileSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "create_blank": {
                        if (!params.doc_type) {
                            return jsonResult({ ok: false, error: "create_blank: doc_type 为必填" });
                        }
                        const result = await client.invoke("yach_doc_file_create", (c) => c.doc.createBlank({
                            name: params.name,
                            type: params.doc_type,
                            folder: params.parent_node_id,
                        }), { as: "user" });
                        return jsonResult(result);
                    }
                    case "import": {
                        if (!params.file_path && !params.content) {
                            return jsonResult({ ok: false, error: "import: file_path 或 content 必填其一" });
                        }
                        const result = await client.invoke("yach_doc_import", async (c) => {
                            let fileBuffer;
                            let filename;
                            if (!params.filename) {
                                throw new Error("import: filename 为必填（如 周报.md、报告.xlsx）");
                            }
                            filename = params.filename;
                            if (params.file_path) {
                                fileBuffer = await readFile(params.file_path);
                            }
                            else {
                                fileBuffer = Buffer.from(params.content, "utf-8");
                            }
                            const ext = extname(filename).toLowerCase();
                            const docType = EXT_TO_DOC_TYPE[ext];
                            if (!docType) {
                                throw new Error(`不支持的文件类型: ${ext}，支持 txt/md/doc/docx/csv/xls/xlsx/ppt/pptx/xmind`);
                            }
                            const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream";
                            const cosUrl = await c.cos.upload({ filename, data: fileBuffer, contentType, cosType: "file" });
                            const taskId = await c.doc.importAsync({ cosUrl, type: docType, folder: params.parent_node_id });
                            return c.doc.pollImport(taskId);
                        }, { as: "user" });
                        return jsonResult(result);
                    }
                    case "export": {
                        if (!params.file_url || !params.format) {
                            return jsonResult({ ok: false, error: "export: file_url、format 导出格式为必填（文档: pdf/docx/jpg/md；表格: xlsx；幻灯片: pptx/pdf；脑图: jpeg/xmind）" });
                        }
                        const result = await client.invoke("yach_doc_export", async (c) => {
                            const taskId = await c.doc.exportAsync(params.file_url, params.format);
                            return c.doc.queryExportProgress(taskId);
                        }, { as: "user" });
                        return jsonResult(result);
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_doc_file", action: String(params.action) });
            }
        },
    };
}
// ── yach_doc_admin ────────────────────────────────────────────────────────
const DocAdminSchema = Type.Object({
    action: StringEnum(["add_collaborator", "add_admin", "remove_collaborator", "remove_admin"], {
        description: "add_collaborator 添加协作者（可指定角色）；add_admin 添加管理员；remove_collaborator 移除协作者；remove_admin 移除管理员",
    }),
    file_url: Type.Optional(Type.String({ description: "文档链接或 guid（必填）" })),
    work_code: Type.Optional(Type.String({ description: "目标用户工号（add/remove_collaborator/add/remove_admin 必填）" })),
    role: Type.Optional(StringEnum(["editor", "reader", "commentator"], { description: "协作者角色（add_collaborator 必填）：editor=可编辑；reader=可阅读；commentator=可评论" })),
    collaborator_work_codes: Type.Optional(Type.Array(Type.String({ description: "协作者工号列表（remove_collaborator 必填）" }))),
    collaborator_dept_ids: Type.Optional(Type.Array(Type.Number({ description: "协作者部门ID列表（remove_collaborator 可选）" }))),
    depart_id: Type.Optional(Type.Number({ description: "管理员部门ID（remove_admin 可选）" })),
});
export function createDocAdminTool() {
    return {
        name: "yach_doc_admin",
        label: "知音楼文档权限管理",
        description: "知音楼文档权限管理（需 OAuth 授权）：" +
            "add_collaborator 添加协作者（role: editor/reader/commentator）；" +
            "add_admin 添加管理员；" +
            "remove_collaborator 移除协作者（支持工号或部门）；" +
            "remove_admin 移除管理员（支持工号或部门）。",
        parameters: DocAdminSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "add_collaborator": {
                        if (!params.file_url || !params.work_code || !params.role) {
                            return jsonResult({ ok: false, error: "add_collaborator: file_url、work_code、role 均为必填" });
                        }
                        await client.invoke("yach_doc_admin", (c) => c.doc.addCollaborator(params.file_url, params.work_code, params.role), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    case "add_admin": {
                        if (!params.file_url || !params.work_code) {
                            return jsonResult({ ok: false, error: "add_admin: file_url、work_code 均为必填" });
                        }
                        await client.invoke("yach_doc_admin", (c) => c.doc.addAdmin(params.file_url, params.work_code), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    case "remove_collaborator": {
                        if (!params.file_url || (!params.collaborator_work_codes?.length && !params.collaborator_dept_ids?.length)) {
                            return jsonResult({ ok: false, error: "remove_collaborator: file_url 必填，collaborator_work_codes 和 collaborator_dept_ids 至少提供一个" });
                        }
                        await client.invoke("yach_doc_admin", (c) => c.doc.removeCollaborator({
                            fileUrlOrGuid: params.file_url,
                            collaboratorWorkCodes: params.collaborator_work_codes,
                            collaboratorDeptIds: params.collaborator_dept_ids,
                        }), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    case "remove_admin": {
                        if (!params.file_url || (!params.work_code && !params.depart_id)) {
                            return jsonResult({ ok: false, error: "remove_admin: file_url 必填，work_code 和 depart_id 至少提供一个" });
                        }
                        await client.invoke("yach_doc_admin", (c) => c.doc.removeAdmin({
                            fileUrlOrGuid: params.file_url,
                            adminWorkCode: params.work_code,
                            departId: params.depart_id,
                        }), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_doc_admin", action: String(params.action) });
            }
        },
    };
}
// ── yach_doc_sheet ────────────────────────────────────────────────────────
const DocSheetSchema = Type.Object({
    action: StringEnum(["update", "append"], {
        description: "操作类型：update 覆盖写入指定单元格区域（替换原有内容）；append 向指定区域追加新内容到新的单元格（不覆盖原有数据，在已有内容之后写入）",
    }),
    file_url: Type.Optional(Type.String({
        description: "表格链接（file_url / guid 二选一，仅支持表格类型）",
    })),
    guid: Type.Optional(Type.String({ description: "表格 guid（file_url / guid 二选一）" })),
    range: Type.String({
        description: "单元格范围，格式：${工作表名称}!${单元格范围}，例如 工作表1!A1:C3 或 工作表1!A1。" +
            "若工作表名称含 ! : ' 特殊字符，需用单引号包裹，如 '工作表!1'!A1:C3。" +
            "【重要】若用户未明确说明工作表名称，禁止猜测 Sheet1/工作表1 等默认值，必须先向用户确认要操作哪个工作表。",
    }),
    values: Type.Array(Type.Array(Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]), {
        description: "一行单元格数据（每列一个元素）",
    }), {
        description: '必须是二维数组，外层为行、内层为列，即使只有一行也必须写成 [[...]] 而非 [...]。' +
            '示例：[[1,"测试","abc"],[4,5,6]]',
    }),
});
export function createDocSheetTool() {
    return {
        name: "yach_doc_sheet",
        label: "知音楼表格内容更新",
        description: "知音楼表格内容操作（需 OAuth 授权，仅支持表格类型文档）：" +
            "update 覆盖写入指定单元格区域（替换原有内容，原内容会丢失）；" +
            "append 向指定区域追加新内容到新的单元格（不覆盖原有数据，在已有内容之后写入）。" +
            "【重要】调用前必须向用户确认工作表名称，range 必须带工作表名前缀（如 工作表1!A1:C3），禁止猜测默认工作表名。",
        parameters: DocSheetSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            if (!params.file_url && !params.guid) {
                return jsonResult({ ok: false, error: "file_url 和 guid 必须提供其中一个" });
            }
            if (!params.range.includes("!")) {
                return jsonResult({
                    ok: false,
                    error: `range 格式错误：必须包含工作表名称，格式为 工作表名称!单元格范围，如 工作表1!A1:C3。请先向用户确认要操作哪个工作表名称，禁止猜测。`,
                });
            }
            const client = createYachToolClient();
            try {
                switch (params.action) {
                    case "update": {
                        await client.invoke("yach_doc_sheet_update", (c) => c.doc.sheetUpdate({
                            fileUrl: params.file_url,
                            guid: params.guid,
                            range: params.range,
                            values: params.values,
                        }), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    case "append": {
                        await client.invoke("yach_doc_sheet_append", (c) => c.doc.sheetAppend({
                            fileUrl: params.file_url,
                            guid: params.guid,
                            range: params.range,
                            values: params.values,
                        }), { as: "user" });
                        return jsonResult({ ok: true });
                    }
                    default:
                        return jsonResult({ ok: false, error: `未知 action: ${params.action}` });
                }
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err);
            }
        },
    };
}
// ── 注册 ──────────────────────────────────────────────────────────────────
export function registerDocTools(api) {
    api.registerTool(createDocAppendTool());
    api.registerTool(createDocFileTool());
    api.registerTool(createDocAdminTool());
    api.registerTool(createDocSummarizeTool());
    api.registerTool(createDocSheetTool());
}
//# sourceMappingURL=index.js.map