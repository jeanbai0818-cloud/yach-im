---
name: yach-weekly
description: 知音楼周报能力。用户要"查周报/看周报列表/查询团队周报/查看上周周报/统计周报数据/查看某人周报/查看我的周报草稿/读草稿/保存周报草稿/写周报草稿/补充周报草稿"时使用。
---

> **⚠️ 隐私与最小化原则**
> - 周报内容可能包含个人工作敏感信息。向用户展示结果时，仅输出与请求直接相关的摘要或片段，不要将完整原文大段返回。
> - 查询他人周报时，应仅展示公开可见范围内的内容，不做过度解读或推测。
> - 禁止将周报内容用于非用户明确请求的用途（如自动转发、生成对外报告等）。

> **⚠️ 链接呈现规范（极其重要）：向用户输出任何回复之前，必须扫描回复中所有文档链接和知识库节点链接，按以下规则逐一检查并就地修正后再输出。**
> - ✅ 有标题时：`链接 《标题》`，例如 `https://st.tal.com/a/wM2iny 《Q3复盘》`；符号支持 `《》【】<>「」`，优先书名号
> - ✅ 无标题时：只返回链接本身
> - 🚫 禁止：裸输出已知标题的链接；禁止输出后再解释"忘加标题"——发现错误须在输出前修正

## 工具：`yach_weekly`（需 OAuth 授权）

## 核心场景识别

- 用户要"查周报/看周报列表/查询团队周报/查看上周周报/统计周报数据/查看某人周报" → 使用 `action: "list"`
- 用户要"查看我的周报草稿/读草稿/我的草稿是什么/现在草稿有什么内容" → 使用 `action: "get_draft"`
- 用户要"保存周报草稿/写周报草稿/补充周报草稿/把这些内容写到周报草稿" → 使用 `action: "save_draft"`
- 用户要"修改草稿里某块内容/把本周内容改成XXX" → 使用 `action: "save_draft"` + `replace_content: true`
- 用户要"全部重新写/不要旧的草稿/从头开始写" → 使用 `action: "save_draft"` + `overwrite: true`

---

## Action 概览

| 意图                     | action                                 | 必填                                    |
| ------------------------ | -------------------------------------- | --------------------------------------- |
| 查周报列表               | `list`                                 | 无                                      |
| 读取我的周报草稿         | `get_draft`                            | `weekly_type`                           |
| 保存周报草稿（合并追加） | `save_draft`                           | `weekly_type`（`content` 有新内容时填） |
| 修改旧草稿某块内容       | `save_draft` + `replace_content: true` | `weekly_type`, `content`                |
| 覆盖草稿（全部重新写）   | `save_draft` + `overwrite: true`       | `weekly_type`, `content`                |

---

## `list` - 查周报列表

### 可选参数

- `query_type`：筛选类型
  - `person`：按用户筛选
  - `department`：按部门筛选
  - `team_id`：按伙伴分组ID筛选
  - `team_name`：按伙伴分组名称筛选
- `query_value`：**【必填】当 `query_type` 存在时，此参数必填**
  - `person`：工号
  - `department`：部门ID
  - `team_id`：分组ID
  - `team_name`：分组名称
- `start_date`：开始日期，格式 `YYYY-MM-DD`（UTC+0），不传默认前一天
  - **注意**：请严格使用 `YYYY-MM-DD` 格式，如 `2026-04-14`，传入格式错误的日期会导致服务端返回通用错误
- `end_date`：结束日期，格式 `YYYY-MM-DD`（UTC+0），不传默认今天
  - **注意**：请严格使用 `YYYY-MM-DD` 格式，如 `2026-04-14`，传入格式错误的日期会导致服务端返回通用错误
- `unread`：是否只返回未读，`true`=仅未读，`false`=包含已读（默认）
- `sort`：排序方式，`asc`=升序，`desc`=降序（默认）
- `next_page`：分页标识，从上一次查询的返回值中获取，用于翻页

### 返回数据结构

- `list`：周报数据列表
  - `id`：周报记录ID
  - `user`：填报人信息
    - `user_id`：用户ID
    - `work_code`：工号
    - `name`：姓名
  - `weekly`：周报内容
    - `content`：周报事项列表（按OKR或分类划分）
      - `title`：事项标题
      - `content`：具体工作描述
      - `kr_id`：关联的OKR KR ID，-1表示非OKR事项
      - `object_id`：关联的OKR Objective ID
      - `okr_title`：对应的OKR目标标题或分类名称
    - `attachment`：附件列表
    - `read_count`：已读人数
    - `like_count`：点赞人数
    - `is_read`：当前用户是否已读
- `next_page`：下一页分页标识

### 数据返回约束

- **按需返回**：根据用户请求意图返回相关内容，不做无差别全量输出
  - 用户要"看某人周报" → 返回该人周报摘要，用户要求详情时再展开
  - 用户要"统计数据" → 仅返回统计字段（read_count、like_count 等）
  - 用户要"看附件" → 返回附件链接列表
- **避免内容失真**：保持返回内容的准确性，不编造或推测
- **附件处理**：附件以链接形式呈现，不主动展开描述图片内容
- **分页处理**：如果数据量较大导致需要分页，应明确告知用户并提供继续翻页的方式
- **隐私优先**：查看他人周报时遵循最小化原则，仅展示与用户请求直接相关的信息

### 参数组合注意事项

1. **query_type 与 query_value 组合**
   - `query_type` 存在时，`query_value` **必须**填写
   - 不允许只传 `query_type` 不传 `query_value`
   - 示例：`query_type=person&query_value=167680` ✅
   - 示例：`query_type=person` ❌（缺少 query_value）

2. **日期参数格式**
   - `start_date` 和 `end_date` 必须严格使用 `YYYY-MM-DD` 格式
   - 错误格式会被服务端拒绝，返回「服务器开小差」等不友好错误
   - 正确示例：`2026-04-14` ✅
   - 错误示例：`2026/04/14`、`04-14-2026`、`invalid-date` ❌

3. **常见错误**
   - `need_auth=true` → 先完成 OAuth 授权
   - `query_value is required when query_type is set` → `query_type` 存在时必须传 `query_value`
   - `服务器竟然开小差` → 可能是日期格式错误，请检查 `YYYY-MM-DD` 格式

4. **前置查询能力**
   - 如果用户提到"某人的周报"、"我的周报"等，需要先通过 `yach_search_user` 获取工号
   - 如果用户提到查询"某某的分组"、"我的下级"、"我的上级和下级"、"特别关注"等，需要先通过`yach-list-teams` 能力获取对应的伙伴分组ID或者伙伴分组名称
   - **编辑 OKR 周报草稿（weekly_type: 3）时，`save_draft` 无论哪种模式都最先查询 OKR 详情并随结果返回 `okr` 字段**；查不到则直接报错不继续；**严禁手动调用 `yach_okr` 的任何查询（包括 list）来获取 OKR 信息**；若收到"未查询到 OKR"，应告知用户先创建 OKR

5. **图片和附件处理**（⚠️ 特别重要）
   - **严禁省略图片**：必须完整返回周报中的所有图片、截图、图表等视觉内容
   - **图片信息必须详细**：对于图片内容要尽可能详细描述其中的文字、数据、图表信息
   - **附件完整性**：确保所有文件附件的链接和信息都正确返回
   - **格式保持**：保持图片和附件的原始格式，不得因处理而丢失信息
   - **常见错误避免**：不要因为图片格式、大小或内容复杂度而省略或简化图片信息

### 返回值 JSON 示例（含图片）

```json
{
  "list": [
    {
      "id": "weekly_12345",
      "user": {
        "user_id": "user_67890",
        "work_code": "167680",
        "name": "张三"
      },
      "weekly": {
        "content": [
          {
            "title": "完成用户模块开发",
            "content": "本周完成了用户登录、注册功能的开发和测试，修复了5个bug，性能提升了20%",
            "kr_id": "kr_001",
            "object_id": "obj_001",
            "okr_title": "提升用户体验"
          }
        ],
        "attachment": [
          {
            "file_name": "详细报告.pdf",
            "file_url": "https://example.com/report.pdf",
            "file_type": "document"
          },
          {
            "file_name": "进度图表.png",
            "file_url": "https://example.com/chart.png",
            "file_type": "image",
            "description": "展示了本周各任务完成情况的柱状图，包含任务名称、预计时间和实际时间对比"
          },
          {
            "file_name": "界面截图.jpg",
            "file_url": "https://example.com/screenshot.jpg",
            "file_type": "image",
            "description": "新开发的用户注册界面截图，包含表单布局和样式设计"
          }
        ],
        "read_count": 12,
        "like_count": 5,
        "is_read": false
      }
    }
  ],
  "next_page": "eyJwYWdlIjoiMjAwIn0="
}
```

---

## `get_draft` - 读取周报草稿

### 使用场景

当用户要"查看我的周报草稿"、"现在的草稿是什么"、"读草稿"、"帮我看看周报草稿内容"时，使用 `action: "get_draft"`。

只读操作，不会修改任何内容。

### 参数速查

| 参数          | 必填 | 说明                                               |
| ------------- | ---- | -------------------------------------------------- |
| `action`      | ✅   | 固定传 `get_draft`                                 |
| `weekly_type` | ✅   | 周报类型：`1`=普通周报，`2`=复盘周报，`3`=OKR 周报 |

### 返回结构

返回当前用户指定类型的周报草稿原始内容：

```json
{
  "weekly_type": 1,
  "receive_work_codes": ["111111"],
  "receive_og_ids": [],
  "receive_groups": [],
  "is_send_group": false,
  "content": [
    { "type": "weekly", "cycle": 1, "content": "本周完成..." },
    { "type": "weekly", "cycle": 2, "content": "下周计划..." },
    { "type": "user_thinking", "content": "" },
    { "type": "experience", "content": "" },
    { "type": "introspection", "content": "" },
    { "type": "remark", "content": "" }
  ],
  "attachment": []
}
```

### 常见错误与处理

- `get_draft: weekly_type 为必填` → 补充周报类型，普通周报传 `1`，复盘周报传 `2`，OKR 周报传 `3`
- `need_auth=true` → 先完成 OAuth 授权
- 权限不足 → 需要申请 `weekly:draft:info` scope

---

## `save_draft` - 保存周报草稿

### ⚠️ 最高优先级规则——必须完整阅读并严格遵守

**必须遵守：**

1. **【最高优先级】用户未明确要求修改或覆盖旧草稿内容时，必须使用 `save_draft` 默认合并策略，绝对禁止擅自使用 `replace_content: true` 或 `overwrite: true`**；只有用户明确表达"修改某块内容"时才传 `replace_content: true`，明确表达"全部重新写/不要旧的"时才传 `overwrite: true`
2. **【最高优先级】凡是会清除或覆盖旧草稿内容的操作（即使用 `overwrite: true` 或 `replace_content: true`），执行前必须先向用户明确确认，告知将要覆盖的内容范围，得到用户明确同意后才能执行**；用户未明确回复确认的，不得执行
3. **`content` 字段使用标准 Markdown 语法**，但 🚫 **禁止使用 Markdown 表格、删除线语法，并且禁止随意增加一些自然线条，竖线、图标等进行修饰，使用Markdown 语法时尽量用一些简单的语法规则**
4. **换行必须用 `\n\n`（两个换行符）**，三种周报类型均适用，无一例外，禁止用单个 `\n`
5. **`save_draft`（weekly_type: 3）无论哪种写入模式，都会先查询 OKR 详情，查不到则直接报错不继续执行；查到后完成内容处理和保存，并随结果返回 `okr` 字段**；合并模式用旧草稿的 kr_id 查，覆盖模式用入参内容的 kr_id 查，都找不到有效 kr_id 时用 `current=true` 查当前季度 OKR；必须以返回的 `okr` 字段作为 KR 归类依据；若返回"未查询到 OKR"，**只能告知用户先创建 OKR，严禁自行改写为其他类型周报或执行任何其他写入操作，此流程到此结束**；**OKR 详情由工具内部自动查询，严禁手动调用 `yach_okr` 的 list 查询来获取 OKR 信息**
6. **@提及人员必须先调 `yach_search_user` 查询获得 `userId`**，格式为 `[@名字](uuid:用户ID)`；禁止用工号、禁止猜测用户ID
7. **普通周报必须且只能有 6 个固定块**（`weekly` cycle=1、`weekly` cycle=2、`user_thinking`、`experience`、`introspection`、`remark`），不能多也不能少
8. **复盘周报必须且只能有 2 个固定块**（`weekly` cycle=1、`user_thinking`），不能多也不能少
9. **OKR 周报底部 4 个固定块必须始终存在**（`user_thinking`、`experience`、`introspection`、`remark`），无论有无内容
10. **要用自然语言和用户沟通，禁止出现技术层面的用语比如weekly_type、overwrite、replace_content等**
11. **调用 `save_draft` 时，凡是未指定字段（如接收人工号、接收群组、接收部门等），必须按照旧草稿传入，绝对禁止擅自丢弃和修改**；用户未提供的字段由工具自动沿用旧草稿，无需手动传入
12. **【非常重要】接收人/接收部门/接收群组（`receive_work_codes`/`receive_og_ids`/`receive_groups`）受授权机制保护**：只有当用户在本轮明确要求改动这些设置时，才可以修改；具体通过 `recipient_change_reason` 和 `recipient_fields_allowed_to_change` 两个字段表达（详见下方「接收设置修改授权」）；其余任何情况一律不要填写这三个接收字段，工具会自动沿用旧草稿
13. **当工具返回字段缺失、重复、数量有误等结构异常错误时，必须自动修正数据格式后重新调用**
14. **调用保存接口前，必须按对应周报类型的结构规则严格自查传入的所有字段，尤其是`content` 数组**：普通周报必须恰好 6 块（本周×1、下周×1、用户心声×1、心得×1、反思×1、备注×1）；复盘周报必须最多2块（本周×1，用户心声x0或x1）；OKR 周报底部 4 块必须存在且各只有 1 个；发现问题先修正再提交

**禁止出现：**

1. 🚫 **禁止出现重复的 `cycle=1` 或 `cycle=2` weekly 块**（普通/复盘周报）；所有本周内容只写进唯一的 `cycle=1` 块，下周内容只写进唯一的 `cycle=2` 块
2. 🚫 **禁止在普通/复盘周报的 `weekly` 块上传 `kr_id`、`object_id`、`okr_title`**；这些字段仅 OKR 周报使用
3. 🚫 **禁止给 `user_thinking`、`experience`、`introspection`、`remark` 传 `cycle`**；没有内容时 `content` 传空字符串
4. 🚫 **OKR 周报返回"未查询到 OKR"时，禁止自行改写为普通周报或其他类型周报**；只能停止操作并告知用户先创建 OKR
5. 🚫 **所有周报类型，禁用自动帮用户润色，除非用户明确要求**
8. 🚫 **禁止在 `content` 正文中生成与系统字段标题含义相似的文案**（如"本周完成："、"下周计划："、"用户心声："、"心得："等），系统已有标题展示，重复写入会让用户看到两个标题
6. 🚫 **禁止自行生成 OKR 关联信息**（包括 `kr_id`、`object_id`、`okr_title` 等），所有 OKR 信息必须以工具接口查询结果为准，不得凭语义猜测或主观填写
7. 🚫 **当用户明确指定要填写的周报类型时（如"写普通周报"、"写 OKR 周报"），禁止擅自更改为其他类型**；若类型与已有草稿不匹配，应直接告知用户，不得私自切换

---

### 使用场景

当用户要"保存周报草稿"、"写入周报草稿"、"帮我把这些内容补到周报草稿里"时，使用 `action: "save_draft"`。

**重要流程**：工具内部会先读取当前用户已有周报草稿，再将本次传入的新内容与已有草稿合并，最后保存草稿。不要让用户手动提供完整旧草稿。

### 参数速查

| 参数                 | 必填                       | 说明                                                                                                                            |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `action`             | ✅                         | 固定传 `save_draft`                                                                                                             |
| `weekly_type`        | ✅                         | 周报类型：`1`=普通周报，`2`=复盘周报，`3`=OKR 周报                                                                              |
| `content`            | 覆盖模式必填，合并模式可选 | 本次新增或补充的周报内容数组；仅更新接收人/附件等字段时可不传，工具会直接沿用旧草稿内容                                         |
| `recipient_change_reason` | 修改接收设置时必填  | 用户本轮要求改动接收设置的理由，须引用用户原话关键词；**必须先于 `recipient_fields_allowed_to_change` 填写**                  |
| `recipient_fields_allowed_to_change` | 修改接收设置时必填 | 用户授权可修改的接收字段数组，取值 `receive_work_codes`/`receive_og_ids`/`receive_groups`；理由为空时必须为空数组              |
| `receive_work_codes` | —                          | 除默认接收人外的接收人工号数组；仅当列入 `recipient_fields_allowed_to_change` 才生效                                            |
| `receive_og_ids`     | —                          | 接收部门 ID 数组；仅当列入 `recipient_fields_allowed_to_change` 才生效                                                          |
| `receive_groups`     | —                          | 接收群组 ID 数组；仅当列入 `recipient_fields_allowed_to_change` 才生效                                                          |
| `is_send_group`      | —                          | 是否推送到群聊，`receive_groups` 不为空时生效                                                                                   |
| `attachment`         | —                          | 本次新增附件数组                                                                                                                |
| `replace_content`    | —                          | 默认 `false`（合并追加）；传 `true` 时匹配到的旧草稿内容块被整体替换，而非追加。**仅在用户明确要求修改某块旧内容时才传 `true`** |
| `overwrite`          | —                          | 默认 `false`；传 `true` 时不读取旧草稿，直接用新内容整体覆盖保存。**仅在用户明确表达全部重新写、不要旧草稿时才传 `true`**       |

### 接收设置修改授权（⚠️ 极其重要，必须严格遵守）

> 接收人 `receive_work_codes`、接收部门 `receive_og_ids`、接收群组 `receive_groups` 是高风险字段，误改会导致周报发错人。为防止大模型在写正文或覆盖草稿时擅自改动它们，引入两个授权字段，**必须按顺序先填理由、再填授权清单**：

1. **先填 `recipient_change_reason`（理由，必须在前）**：
   - 只有当用户在本轮对话中**明确要求**改动接收设置时才填写，并在理由中**引用用户原话的关键词**（如"把周报发给张三"、"抄送李四"、"接收人改成…"、"加上 XX 部门"、"推送到 XX 群"等）
   - 如果用户本轮**没有**提到改动接收设置，此字段**必须留空**

2. **再填 `recipient_fields_allowed_to_change`（授权清单，必须在后）**：
   - 仅把用户明确要求修改的字段名放进数组，取值为 `receive_work_codes`/`receive_og_ids`/`receive_groups`
   - **若 `recipient_change_reason` 为空，此数组必须为空数组 `[]`**

3. **生效规则**：
   - 只有列入 `recipient_fields_allowed_to_change` 的接收字段，其入参值才会被采用；未列入的字段一律沿用旧草稿，工具不会改动
   - 因此：单纯写正文、补充内容、覆盖正文时，**不要填写任何接收字段，也不要填这两个授权字段**

4. **示例**：
   - 用户说"把这周的周报也发给王五（工号 167680）" → `recipient_change_reason: "用户要求把周报发给王五，原话『也发给王五』"`，`recipient_fields_allowed_to_change: ["receive_work_codes"]`，`receive_work_codes: ["167680"]`
   - 用户只说"帮我把本周内容补充一下" → 三个授权/接收字段全部不填

### 必填参数

- `weekly_type`：周报类型
  - `1`：普通周报
  - `2`：复盘周报
  - `3`：OKR 周报
- `content`：本次新增或补充的周报内容数组；覆盖模式（`overwrite: true`）下必填；合并模式下**仅更新接收人/附件等字段时可不传**，工具会直接沿用旧草稿内容，不要把已有草稿内容重新传入

### `content` 字段说明

- `type`：内容类型，常见值：
  - `weekly`：周报正文
  - `user_thinking`：用户心声
  - `experience`：心得
  - `introspection`：反思
  - `remark`：备注
- `content`：具体文本内容，用 `\n\n` 换行

  **@提及人员（AT）**：
  - 格式：`[@名字](uuid:用户ID)`，其中用户ID必须是 `yach_search_user` 查询到的 `userId` 字段值
  - **禁止使用工号**替代用户ID；禁止在未查询的情况下猜测用户ID
  - 示例：`[@张三](uuid:34615343)`
  - 如需 @ 多人，每处单独书写，嵌入到正文对应位置即可：`完成了某某工作 [@张三](uuid:34615343) [@李四](uuid:56781234) 已确认`

- `cycle`：**仅 `type=weekly` 时使用**，`1`=本周，`2`=下周；`user_thinking`、`experience`、`introspection`、`remark` 等类型不要传 `cycle`
- `kr_id`：OKR 周报关联 KR ID；非 OKR 事项可传 `-1`
- `object_id`：OKR Objective ID 或其他分类标识
- `okr_title`：OKR 目标标题或分类名称。**不要自行创建或猜测此字段**；AI 应根据已知 KR 标题/语义判断内容归属，最终必须尽量传 `kr_id`。`okr_title` 只作为说明信息，不作为主要定位依据

### 三种周报的 `content` 结构要求

> ⚠️ 以下结构规则必须严格遵守，违反会导致草稿页面字段缺失或内容重复。

#### 普通周报（weekly_type: 1）

**必须且只能有以下 6 个固定块，一个不能少，一个不能多：**

| type            | cycle | 说明     |
| --------------- | ----- | -------- |
| `weekly`        | `1`   | 本周完成 |
| `weekly`        | `2`   | 下周计划 |
| `user_thinking` | 不传  | 用户心声 |
| `experience`    | 不传  | 心得     |
| `introspection` | 不传  | 反思     |
| `remark`        | 不传  | 备注     |

**以下行为严禁出现（同样适用于复盘周报）：**

- 🚫 禁止出现两个 `cycle=1` 或两个 `cycle=2` 的 `weekly` 块；所有本周内容只能写进唯一的 `cycle=1` 块，所有下周内容只能写进唯一的 `cycle=2` 块
- 🚫 禁止在 `weekly` 块上传 `kr_id`、`object_id`、`okr_title`；这些字段仅 OKR 周报使用
- 🚫 禁止给 `user_thinking`、`experience`、`introspection`、`remark` 传 `cycle`；没有内容时 `content` 传空字符串；不得生成重复字段；

#### 复盘周报（weekly_type: 2）

**必须且只能有以下 2 个固定块：**

| type            | cycle | 说明     |
| --------------- | ----- | -------- |
| `weekly`        | `1`   | 本周复盘 |
| `user_thinking` | 不传  | 用户心声 |

- 🚫 禁止新增额外的 `weekly` 块，禁止在 `weekly` 块上传 `kr_id`、`object_id`、`okr_title`，禁止给 `user_thinking` 传 `cycle`；没有内容时 `content` 传空字符串
- `weekly`、`user_thinking`每种类型不得生成重复字段；

#### OKR 周报（weekly_type: 3）

**底部 4 个固定块必须始终存在（无论有无内容）（一个不能多一个不能少）：**

| type            | cycle | 说明     |
| --------------- | ----- | -------- |
| `user_thinking` | 不传  | 用户心声 |
| `experience`    | 不传  | 心得     |
| `introspection` | 不传  | 反思     |
| `remark`        | 不传  | 备注     |

**`weekly` 块按用户实际选择的 KR 动态生成：**

- 每个选中的 KR 可有 `cycle=1`（本周）和 `cycle=2`（下周）两项，必须携带 `kr_id`
- OKR 外的其他工作使用 `kr_id: -1`
- 未被用户提及的 KR **不要主动生成** `weekly` 项
- 底部 4 个固定块**禁止传 `cycle`**，没有内容时 `content` 传空字符串

### 可选参数

- `receive_work_codes`：除默认接收人以外的接收人工号数组
- `receive_og_ids`：接收部门 ID 数组
- `receive_groups`：接收群组 ID 数组
- `is_send_group`：是否推送到群聊，`receive_groups` 不为空时生效
- `attachment`：本次新增附件数组
  - `name`：附件名称
  - `origin_url`：附件原始下载/预览链接

### 合并规则

- 工具按 `type + cycle + kr_id + object_id + okr_title` 匹配已有草稿内容项
- OKR/其他工作 `weekly` 项按 `type + cycle + kr_id` 合并，避免同一 KR 因标题或 Objective 信息差异被重复创建
- 命中已有项时，将新 `content` 追加到旧内容后面；若旧内容已包含新内容，则不重复追加
- 未命中已有项时，追加为新的草稿内容项
- OKR 周报不会自动创建空的 KR 内容块，因为工具无法知道左侧实际选中了哪些 KR；只会补齐心声、心得、反思、备注
- OKR 周报保存时会过滤空的 `weekly` KR/其他工作块；如果内容只写在“其他工作”，不会提交其他空 KR 栏目
- 附件按 `name + origin_url` 去重合并
- 未传的接收人、群组、分享等配置会沿用已有草稿

### 内容归类与分条规则

**所有周报类型通用**：

- 🚫 **换行必须使用 `\n\n`（两个换行符），禁止使用单个 `\n`**；条目之间、段落之间一律如此，普通周报、复盘周报、OKR 周报均适用，无一例外
- 用户已经分条、编号或换行时，必须保留分条结构，并以 `\n\n` 对齐
- **多级编号规则**：使用多级编号时，二级编号必须在每个一级编号下独立从头递增，禁止跨一级编号连续累加。例如：
  ```
  一、xxx
  　1. aaa
  　2. bbb
  二、yyy
  　1. ccc   ← 从 1 重新开始，而不是 3
  　2. ddd
  ```
- 属于心声、心得、反思、备注的内容，放入对应 `type` 字段，同样使用 `\n\n` 分隔
- 🚫 **禁止生成表格**：工作台周报不支持表格，遇到表格内容必须转换为其他形式（如分条文字、换行列举等）

**普通周报 / 复盘周报**：

- 多条工作事项必须在同一个 `content` 内用 `\n\n` 分隔，**不能堆在一行**

**OKR 周报**：

- **OKR 结构由工具在 `save_draft` 中最先查询**（合并模式用旧草稿的 kr_id，覆盖模式用入参的 kr_id，都无有效 kr_id 时用 `current=true`），**查不到则直接报错不继续；查到后完成内容处理和保存，并随结果返回 `okr` 字段**（结构为 `okr.content[].krs[].id` 和 `krs[].title`）；必须以返回的 `okr` 字段作为 KR 归类依据，**严禁手动调用 `yach_okr` 的任何查询（包括 list）来获取 OKR 信息**
- 能匹配到某条 KR 时必须传该 KR 的 `kr_id`，不要只传 `okr_title`；只有内容确实无法归入任何 KR（行政、培训等与 KR 无关事项）时才传 `kr_id: -1`；**禁止在已有 OKR 结构的情况下将所有内容放到 `kr_id: -1`**；若首次保存后发现 kr_id 归类有误，用 `replace_content: true` 修正
- 同一段内容涉及多个 KR 时，要按 KR 拆成多个 `weekly` 项分别写入
- 每个 `weekly` 块内的多条事项同样必须用 `\n\n` 分隔，**不能堆在一行**

### 返回结构

保存成功后返回合并后的草稿核心信息：

```json
{
  "ok": true,
  "weekly_type": 1,
  "content": [
    {
      "type": "weekly",
      "cycle": 1,
      "content": "合并后的本周内容"
    }
  ],
  "attachment": [
    {
      "name": "附件.pdf",
      "origin_url": "https://example.com/file.pdf"
    }
  ]
}
```

| 字段          | 说明                                             |
| ------------- | ------------------------------------------------ |
| `ok`          | 是否保存成功                                     |
| `weekly_type` | 本次保存的周报类型                               |
| `content`     | 读取旧草稿并合并新内容后的完整内容数组           |
| `attachment`  | 合并去重后的附件数组；没有附件时可能为空或不存在 |

### 典型工作流

**普通/复盘周报**：

```
用户提供内容
→ 判断 weekly_type（1 或 2）
→ 整理为 content 数组
→ 调用 yach_weekly { action: "save_draft", weekly_type, content }
→ 工具内部读取现有草稿 → 合并 → 保存
→ 返回合并后的草稿内容
```

**OKR 周报（weekly_type: 3）**：

```
用户提供内容
→ 整理为 content 数组（kr_id 尽量按已知 OKR 结构填写）
→ 调用 yach_weekly { action: "save_draft", weekly_type: 3, content }
  工具内部（合并模式）：
    1. 读取旧草稿
    2. 用旧草稿的 kr_id（或 current=true）查询 OKR 详情
       → 查不到则直接报错，不执行后续步骤
    3. 合并新内容
    4. 保存
    5. 返回最终的草稿内容
  工具内部（覆盖模式 overwrite: true）：
    1. 用入参内容的 kr_id（或 current=true）查询 OKR 详情
       → 查不到则直接报错，不执行后续步骤
    2. 构建新内容
    3. 保存
    4. 返回最终的草稿内容
→ 根据返回的 okr.content[].krs[].id 和 krs[].title 验证 kr_id 归类是否准确
→ 若归类有误，再次调用 save_draft + replace_content: true 修正
```

### 常见错误与处理

- `save_draft: weekly_type 为必填` → 补充周报类型，普通周报传 `1`，复盘周报传 `2`，OKR 周报传 `3`
- `save_draft: content 为必填` → 至少提供一条要写入草稿的内容
- `need_auth=true` → 先完成 OAuth 授权
- 权限不足或 scope 缺失 → 需要申请 `weekly:draft:info`（读取草稿）和 `weekly:draft:save`（保存草稿）
- 草稿内容重复 → 工具会避免完全重复追加；如果用户明确要求重复保留，需要改写为不同内容再保存

### 使用示例

#### 普通周报

```json
{
  "action": "save_draft",
  "weekly_type": 1,
  "content": [
    {
      "type": "weekly",
      "cycle": 1,
      "content": "完成周报草稿保存能力接入\n\n联调读草稿和保存草稿接口\n\n补充 skill 使用说明"
    },
    {
      "type": "weekly",
      "cycle": 2,
      "content": "验证线上 OAuth scope\n\n根据用户反馈优化草稿合并策略"
    },
    {
      "type": "user_thinking",
      "content": ""
    },
    {
      "type": "experience",
      "content": ""
    },
    {
      "type": "introspection",
      "content": "后续新增能力时需要同步补齐工具、OAPI、scope 和 skill 文档。"
    },
    {
      "type": "remark",
      "content": ""
    }
  ]
}
```

#### OKR 周报

示例中选择了一个 KR（`kr_id: 414374`）和“其他工作”（`kr_id: -1`）。如果用户没有选择某个 KR，就不要为该 KR 生成 `weekly` 项。

```json
{
  "action": "save_draft",
  "weekly_type": 3,
  "content": [
    {
      "type": "weekly",
      "cycle": 1,
      "kr_id": 414374,
      "content": "完成周报草稿读写接口接入\n\n按现有工具规范补齐参数校验"
    },
    {
      "type": "weekly",
      "cycle": 2,
      "kr_id": 414374,
      "content": "继续联调草稿保存接口\n\n确认不同周报类型下的字段兼容性"
    },
    {
      "type": "weekly",
      "cycle": 1,
      "kr_id": -1,
      "content": "同步后端确认周报草稿读取和保存的 OAuth scope"
    },
    {
      "type": "weekly",
      "cycle": 2,
      "kr_id": -1,
      "content": "继续验证草稿保存后的页面展示\n\n确认保存字段完整性"
    },
    {
      "type": "user_thinking",
      "content": ""
    },
    {
      "type": "experience",
      "content": ""
    },
    {
      "type": "introspection",
      "content": "OKR 周报除了 KR 对应事项，也需要保留心声、心得、反思、备注等固定段落。"
    },
    {
      "type": "remark",
      "content": ""
    }
  ]
}
```

#### 复盘周报

```json
{
  "action": "save_draft",
  "weekly_type": 2,
  "content": [
    {
      "type": "weekly",
      "cycle": 1,
      "content": "本次复盘：周报草稿保存能力已完成工具层、OAPI 层和 skill 文档补充，整体流程遵循先读草稿再合并保存。"
    },
    {
      "type": "user_thinking",
      "content": "后续需要重点关注接口真实返回结构，以及草稿合并策略是否符合用户预期。"
    }
  ]
}
```

## ⚠️ 链接呈现规范（回复前再确认一次）

- ❌ 错误：`文档链接：https://st.tal.com/a/wM2iny`
- ✅ 正确：`https://st.tal.com/a/wM2iny 《Q3复盘》`
- ✅ 正确（无标题时）：`https://st.tal.com/a/wM2iny`
