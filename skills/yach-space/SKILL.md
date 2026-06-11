---
name: yach-space
description: 知音楼知识库节点操作：新建节点、移动节点、查看属性、修改属性、查询节点列表、节点导入、节点导出。用户说「新建/创建文档」时优先 create；说「移动/挪动节点」时用 move；查看节点信息/属性时用 get_properties；修改/设置节点属性（标题/密级/分享权限）时用 set_properties；查询/列出知识库或目录下的节点时用 list；只有用户提供了文件或文本内容时才用 import；导出节点为文件时用 export。
---

> **⚠️ 链接呈现规范（极其重要）：向用户输出任何回复之前，必须扫描回复中所有文档链接和知识库节点链接，按以下规则逐一检查并就地修正后再输出。**
> - ✅ 有标题时：`链接 《标题》`，例如 `https://st.tal.com/a/wM2iny 《Q3复盘》`；符号支持 `《》【】<>「」`，优先书名号
> - ✅ 无标题时：只返回链接本身
> - 🚫 禁止：裸输出已知标题的链接；禁止输出后再解释"忘加标题"——发现错误须在输出前修正

## 工具

| 意图                 | 工具              | action           | 必填                                   |
| -------------------- | ----------------- | ---------------- | -------------------------------------- |
| 新建知识库节点       | `yach_space_node` | `create`         | `node_type` + 父节点定位（二选一）     |
| 移动知识库节点       | `yach_space_node` | `move`           | 来源定位（二选一）+ 目标定位（二选一） |
| 查看知识库节点属性   | `yach_space_node` | `get_properties` | 节点定位（三选一）                     |
| 修改知识库节点属性   | `yach_space_node` | `set_properties` | 节点定位（三选一）+ 至少一个修改字段   |
| 查询知识库节点列表   | `yach_space_node` | `list`           | 父节点定位（二选一）                   |
| 导入文件为知识库节点 | `yach_space_node` | `import`         | `filename` + 内容来源 + 目标知识库     |
| 导出知识库节点为文件 | `yach_space_node` | `export`         | 节点定位符 + `format`                  |

## 新建节点（create）

在知识库中新建一个节点（文件夹/文档/表格/幻灯片/思维导图），成功后返回节点链接(要带标题)，不支持的类型要明确告知用户。

**`node_type`**（必填）：`folder` 文件夹 / `doc` 文档 / `excel` 表格 / `ppt` 幻灯片 / `mindmap` 思维导图

**`name`**（可选）：节点名称，不填则由知识库默认命名

**父节点定位**（二选一，必填其一）：

- 方案一：`kn_space_id`（知识库 ID）+ `kn_parent_node_id`（父节点 ID）
- 方案二：`kn_parent_node_url`（父节点 URL；如需创建在知识库根目录，传知识库 URL）

### 典型用法

```json
// 方案一：在指定父节点下新建文档
{
  "action": "create",
  "node_type": "doc",
  "name": "Q3复盘",
  "kn_space_id": "863720012890910777",
  "kn_parent_node_id": "859501698975150091"
}

// 方案二：通过父节点 URL 新建表格
{
  "action": "create",
  "node_type": "excel",
  "name": "数据汇总",
  "kn_parent_node_url": "https://st.tal.com/a/N9odKi"
}
```

## 移动节点（move）

将知识库节点移动到另一个位置，成功后返回节点链接(要带标题)`。

> **严禁**：不得用「删除旧节点 + 新建节点」的方式替代移动，必须直接调用 `move` action。

**来源定位**（二选一）：

- 方案一：`source_topic_id`（来源知识库 ID）+ `source_node_id`（来源节点 ID）
- 方案二：`source_node_url`（来源节点 URL）

**目标定位**（二选一）：

- 方案一：`target_topic_id`（目标知识库 ID）+ `target_node_id`（目标父节点 ID）
- 方案二：`target_node_url`（目标父节点 URL）

### 典型用法

```json
// 方案一：通过 ID 移动
{
  "action": "move",
  "source_topic_id": "81298464124512937",
  "source_node_id": "86201495021277591",
  "target_topic_id": "81298464124512637",
  "target_node_id": "86201495020582019"
}

// 方案二：通过 URL 移动
{
  "action": "move",
  "source_node_url": "https://st.tal.com/a/otGj4A",
  "target_node_url": "https://st.tal.com/a/7JbziD"
}
```

## 查看节点属性（get_properties）

查看知识库节点的详细属性，返回以下字段：

| 字段              | 说明                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `title`           | 节点标题                                                                                       |
| `guid`            | 文档 GUID                                                                                      |
| `docUrl`          | 文档路径                                                                                       |
| `isFolder`        | 是否为文件夹                                                                                   |
| `secretTag`       | 当前密级标签值，如 `L1` / `L2` / `L3` / `L4`，含义见 [密级与分享权限说明](#密级与分享权限说明) |
| `shareMode`       | 当前分享模式值，如 `private`，含义见 [密级与分享权限说明](#密级与分享权限说明)                 |
| `secret_tag_info` | 所有可用密级列表，每项含 `tag`、`name`、`support_share_mode`（该密级下允许的分享模式值列表）   |
| `share_mode_info` | 所有可用分享模式列表，每项含 `value`、`name`                                                   |
| `updatedAt`       | 最后更新时间（Unix 时间戳）                                                                    |
| `creator`         | 创建人，含 `name`、`uid`、`workCode`                                                           |
| `updatedBy`       | 最后更新人，含 `name`、`uid`、`workCode`                                                       |

`secret_tag_info` 和 `share_mode_info` 是动态枚举，设置属性时应以实际返回值为准，静态说明见 [密级与分享权限说明](#密级与分享权限说明)。

**节点定位**（三选一，必填其一）：

- 方案一：`kn_space_id`（知识库 ID）+ `kn_node_id`（节点 ID）
- 方案二：`guid`（文档 GUID）
- 方案三：`kn_node_url`（节点 URL）

### 典型用法

```json
// 方案一：通过知识库 ID + 节点 ID
{
  "action": "get_properties",
  "kn_space_id": "812984641245126937",
  "kn_node_id": "859521192816685058"
}

// 方案二：通过 GUID
{
  "action": "get_properties",
  "guid": "473QyXLLzjIKDE3w"
}

// 方案三：通过节点 URL
{
  "action": "get_properties",
  "kn_node_url": "https://st.tal.com/a/OtGU7A"
}
```

## 修改节点属性（set_properties）

修改知识库节点的标题、密级标签或分享模式，至少传一个要修改的字段。

> **执行流程（代码强制）**：工具内部会先自动调用 `get_properties` 查询节点当前属性，获取 `secret_tag_info`（可用密级及各密级允许的分享模式）和 `share_mode_info`（可用分享模式列表），再以此为依据校验入参，最终执行修改。无论成功或失败，响应中均会包含这两个动态枚举供参考。

**节点定位**（三选一，必填其一）：

- 方案一：`kn_space_id`（知识库 ID）+ `kn_node_id`（节点 ID）
- 方案二：`guid`（文档 GUID）
- 方案三：`kn_node_url`（节点 URL）

**可修改字段**（至少填一个）：

| 参数         | 说明                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `title`      | 节点新标题                                                                                              |
| `secret_tag` | 密级标签值，必须是 `secret_tag_info[].tag` 中的合法值                                                   |
| `share_mode` | 分享模式值，必须是 `share_mode_info[].value` 中的合法值，且需在修改后密级的 `support_share_mode` 列表内 |

### 典型用法

```json
// 通过节点 URL 修改标题和密级
{
  "action": "set_properties",
  "kn_node_url": "https://st.tal.com/a/OtGU7A",
  "title": "Q3复盘（已更新）",
  "secret_tag": "L2"
}

// 通过 kn_space_id + kn_node_id 修改分享模式
{
  "action": "set_properties",
  "kn_space_id": "812984641245126937",
  "kn_node_id": "859521192816685058",
  "share_mode": "enterprise_commentable"
}
```

## 查询节点列表（list）

查询知识库或指定父节点下的子节点列表，支持分页、时间过滤和类型过滤。

**父节点定位**（二选一，必填其一）：

- `kn_node_id`：知识库 ID 或父节点 ID
- `kn_node_url`：知识库 URL 或父节点 URL

**可选过滤/分页参数**：

| 参数               | 说明                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_type`        | 类型过滤：`folder` 文件夹 / `doc` 文档 / `excel` 表格 / `form` 表单 / `ppt` 幻灯片 / `mindmap` 脑图 / `board` 白板 / `md` Markdown / `pdf` PDF；不填返回全部类型 |
| `last_update_time` | 秒级时间戳，只返回该时间之后更新的节点                                                                                                                           |
| `page_size`        | 每页条数，默认 20，最大 50                                                                                                                                       |
| `next_page_token`  | 分页标记，首次查询不填，后续翻页传上一页返回的值                                                                                                                 |

**返回字段**：`nodes[]`（含 `nodeId`、`title`、`type`、`url`、`hasChildren`、`parentNodeId`、`createDate`、`updateDate`）+ `nextPageToken`（空字符串表示无更多数据）。

### 典型用法

```json
// 查询知识库根目录下所有节点
{
  "action": "list",
  "kn_node_url": "https://st.tal.com/space/xxx"
}

// 查询指定父节点下的文档，翻第二页
{
  "action": "list",
  "kn_node_id": "842007443377701061",
  "list_type": "doc",
  "page_size": 20,
  "next_page_token": "eyJwYWdlIjoyfQ=="
}
```

## 导入（import）

将本地文件或 Markdown 文本内容导入为知识库节点，全流程：COS 上传 → 异步导入 → 轮询完成，成功后返回节点 `file_url`。

**内容来源**（二选一）：

- `file_path`：本地文件绝对路径，支持 `txt / md / doc / docx / csv / xls / xlsx / ppt / pptx / xmind`
- `content`：Markdown 文本内容，以 `.md` 文件导入

**`filename`**（必填）：含扩展名的文件名，同时作为知识库节点标题，例如 `Q2复盘.md`、`培训材料.docx`

**目标知识库**（二选一）：

- `kn_space_id`：知识库 ID
- `kn_space_url`：知识库 URL（以 `https://st.tal.com` 或 `https://s.tal.com` 开头）

**父节点**（二选一，可选）：

- `kn_parent_node_id`：父节点 ID
- `kn_parent_node_url`：父节点 URL

### 典型用法

```json
// 导入 Markdown 文本内容到知识库根目录
{
  "action": "import",
  "content": "## 标题\n正文内容...",
  "filename": "周报.md",
  "kn_space_url": "https://st.tal.com/space/xxx"
}

// 导入本地文件到知识库指定节点下
{
  "action": "import",
  "file_path": "/tmp/培训材料.docx",
  "filename": "培训材料.docx",
  "kn_space_id": "xxx",
  "kn_parent_node_url": "https://st.tal.com/wiki/xxx"
}
```

## 导出（export）

将知识库节点导出为文件，全流程：触发异步导出 → 轮询完成，成功后返回 `download_url`。

**节点定位符**（二选一）：

- `kn_node_id`：知识库节点 ID
- `kn_node_url`：知识库节点 URL（以 `https://kn.tal.com` 或 `https://k.tal.com` 开头）

**`format`**（必填）：文档 `pdf` / `docx` / `jpg` / `md`；表格 `xlsx`；幻灯片 `pptx` / `pdf`；脑图 `jpeg` / `xmind`

### 典型用法

```json
{
  "action": "export",
  "kn_node_url": "https://kn.tal.com/wiki/xxx",
  "format": "pdf"
}
```

## 密级与分享权限说明

> 此节同时适用于 `get_properties`（理解返回值）和 `set_properties`（确定可设置的值）。

密级标签和分享权限的可用值及名称均以接口实际返回的动态字段为准：

- `secret_tag_info`：所有可用密级列表，每项含 `tag`（值）、`name`（名称）、`support_share_mode`（该密级下允许的分享模式值列表）
- `share_mode_info`：所有可用分享模式列表，每项含 `value`（值）、`name`（名称）

设置属性时，`secretTag` 和 `shareMode` 的合法取值以及两者的约束关系，均应以上述接口返回内容为准，不得使用硬编码枚举值。

## ⚠️ 链接呈现规范（回复前再确认一次）

- ❌ 错误：`文档链接：https://st.tal.com/a/wM2iny`
- ✅ 正确：`https://st.tal.com/a/wM2iny 《Q3复盘》`
- ✅ 正确（无标题时）：`https://st.tal.com/a/wM2iny`

## 常见错误

- `import` 时 `filename` 未填 → 工具直接返回错误，补充 `filename` 参数
- `export` 时 `format` 未填 → 工具直接返回错误，补充 `format` 参数
- `create` 时 `node_type` 未填 → 工具直接返回错误，补充 `node_type` 参数
- `create` 时父节点定位缺失 → 工具直接返回错误，补充 `kn_space_id+kn_parent_node_id` 或 `kn_parent_node_url`
- `get_properties` 时节点定位缺失 → 工具直接返回错误，补充 `kn_space_id+kn_node_id`、`guid` 或 `kn_node_url` 三选一
- `set_properties` 时节点定位缺失 → 工具直接返回错误，同 `get_properties` 三选一
- `set_properties` 时未填任何修改字段 → 工具直接返回错误，至少填一个（`title` / `secret_tag` / `share_mode`）
- `set_properties` 设置的 `share_mode` 与当前密级不兼容 → 接口返回错误，先查询节点属性确认 `secret_tag_info` 中该密级允许的分享模式
- `list` 时父节点定位缺失 → 工具直接返回错误，补充 `kn_node_id` 或 `kn_node_url`
- 导入/导出超时 → 工具内部已自动轮询，若仍超时稍后重试
- OAuth 授权失败 → 需要 OAuth 授权，引导用户完成授权流程
