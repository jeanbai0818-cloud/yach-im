---
name: yach-im
description: >
  知音楼 IM 消息能力：读取群历史消息、撤回消息。
  以下场景必须使用此 skill：
  用户要查看/搜索群聊记录、统计群内信息；
  用户要撤回已发送的消息。
---

## 工具总览

| 意图 | 工具/命令 |
| --- | --- |
| 读取群历史消息 | `yach_im_get_messages`（app token） |
| 机器人发消息 | `message send --channel yach` |
| 撤回消息 | `yach_im_message_recall`（app token） |

---

## yach_im_get_messages — 读取群历史消息

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `group_id` | 必填 | 群 ID |
| `start_time` | 必填 | 开始时间，ISO 8601 含时区，如 `2024-01-01T00:00:00+08:00` |
| `end_time` | 必填 | 结束时间，ISO 8601 含时区 |
| `page_size` | 可选 | 每页条数，默认 20，最大 50 |
| `page_token` | 可选 | 翻页令牌，首次不填，后续从响应取 |

**返回结构**：`{ messages[], hasMore, pageToken }`

| 字段 | 说明 |
| --- | --- |
| `senderName` | 发送者名称 |
| `content` | 消息正文（格式依 type 而定） |
| `type` | `text` / `image` / `card` |
| `time` | **毫秒级**时间戳 |
| `workCode` | 工号；机器人为 `"-1"` |
| `userType` | `1`=用户 `2`=机器人 |

**content 解析**：
- `text`：纯文本，可能含 `@提及`、表情 `[呲牙]`
- `image`：图片完整 URL
- `card`：Markdown 格式，含链接 `[文字](url)` 和图片 `![](url)`；文档链接见 `yach-doc-read`

**注意**：`start_time`/`end_time` 是 ISO 8601，返回的 `time` 是毫秒级，单位不同。`hasMore=true` 时用 `pageToken` 翻页。

---

## message send — 机器人发消息到群/单聊

群 ID 必须加 `group:` 前缀，否则走单聊 API 报错：

```bash
# 发群消息
message send --channel yach --target group:63259463742 --message "内容"

# 发单聊（by yach_id）
message send --channel yach --target user:yach_xxx --message "内容"

# 发单聊（by 工号）
message send --channel yach --target 10086 --message "内容"
```

---

## yach_im_message_recall — 撤回消息

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `msg_id` | 必填 | 要撤回的消息 ID |

---

## 常见错误

- 消息为空 → 检查时间范围（start/end_time 为 ISO 8601 格式）
- `10003 to_user_id 不存在` → 发群消息时目标缺少 `group:` 前缀
- `card` 内容混乱 → 按 Markdown 解析即可
