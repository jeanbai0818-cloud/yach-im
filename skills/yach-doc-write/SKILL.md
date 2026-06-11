---
name: yach-doc-write
description: >
  知音楼文档写入/创建/导入/权限管理能力，以及表格单元格内容更新与追加能力。
  以下场景可使用此 skill（必须先确认用户明确同意执行写操作）：
  用户要新建或创建文档、表格、幻灯片、脑图（未指定平台时默认为知音楼）；
  用户要向文档追加/写入内容；
  用户要导入本地文件到知音楼；
  用户要给文档添加或移除协作者/管理员/权限。
  用户要更新表格/往单元格追加内容
---

> **⚠️ 链接呈现规范（极其重要）：向用户输出任何回复之前，必须扫描回复中所有文档链接和知识库节点链接，按以下规则逐一检查并就地修正后再输出。**
> - ✅ 有标题时：`链接 《标题》`，例如 `https://st.tal.com/a/wM2iny 《Q3复盘》`；符号支持 `《》【】<>「」`，优先书名号
> - ✅ 无标题时：只返回链接本身
> - 🚫 禁止：裸输出已知标题的链接；禁止输出后再解释"忘加标题"——发现错误须在输出前修正

## 工具

> ⚠️ 高风险确认规则：
> - `yach_doc_append`、`yach_doc_sheet`、`yach_doc_admin`、`yach_doc_file(import/export)` 调用前必须让用户明确确认，并在参数中传 `confirm_risk: true`
> - 涉及 `file_path` 的导入只允许来自受信目录（由 `YACH_ALLOWED_LOCAL_PATHS` 控制），不得尝试读取任意路径

| 意图                         | 工具              | action                |
| ---------------------------- | ----------------- | --------------------- |
| 追加内容到文档末尾           | `yach_doc_append` | —                     |
| 新建空白文档                 | `yach_doc_file`   | `create_blank`        |
| 导入文件为文档               | `yach_doc_file`   | `import`              |
| 添加协作者                   | `yach_doc_admin`  | `add_collaborator`    |
| 添加管理员                   | `yach_doc_admin`  | `add_admin`           |
| 移除协作者                   | `yach_doc_admin`  | `remove_collaborator` |
| 移除管理员                   | `yach_doc_admin`  | `remove_admin`        |
| 更新表格区域内容（替换）     | `yach_doc_sheet`  | `update`              |
| 追加表格内容（写入新单元格） | `yach_doc_sheet`  | `append`              |

**locator**（三选一）：`file_url` / `guid` / `kn_node_id`，优先用 `guid`

## yach_doc_append — 追加内容

| 参数         | 必填   | 说明                          |
| ------------ | ------ | ----------------------------- |
| `file_url`   | 三选一 | 文档完整链接                  |
| `guid`       | 三选一 | 文档 guid，优先使用           |
| `kn_node_id` | 三选一 | 知识库节点 ID                 |
| `content`    | 必填   | 要追加的内容（支持 Markdown） |
| `confirm_risk` | 必填 | 固定 `true`，表示用户已确认执行写入 |

## yach_doc_file — 创建/导入

### action: `create_blank` 新建空白文档

| 参数             | 必填 | 说明                                                                                                                   |
| ---------------- | ---- | ---------------------------------------------------------------------------------------------------------------------- |
| `doc_type`       | 必填 | `newdoc`=文档 / `mosheet`=表格 / `presentation`=幻灯片 / `mindmap`=脑图 / `form`=表单 / `board`=白板 / `folder`=文件夹 |
| `name`           | 可选 | 文档标题                                                                                                               |
| `parent_node_id` | 可选 | 父目录 folder guid                                                                                                     |

### action: `import` 导入文件为文档

工具内部已封装 COS 上传和进度轮询，**直接传内容即可，无需手动拆步骤**。

| 参数             | 必填   | 说明                                                           |
| ---------------- | ------ | -------------------------------------------------------------- |
| `filename`       | 必填   | 原始文件名含扩展名，如 `周报.md`、`报告.docx`                  |
| `content`        | 二选一 | Markdown 文本内容（作为 .md 文件导入）                         |
| `file_path`      | 二选一 | 本地文件路径，支持 txt/md/doc/docx/csv/xls/xlsx/ppt/pptx/xmind |
| `parent_node_id` | 可选   | 父目录 folder guid                                             |
| `confirm_risk`   | 必填   | 固定 `true`，表示用户已确认导入本地内容                         |

## yach_doc_admin — 权限管理

### add_collaborator 添加协作者

| 参数        | 必填 | 说明                                                     |
| ----------- | ---- | -------------------------------------------------------- |
| `file_url`  | 必填 | 文档链接或 guid                                          |
| `work_code` | 必填 | 目标用户工号                                             |
| `role`      | 必填 | `editor`=可编辑 / `reader`=可阅读 / `commentator`=可评论 |
| `confirm_risk` | 必填 | 固定 `true`，表示用户已确认修改权限 |

### add_admin 添加管理员

| 参数        | 必填 | 说明            |
| ----------- | ---- | --------------- |
| `file_url`  | 必填 | 文档链接或 guid |
| `work_code` | 必填 | 目标用户工号    |

### remove_collaborator 移除协作者

| 参数                      | 必填     | 说明                                  |
| ------------------------- | -------- | ------------------------------------- |
| `file_url`                | 必填     | 文档链接或 guid                       |
| `collaborator_work_codes` | 至少一个 | 工号列表，如 `["10086", "10087"]`     |
| `collaborator_dept_ids`   | 至少一个 | 部门 ID 列表（数字），如 `[101, 102]` |

### remove_admin 移除管理员

| 参数        | 必填     | 说明                  |
| ----------- | -------- | --------------------- |
| `file_url`  | 必填     | 文档链接或 guid       |
| `work_code` | 至少一个 | 管理员工号            |
| `depart_id` | 至少一个 | 管理员部门 ID（数字） |

## yach_doc_sheet — 表格操作说明

> ⚠️ **以下规则仅适用于 `yach_doc_sheet`，不影响其他工具。**

**调用前必须向用户确认工作表名称**：`range` 参数需要包含工作表名称（如 `工作表1!A1:C3`），调用前**必须明确询问用户要操作哪个工作表**，**严禁自行猜测或编造工作表名称**（不得擅自使用 Sheet1、表1 等默认值）。

**range 格式**：`${工作表名称}!${单元格范围}`，例如 `工作表1!A1:C3`；工作表名含 `! : '` 时用单引号包裹，如 `'My!Sheet'!A1`

**values 格式**：二维数组，外层为行、内层为列，如 `[[1,"姓名","部门"],[2,"张三","研发"]]`；支持数字、字符串、布尔值、null

**update vs append**：

- `update`：覆盖写入，替换指定区域原有内容，原内容丢失
- `append`：追加写入，在已有数据之后写入新内容到新的单元格，原有数据不受影响

执行 `update` 或 `append` 前必须再次确认用户是否接受写入/覆盖影响，并传 `confirm_risk: true`。

## 典型工作流

```
# 新建文档并写入内容
yach_doc_file { action: "create_blank", doc_type: "newdoc", name: "Q2复盘" }
→ { guid: "xxx", url: "..." }
yach_doc_append { guid: "xxx", content: "## 正文内容" }

# 导入本地文件为文档
yach_doc_file { action: "import", filename: "报告.docx", file_path: "/tmp/报告.docx" }

# 给同事加编辑权限
yach_doc_admin { action: "add_collaborator", file_url: "...", work_code: "10086", role: "editor" }
```

## ⚠️ 链接呈现规范（回复前再确认一次）

- ❌ 错误：`文档链接：https://st.tal.com/a/wM2iny`
- ✅ 正确：`https://st.tal.com/a/wM2iny 《Q3复盘》`
- ✅ 正确（无标题时）：`https://st.tal.com/a/wM2iny`

## 常见错误

- `170013 应用未授权` → OAuth 未授权，需要重新授权（工具会自动引导授权流程）
- `import` 超时 → 工具内部已自动轮询，若仍超时稍后重试
- 不能移除文档所有者
