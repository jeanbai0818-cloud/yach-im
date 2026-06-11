/**
 * YachDocApi — 文档 OAPI
 *
 * 使用 app_access_token（Authorization: Bearer）。
 *
 * createDoc（COS 上传 → 异步导入）由 tool 层调用 client.cos.upload() 后，
 * 再调用 importAsync() + pollImport()。
 */
import { oapiFetch } from "../core/fetch.js";
import fetch from "node-fetch";
function isOk(code) {
    const n = Number(code);
    return n === 0 || n === 200;
}
function normalizeCode(data) {
    return data.code ?? data.errcode ?? data.result;
}
function extractGuidFromUrl(urlOrGuid) {
    if (!urlOrGuid.startsWith("http"))
        return null;
    try {
        const pathname = new URL(urlOrGuid).pathname;
        const segments = pathname.split("/").filter(Boolean);
        // URL 格式：域名/类型/guid 或 域名/类型/guid/子路径
        // 策略：直接取第二个段（跳过类型名称）
        return segments[1] ?? null;
    }
    catch {
        return null;
    }
}
function buildDocQs(loc) {
    const qs = new URLSearchParams();
    if (loc.fileUrl)
        qs.set("file_url", loc.fileUrl);
    if (loc.guid)
        qs.set("guid", loc.guid);
    if (loc.knNodeId)
        qs.set("kn_node_id", loc.knNodeId);
    return qs;
}
// ── YachDocApi ────────────────────────────────────────────────────────────────
export class YachDocApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    /** 读取文档 Markdown（GET /openapi/v2/doc/content/md） */
    async readMarkdown(loc) {
        const token = await this.getToken();
        const qs = buildDocQs(loc);
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/content/md?${qs}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json());
        const result = (data.result ?? data.obj);
        if (!isOk(normalizeCode(data)) || !result) {
            throw new Error(`[yach-doc] readMarkdown error: ${JSON.stringify(data)}`);
        }
        return result;
    }
    /** 读取文档纯文本（GET /openapi/v2/doc/content） */
    async readText(loc) {
        const token = await this.getToken();
        const qs = buildDocQs(loc);
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/content?${qs}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json());
        const result = (data.result ?? data.obj);
        if (!isOk(normalizeCode(data)) || !result) {
            throw new Error(`[yach-doc] readText error: ${JSON.stringify(data)}`);
        }
        return result;
    }
    /** 创建空白文档（POST /openapi/v2/doc/add） */
    async createBlank(params) {
        const token = await this.getToken();
        const body = { type: params.type };
        if (params.name)
            body.name = params.name;
        if (params.folder)
            body.folder = params.folder;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj) {
            throw new Error(`[yach-doc] createBlank error: ${JSON.stringify(data)}`);
        }
        return data.obj;
    }
    /** 向文档末尾追加内容（POST /openapi/v2/doc/content/append） */
    async append(params) {
        const token = await this.getToken();
        const body = { content: params.content };
        if (params.fileUrl)
            body.file_url = params.fileUrl;
        if (params.guid)
            body.guid = params.guid;
        if (params.knNodeId)
            body.kn_node_id = params.knNodeId;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/content/append`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] append error: ${JSON.stringify(data)}`);
    }
    /** 发起异步导入，返回 task_id（POST /openapi/v2/doc/import/async） */
    async importAsync(params) {
        const token = await this.getToken();
        const body = {
            file_url: params.cosUrl,
            type: params.type,
        };
        if (params.folder)
            body.folder = params.folder;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/import/async`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj?.data?.task_id) {
            throw new Error(`[yach-doc] importAsync error: ${JSON.stringify(data)}`);
        }
        return data.obj.data.task_id;
    }
    /**
     * 轮询导入进度（最多 15 次，每次 2 秒）。
     * 返回 file_url（完成时），超时抛出 Error。
     */
    async pollImport(taskId) {
        const token = await this.getToken();
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/import/async/process?task_id=${taskId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json());
            if (isOk(normalizeCode(data)) && data.obj?.data?.progress === 100) {
                return { fileUrl: data.obj.data.file_url ?? "" };
            }
        }
        throw new Error(`[yach-doc] pollImport timeout: task_id=${taskId}`);
    }
    /** 发起异步导出，返回 task_id（POST /openapi/v2/doc/export/async） */
    async exportAsync(fileUrl, format) {
        const token = await this.getToken();
        const fileGuid = extractGuidFromUrl(fileUrl) ?? fileUrl;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/export/async`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ file_guid: fileGuid, type: format }),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj?.task_id) {
            throw new Error(`[yach-doc] exportAsync error: ${JSON.stringify(data)}`);
        }
        return data.obj.task_id;
    }
    /**
     * 轮询导出进度（最多 15 次，每次 2 秒）。
     * 返回 downloadUrl（完成时），超时抛出 Error。
     */
    async queryExportProgress(taskId) {
        const token = await this.getToken();
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const qs = new URLSearchParams({ task_id: taskId });
            const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/export/async/process?${qs}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json());
            if (!isOk(normalizeCode(data)))
                throw new Error(`[yach-doc] queryExportProgress error: ${JSON.stringify(data)}`);
            if (data.obj?.progress === 100 && data.obj.download_url) {
                return { downloadUrl: data.obj.download_url };
            }
        }
        throw new Error(`[yach-doc] queryExportProgress timeout: task_id=${taskId}`);
    }
    /** 发起知识库节点异步导入，返回 task_id（POST /openapi/v2/lore/import/async） */
    async loreImportAsync(params) {
        const token = await this.getToken();
        const body = {
            file_url: params.fileUrl,
            title: params.title,
            node_type: params.nodeType,
        };
        if (params.spaceId)
            body.space_id = params.spaceId;
        if (params.spaceUrl)
            body.space_url = params.spaceUrl;
        if (params.parentNodeId)
            body.parent_node_id = params.parentNodeId;
        if (params.parentNodeUrl)
            body.parent_node_url = params.parentNodeUrl;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/import/async`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj?.task_id) {
            throw new Error(`[yach-doc] loreImportAsync error: ${JSON.stringify(data)}`);
        }
        return data.obj.task_id;
    }
    /**
     * 轮询知识库导入进度（最多 15 次，每次 2 秒）。
     * 完成时返回 kn_node_id，超时抛出 Error。
     */
    async pollLoreImport(taskId, nodeType) {
        const token = await this.getToken();
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const qs = new URLSearchParams({ task_id: taskId, node_type: nodeType });
            const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/import/async/process?${qs}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json());
            if (isOk(normalizeCode(data)) && data.obj?.progress === 100) {
                return { fileUrl: data.obj.file_url ?? "" };
            }
        }
        throw new Error(`[yach-doc] pollLoreImport timeout: task_id=${taskId}`);
    }
    /** 发起知识库节点异步导出，返回 task_id（POST /openapi/v2/lore/node/export/async） */
    async loreNodeExportAsync(params) {
        const token = await this.getToken();
        const body = {
            type: params.format,
        };
        if (params.knNodeId)
            body.kn_node_id = params.knNodeId;
        if (params.knNodeUrl)
            body.kn_node_url = params.knNodeUrl;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/export/async`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj?.task_id) {
            throw new Error(`[yach-doc] loreNodeExportAsync error: ${JSON.stringify(data)}`);
        }
        return data.obj.task_id;
    }
    /**
     * 轮询知识库节点导出进度（最多 15 次，每次 2 秒）。
     * 返回 downloadUrl（完成时），超时抛出 Error。
     */
    async pollLoreNodeExport(taskId) {
        const token = await this.getToken();
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const qs = new URLSearchParams({ task_id: taskId });
            const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/export/progress?${qs}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await res.json());
            if (!isOk(normalizeCode(data)))
                throw new Error(`[yach-doc] pollLoreNodeExport error: ${JSON.stringify(data)}`);
            if (data.obj?.progress === 100 && data.obj.download_url) {
                return { downloadUrl: data.obj.download_url };
            }
        }
        throw new Error(`[yach-doc] pollLoreNodeExport timeout: task_id=${taskId}`);
    }
    /** 覆盖写表格区域（POST /openapi/v2/doc/sheet/update） */
    async sheetUpdate(params) {
        const token = await this.getToken();
        const body = { range: params.range, resource: { values: params.values } };
        if (params.fileUrl)
            body.file_url = params.fileUrl;
        if (params.guid)
            body.guid = params.guid;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/sheet/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] sheetUpdate error: ${JSON.stringify(data)}`);
    }
    /** 追加表格行（POST /openapi/v2/doc/sheet/added） */
    async sheetAppend(params) {
        const token = await this.getToken();
        const body = { range: params.range, resource: { values: params.values } };
        if (params.guid)
            body.guid = params.guid;
        else if (params.fileUrl)
            body.file_url = params.fileUrl;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/sheet/added`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] sheetAppend error: ${JSON.stringify(data)}`);
    }
    /** 删除文档（POST /openapi/v2/doc/del） */
    async deleteDoc(fileUrl) {
        const token = await this.getToken();
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/del`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ file_url: fileUrl }),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] deleteDoc error: ${JSON.stringify(data)}`);
    }
    /** 添加文档协作者（POST /openapi/v2/doc/collaborator/add） */
    async addCollaborator(fileUrlOrGuid, workCode, role) {
        const token = await this.getToken();
        const guid = extractGuidFromUrl(fileUrlOrGuid) ?? fileUrlOrGuid;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/collaborator/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                guid,
                collaborators: [{ work_code: workCode, role, user_type: 0 }],
            }),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] addCollaborator error: ${JSON.stringify(data)}`);
    }
    /** 添加文档管理员（POST /openapi/v2/doc/admin/add，需传工号） */
    async addAdmin(fileUrl, adminWorkCode) {
        const token = await this.getToken();
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/admin/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ file_url: fileUrl, admin_work_code: adminWorkCode }),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] addAdmin error: ${JSON.stringify(data)}`);
    }
    /** 移除文档协作者（POST /openapi/v2/doc/collaborator/del） */
    async removeCollaborator(params) {
        const token = await this.getToken();
        const guid = params.fileUrlOrGuid ? extractGuidFromUrl(params.fileUrlOrGuid) ?? params.fileUrlOrGuid : undefined;
        const body = {};
        if (guid)
            body.guid = guid;
        if (params.fileUrlOrGuid && !guid)
            body.file_url = params.fileUrlOrGuid;
        if (params.collaboratorWorkCodes?.length)
            body.collaborator_work_codes = JSON.stringify(params.collaboratorWorkCodes);
        if (params.collaboratorDeptIds?.length)
            body.collaborator_dept_ids = params.collaboratorDeptIds;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/collaborator/del`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] removeCollaborator error: ${JSON.stringify(data)}`);
    }
    /** 移除文档管理员（POST /openapi/v2/doc/admin/del） */
    async removeAdmin(params) {
        const token = await this.getToken();
        const guid = params.fileUrlOrGuid ? extractGuidFromUrl(params.fileUrlOrGuid) ?? params.fileUrlOrGuid : undefined;
        const body = {};
        if (guid)
            body.guid = guid;
        if (params.fileUrlOrGuid && !guid)
            body.file_url = params.fileUrlOrGuid;
        if (params.adminWorkCode)
            body.admin_work_code = params.adminWorkCode;
        if (params.departId)
            body.depart_id = params.departId;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/doc/admin/del`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)))
            throw new Error(`[yach-doc] removeAdmin error: ${JSON.stringify(data)}`);
    }
    /** 下载文件内容（GET） */
    async downloadFile(url) {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`[yach-doc] downloadFile error: HTTP ${res.status}`);
        }
        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(buffer);
    }
    /** 使用 OpenClaw 运行时调用大模型总结文档内容 */
    async summarizeContent(content, prompt) {
        // 导入动态的运行时 API
        const { getYachRuntime } = await import("../core/runtime.js");
        const runtime = getYachRuntime();
        // 检查是否有可用的 AI 模型调用能力
        if (!runtime) {
            throw new Error("[yach-doc] Runtime not available for AI summarization");
        }
        // 简单的本地总结实现（如果没有 AI 能力）
        // 截取前 2000 字符进行简单总结
        const truncatedContent = content.length > 5000 ? content.substring(0, 5000) + "\n... (内容已截取)" : content;
        // 构建总结提示
        const summaryPrompt = `${prompt}\n\n文档内容：\n${truncatedContent}`;
        // 这里简化实现，返回基本的结构化总结
        // 在实际生产环境中，应该调用 OpenClaw 的 Agent 运行时来获取 AI 总结
        const summary = this.generateBasicSummary(truncatedContent, prompt);
        return summary;
    }
    /** 生成基础总结（简化实现） */
    generateBasicSummary(content, prompt) {
        const lines = content.split("\n").filter(line => line.trim());
        const totalChars = content.length;
        const totalLines = lines.length;
        // 提取可能的标题
        const titles = lines.filter(line => line.startsWith("#") || line.length < 50 && /[一-龥]/.test(line));
        // 统计段落
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
        const avgParagraphLength = Math.round(totalChars / Math.max(paragraphs.length, 1));
        let summary = `## 文档总结\n\n`;
        summary += `${prompt || "请总结这份文档的核心内容和要点"}\n\n`;
        if (titles.length > 0 && titles.length <= 10) {
            summary += `### 检测到的标题\n`;
            titles.slice(0, 5).forEach(title => {
                summary += `- ${title.replace(/^#+\s*/, "")}\n`;
            });
            summary += `\n`;
        }
        summary += `### 文档统计\n`;
        summary += `- 总字符数：${totalChars}\n`;
        summary += `- 总行数：${totalLines}\n`;
        summary += `- 段落数：${paragraphs.length}\n`;
        summary += `- 平均段落长度：${avgParagraphLength} 字符\n\n`;
        summary += `### 内容摘要\n`;
        summary += `该文档包含 ${paragraphs.length} 个段落，总长度 ${totalChars} 字符。`;
        if (titles.length > 0) {
            summary += ` 文档结构较为清晰，包含 ${titles.length} 个标题。`;
        }
        return summary;
    }
    /** 获取重定向 URL（处理 s.tal.com 重定向逻辑） */
    async getRedirectedUrl(urlOrGuid) {
        try {
            // 如果是 URL，尝试获取重定向
            if (urlOrGuid.startsWith("http")) {
                const response = await fetch(urlOrGuid, {
                    method: "HEAD",
                    redirect: "manual",
                });
                // 检查是否有重定向
                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get("Location");
                    if (location) {
                        console.log(`[yach-doc] 检测到重定向: ${urlOrGuid} -> ${location}`);
                        return location;
                    }
                }
                // 如果没有重定向，返回原始 URL
                return urlOrGuid;
            }
            else {
                // 如果是 GUID，构造完整的 URL
                const url = `${this.baseUrl}/openapi/v2/doc/url?guid=${urlOrGuid}`;
                const response = await fetch(url, {
                    method: "GET",
                    redirect: "manual",
                });
                // 检查是否有重定向
                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get("Location");
                    if (location) {
                        console.log(`[yach-doc] 检测到重定向: ${urlOrGuid} -> ${location}`);
                        return location;
                    }
                }
                return urlOrGuid;
            }
        }
        catch (error) {
            console.error("[yach-doc] 获取重定向 URL 失败:", error);
            throw new Error(`获取重定向 URL 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /** 查看知识库节点属性（POST /openapi/v2/lore/node/properties）
     * 定位三选一：方案一(topicId + nodeId)，方案二(guid)，方案三(url)
     */
    async loreNodeProperties(params) {
        const token = await this.getToken();
        const body = {};
        if (params.topicId)
            body.topic_id = params.topicId;
        if (params.nodeId)
            body.node_id = params.nodeId;
        if (params.guid)
            body.guid = params.guid;
        if (params.url)
            body.url = params.url;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/properties`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj) {
            throw new Error(`[yach-doc] loreNodeProperties error: ${JSON.stringify(data)}`);
        }
        const o = data.obj;
        return {
            title: o.title,
            guid: o.guid,
            docUrl: o.doc_url,
            isFolder: o.isFolder,
            secretTag: o.secret_tag,
            shareMode: o.share_mode,
            updatedAt: o.updatedAt,
            creator: { name: o.creator.name, uid: o.creator.uid, workCode: o.creator.work_code },
            updatedBy: { name: o.updatedBy.name, uid: o.updatedBy.uid, workCode: o.updatedBy.work_code },
            secretTagInfo: (o.secret_tag_info ?? []).map((i) => ({
                tag: i.tag,
                name: i.name,
                supportShareMode: i.support_share_mode,
            })),
            shareModeInfo: (o.share_mode_info ?? []).map((i) => ({
                value: i.value,
                name: i.name,
            })),
        };
    }
    /** 移动知识库节点（POST /openapi/v2/lore/node/move）
     * 来源定位二选一：方案一(sourceTopicId + sourceNodeId)，方案二(sourceNodeUrl)
     * 目标定位二选一：方案一(targetTopicId + targetNodeId)，方案二(targetNodeUrl)
     */
    async loreNodeMove(params) {
        const token = await this.getToken();
        const body = {};
        if (params.sourceNodeUrl)
            body.source_node_url = params.sourceNodeUrl;
        if (params.sourceTopicId)
            body.source_topic_id = params.sourceTopicId;
        if (params.sourceNodeId)
            body.source_node_id = params.sourceNodeId;
        if (params.targetNodeUrl)
            body.target_node_url = params.targetNodeUrl;
        if (params.targetTopicId)
            body.target_topic_id = params.targetTopicId;
        if (params.targetNodeId)
            body.target_node_id = params.targetNodeId;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj?.node_id) {
            throw new Error(`[yach-doc] loreNodeMove error: ${JSON.stringify(data)}`);
        }
        return {
            nodeId: data.obj.node_id,
            shortLink: data.obj.short_link,
            topicId: data.obj.topic_id,
            name: data.obj.name,
        };
    }
    /** 新建知识库节点（POST /openapi/v2/lore/node/create）
     * 定位方案二选一：方案一(topicId + parentNodeId)，方案二(parentNodeUrl)
     */
    async loreNodeCreate(params) {
        const token = await this.getToken();
        const body = {
            node_type: params.nodeType,
        };
        if (params.name)
            body.name = params.name;
        if (params.topicId)
            body.topic_id = params.topicId;
        if (params.parentNodeId)
            body.parent_node_id = params.parentNodeId;
        if (params.parentNodeUrl)
            body.parent_node_url = params.parentNodeUrl;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.obj?.node_id) {
            throw new Error(`[yach-doc] loreNodeCreate error: ${JSON.stringify(data)}`);
        }
        return {
            nodeId: data.obj.node_id,
            shortLink: data.obj.short_link,
            topicId: data.obj.topic_id,
            name: data.obj.name,
        };
    }
    /** 修改知识库节点属性（POST /openapi/v2/lore/node/properties/update）
     * 节点定位三选一：方案一(topicId + nodeId)，方案二(guid)，方案三(url)
     * 可修改字段：title、secretTag、shareMode（均为可选，不传则不修改）
     */
    async loreNodeSetProperties(params) {
        const token = await this.getToken();
        const body = {};
        if (params.topicId)
            body.topic_id = params.topicId;
        if (params.nodeId)
            body.node_id = params.nodeId;
        if (params.guid)
            body.guid = params.guid;
        if (params.url)
            body.url = params.url;
        if (params.title)
            body.title = params.title;
        if (params.secretTag)
            body.secret_tag = params.secretTag;
        if (params.shareMode)
            body.share_mode = params.shareMode;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/properties/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data))) {
            throw new Error(`[yach-doc] loreNodeSetProperties error: ${JSON.stringify(data)}`);
        }
        return { ok: true };
    }
    /** 查询知识库节点列表（POST /openapi/v2/lore/node/list）
     * 父节点定位二选一：knNodeId 或 knNodeUrl
     * 支持分页（nextPageToken）、时间过滤（lastUpdateTime）、类型过滤（type）
     */
    async loreNodeList(params) {
        const token = await this.getToken();
        const body = {};
        if (params.knNodeId)
            body.kn_node_id = params.knNodeId;
        if (params.knNodeUrl)
            body.kn_node_url = params.knNodeUrl;
        if (params.nextPageToken)
            body.next_page_token = params.nextPageToken;
        if (params.lastUpdateTime)
            body.last_update_time = params.lastUpdateTime;
        if (params.type)
            body.type = params.type;
        if (params.pageSize)
            body.page_size = params.pageSize;
        const res = await oapiFetch(`${this.baseUrl}/openapi/v2/lore/node/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        const data = (await res.json());
        if (!isOk(normalizeCode(data)) || !data.data) {
            throw new Error(`[yach-doc] loreNodeList error: ${JSON.stringify(data)}`);
        }
        return {
            nodes: (data.data.tree_nodes ?? []).map((n) => ({
                topicId: n.topic_id,
                nodeId: n.node_id,
                title: n.title,
                type: n.type,
                url: n.url,
                hasChildren: n.has_children === 1,
                parentNodeId: n.parent_node_id,
                createUid: n.create_uid,
                createDate: n.create_date,
                updateDate: n.update_date,
            })),
            nextPageToken: data.data.next_page_token ?? "",
        };
    }
}
//# sourceMappingURL=doc.js.map