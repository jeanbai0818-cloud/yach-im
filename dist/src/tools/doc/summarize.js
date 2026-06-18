/**
 * 文档总结工具
 *
 * 支持处理 s.tal.com 短链接重定向和各类文档类型，
 * 导出并解析文档内容，返回全文和预览供 AI 助手进行智能总结分析。
 */
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fetch from "node-fetch";
import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
import { StringEnum } from "../helpers.js";
import { yachLogger } from "../../core/yach-logger.js";
import { reportError } from "../../core/reporter.js";
const log = yachLogger("doc-summarize");
function isAllowedDownloadUrl(url) {
    let u;
    try {
        u = new URL(url);
    }
    catch {
        return false;
    }
    if (!["http:", "https:"].includes(u.protocol))
        return false;
    const allowedHostsRaw = (process.env.YACH_DOC_DOWNLOAD_ALLOWED_HOSTS ?? "").trim();
    const defaultHosts = ["tal.com", "s.tal.com", "st.tal.com", "kn.tal.com", "k.tal.com", "xesimg.com"];
    const allowedHosts = (allowedHostsRaw
        ? allowedHostsRaw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
        : defaultHosts);
    const host = u.hostname.toLowerCase();
    return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}
function getMaxDownloadBytes() {
    const n = Number(process.env.YACH_DOC_MAX_DOWNLOAD_BYTES ?? "20971520");
    if (!Number.isFinite(n) || n <= 0)
        return 20 * 1024 * 1024;
    return Math.floor(n);
}
// ── 辅助函数 ─────────────────────────────────────────────────────────────
/**
 * 根据 URL 判断文档类型和导出格式
 * 根据知音楼文档链接模式推断文档类型
 */
function detectDocTypeFromUrl(url) {
    if (!url)
        return null;
    // 知音楼文档链接模式
    // /doc/xxx - 普通文档
    // /mindmap/xxx - 思维导图
    // /presentation/xxx - 演示文稿
    // /sheet/xxx 或 /sheets/xxx - 表格
    // /form/xxx - 表单
    // /whiteboard/xxx - 白板
    // 文档: pdf、docx、jpg、md，表格: xlsx，幻灯片: pptx、pdf，脑图: jpeg、xmind
    if (url.includes("/mindmap/")) {
        return { docType: "mindmap", exportFormat: "xmind" };
    }
    if (url.includes("/presentation/")) {
        return { docType: "presentation", exportFormat: "pdf" };
    }
    if (url.includes("/sheet/") || url.includes("/sheets/")) {
        return { docType: "mosheet", exportFormat: "xlsx" };
    }
    return { docType: "newdoc", exportFormat: "docx" };
}
/**
 * 跟随 HTTP 重定向，获取最终 URL
 */
async function followRedirects(url, maxRedirects = 10) {
    let currentUrl = url;
    let redirects = 0;
    while (redirects < maxRedirects) {
        // 使用 GET 请求而不是 HEAD，因为某些服务器不支持 HEAD 方法
        const response = await fetch(currentUrl, {
            method: "GET",
            redirect: "manual",
        });
        const locationHeader = response.headers.get("location");
        if (locationHeader && response.status >= 300 && response.status < 400) {
            // 处理相对 URL
            try {
                currentUrl = new URL(locationHeader, currentUrl).toString();
                redirects++;
            }
            catch (e) {
                console.error(`[followRedirects] 解析重定向 URL 失败:`, e);
                return currentUrl;
            }
        }
        else {
            // 没有更多重定向，返回当前 URL
            return currentUrl;
        }
    }
    log.info(`[followRedirects] 达到最大重定向次数 (${maxRedirects})，返回当前 URL: ${currentUrl}`);
    return currentUrl;
}
/**
 * 下载文件到本地临时目录
 */
async function downloadToTempFile(url) {
    if (!isAllowedDownloadUrl(url)) {
        throw new Error("下载地址不在允许域名范围内。可通过 YACH_DOC_DOWNLOAD_ALLOWED_HOSTS 配置白名单。");
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    const maxBytes = getMaxDownloadBytes();
    if (contentLength > 0 && contentLength > maxBytes) {
        throw new Error(`下载文件过大：${contentLength} bytes，超过限制 ${maxBytes} bytes`);
    }
    const contentDisposition = response.headers.get("content-disposition") || "";
    let filename = "unknown";
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, "");
    }
    const ext = filename.includes(".")
        ? "." + filename.split(".").pop().toLowerCase()
        : ".tmp";
    const filepath = `${tmpdir()}/${randomUUID()}${ext}`;
    const fileStream = createWriteStream(filepath);
    if (!response.body) {
        throw new Error("响应体为空");
    }
    response.body.pipe(fileStream);
    return new Promise((resolve, reject) => {
        fileStream.on("finish", () => resolve({ filepath, ext }));
        fileStream.on("error", reject);
    });
}
/**
 * 生成内容预览
 */
function generateContentPreview(content) {
    const previewLength = 100000;
    if (!content)
        return "";
    return (content.substring(0, previewLength) +
        (content.length > previewLength ? "..." : ""));
}
async function parseFileContent(filepath, ext) {
    const fileBuffer = await readFile(filepath);
    if (ext === ".md" || ext === ".txt") {
        return fileBuffer.toString("utf-8");
    }
    if (ext === ".docx") {
        const mammoth = await import("mammoth");
        let imgIndex = 0;
        const imgBuffers = [];
        const result = await mammoth.default.convertToHtml({ buffer: fileBuffer }, {
            convertImage: mammoth.default.images.imgElement(async (element) => {
                const key = `img_${++imgIndex}`;
                const buf = await element.read();
                imgBuffers.push({ key, buf, contentType: element.contentType });
                return { src: key };
            }),
        });
        const imgTexts = {};
        if (imgBuffers.length > 0) {
            const { createWorker } = await import("tesseract.js");
            const worker = await createWorker("chi_sim+eng");
            try {
                for (const { key, buf, contentType } of imgBuffers) {
                    try {
                        const { data } = await worker.recognize(`data:${contentType};base64,${buf.toString("base64")}`);
                        if (data.text.trim())
                            imgTexts[key] = data.text.trim();
                    }
                    catch (imgErr) {
                        log.info(`[doc-summarize] OCR 识别图片失败，跳过: ${key}`, {
                            imgErr,
                        });
                    }
                }
            }
            finally {
                await worker.terminate().catch(() => { });
            }
        }
        const html = result.value.replace(/<img[^>]*src="(img_\d+)"[^>]*>/g, (_, key) => (imgTexts[key] ? `\n[图片内容: ${imgTexts[key]}]\n` : ""));
        return html.replace(/<[^>]+>/g, " ").trim();
    }
    if (ext === ".xlsx") {
        try {
            const { default: ExcelJS } = await import("exceljs");
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(fileBuffer);
            let text = "";
            workbook.eachSheet((worksheet, _sheetId) => {
                const sheetName = worksheet.name;
                const rows = [];
                worksheet.eachRow({ includeEmpty: false }, (row) => {
                    rows.push(row.values.slice(1).map((c) => String(c ?? "")));
                });
                if (rows.length === 0) {
                    text += `## ${sheetName}（空表）\n\n`;
                    return;
                }
                const totalRows = rows.length - 1;
                const cols = rows[0].length;
                text += `## ${sheetName}（共 ${totalRows} 行 × ${cols} 列）\n\n`;
                for (const row of rows) {
                    text += row.join(",") + "\n";
                }
                text += "\n";
            });
            if (text) return text;
        }
        catch (err) {
            log.error("parseFileContent error", { err, filepath, ext });
            reportError('tools.doc.summarize', 'parseFileContent error', { err: String(err) ?? "", filepath, ext });
            throw err;
        }
    }
    if (ext === ".pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
    }
    return fileBuffer.toString("utf-8");
}
// ── Schema 定义 ─────────────────────────────────────────────────────────────
const DocSummarizeSchema = Type.Object({
    file_url: Type.Optional(Type.String({
        description: "文档链接（file_url / guid / kn_node_id 三选一）",
    })),
    guid: Type.Optional(Type.String({ description: "文档 guid" })),
    kn_node_id: Type.Optional(Type.String({ description: "知识库节点 ID" })),
    format: Type.Optional(StringEnum(["pdf", "docx", "md", "xlsx"], {
        description: "导出格式（默认根据文档类型自动判断，不传则直接读取内容）",
    })),
    summary_prompt: Type.Optional(Type.String({ description: "总结提示词（可选，如'请总结核心要点'）" })),
});
// ── 工具函数 ─────────────────────────────────────────────────────────────
export function createDocSummarizeTool() {
    return {
        name: "yach_doc_summarize",
        label: "知音楼文档读取/总结",
        description: "知音楼文档智能读取和总结工具（需 OAuth 授权）。支持直接读取文档内容或导出后解析并返回全文和预览",
        parameters: DocSummarizeSchema,
        execute: async (_toolCallId, rawParams) => {
            const params = rawParams;
            if (!params.file_url && !params.guid && !params.kn_node_id) {
                return jsonResult({
                    ok: false,
                    error: "file_url / guid / kn_node_id 至少填一个",
                });
            }
            const client = createYachToolClient();
            const loc = params.file_url || params.guid || params.kn_node_id;
            let tempFilepath = ""; // 回调内外共用，异常时 finally 可清理
            try {
                return await client.invoke("yach_doc_summarize", async (c) => {
                    try {
                        let downloadUrl = "";
                        let actualExportFormat;
                        let actualDocUrl = loc;
                        // 1. 根据 URL 类型选择导出方式
                        const isSTalDotCom = params.file_url?.includes("s.tal.com");
                        if (isSTalDotCom) {
                            // s.tal.com 域名：先获取重定向 URL，然后根据重定向后的 URL 判断文档类型
                            const finalUrl = await followRedirects(params.file_url);
                            actualDocUrl = finalUrl;
                            // 根据重定向后的 URL 判断文档类型
                            const docType = detectDocTypeFromUrl(finalUrl);
                            actualExportFormat =
                                params.format || docType?.exportFormat || "md";
                            log.info(`[yach-doc] s.tal.com 重定向: ${params.file_url} -> ${finalUrl}`);
                            log.info(`[yach-doc] 检测到文档类型: ${docType?.docType}, 导出格式: ${actualExportFormat}`);
                            // 先尝试知识库节点导出（使用正确的格式）
                            const taskId = await c.doc.loreNodeExportAsync({
                                knNodeUrl: params.file_url,
                                format: actualExportFormat,
                            });
                            const loreResult = await c.doc.pollLoreNodeExport(taskId);
                            downloadUrl = loreResult.downloadUrl;
                        }
                        else {
                            // 非 s.tal.com 域名，直接使用文档导出
                            const docType = detectDocTypeFromUrl(params.file_url);
                            actualExportFormat = (params.format ||
                                docType?.exportFormat);
                            const taskId = await c.doc.exportAsync(loc, actualExportFormat);
                            const docResult = await c.doc.queryExportProgress(taskId);
                            downloadUrl = docResult.downloadUrl;
                        }
                        // 2. 下载文件
                        const tempFileResult = await downloadToTempFile(downloadUrl);
                        tempFilepath = tempFileResult.filepath;
                        // 3. 读取并解析文件内容
                        const textContent = await parseFileContent(tempFilepath, tempFileResult.ext);
                        if (!textContent || textContent.trim().length < 10) {
                            // 清理临时文件
                            try {
                                const { unlink } = await import("node:fs/promises");
                                await unlink(tempFilepath);
                            }
                            catch (cleanupError) { }
                            return jsonResult({
                                ok: false,
                                error: "文档内容为空或太短，无法总结",
                            });
                        }
                        return jsonResult({
                            ok: true,
                            downloadUrl,
                            exportFormat: actualExportFormat,
                            actualDocUrl,
                            contentLength: textContent.length,
                            contentPreview: generateContentPreview(textContent),
                            message: "文档内容已提取。请将 content 或 contentPreview 发送给 AI 助手进行总结。",
                        });
                    }
                    catch (err) {
                        log.info(`[yach-doc] 总结流程异常，尝试使用 get_text 兜底:`, {
                            err,
                        });
                        if (tempFilepath) {
                            try {
                                const { unlink } = await import("node:fs/promises");
                                await unlink(tempFilepath);
                            }
                            catch (cleanupError) { }
                        }
                        try {
                            const fallbackResult = await c.doc.readText({
                                fileUrl: params.file_url,
                                guid: params.guid,
                                knNodeId: params.kn_node_id,
                            });
                            return jsonResult({
                                ok: true,
                                content: fallbackResult.content || "",
                                contentLength: fallbackResult.content
                                    ? fallbackResult.content.length
                                    : 0,
                                contentPreview: generateContentPreview(fallbackResult.content || ""),
                                message: "文档总结流程异常，已通过 get_text 获取文档内容。",
                                fallback: true,
                            });
                        }
                        catch (fallbackError) {
                            log.error(`[yach-doc] get_text 兜底也失败:`, { fallbackError });
                            return handleInvokeErrorWithAutoAuth(err, undefined, {
                                toolName: "yach_doc_summarize",
                            });
                        }
                    }
                }, { as: "user" });
            }
            catch (error) {
                return handleInvokeErrorWithAutoAuth(error, undefined, {
                    toolName: "yach_doc_summarize",
                });
            }
        },
    };
}
//# sourceMappingURL=summarize.js.map