# Yach IM — OpenClaw 知音楼插件

把知音楼（Yach）接入 OpenClaw，让 AI 助手直接在企业 IM 里工作。

---

## 能做什么

### 消息渠道

在知音楼的单聊、群聊、机器人会话里直接与 AI 对话，支持流式回复和长文本卡片展示。

### 18 个工作场景工具

| 分类 | 工具 | 能力 |
|------|------|------|
| **IM 消息** | `yach_im_get_messages` `yach_im_user_messages` `yach_im_message_recall` | 读取历史消息、发送消息、撤回消息 |
| **日历** | `yach_calendar` | 查询和创建日历事件、查看参与者 |
| **通讯录** | `yach_search_user` `yach_list_teams` | 按姓名/工号/ID 查找同事，查询伙伴分组 |
| **文档** | `yach_doc_summarize` `yach_doc_append` `yach_doc_file` `yach_doc_admin` `yach_doc_sheet` | 读取/总结/导出/追加文档，操作表格 |
| **知识空间** | `yach_space_node` | 浏览和操作知识库节点 |
| **会议** | `yach_meeting_record_text` | 获取会议纪要文字 |
| **OKR** | `yach_okr` | 查询和更新 OKR 目标与进展 |
| **周报** | `yach_weekly` | 读取/起草/保存周报草稿，查询团队周报 |
| **专题** | `yach_topic_publish_post` `yach_topic_publish_comment` | 发布专题帖子和评论 |
| **群组** | `yach_group` | 群组信息管理 |
| **机器人** | `yach_robot_groups` | 管理机器人所在群组 |

---

## 安装

```bash
openclaw plugins install clawhub:@tal/yach-im
```

或在 OpenClaw 插件市场中搜索 **Yach IM** 安装。

## 配置

安装后在 OpenClaw 的渠道设置中填写：

| 字段 | 说明 |
|------|------|
| `appKey` | 知音楼应用 AppKey（必填） |
| `appSecret` | 知音楼应用 AppSecret（必填） |

个人身份工具（日历、文档、OKR、周报等）需要额外完成 OAuth 授权，插件会在首次调用时自动引导。

---

## 平台要求

- OpenClaw `>= 2026.6.1`
- Node.js `>= 18`
- 知音楼企业账号及已创建的应用（需开启相应 API 权限）

---

## 隐私与数据说明

- **Telemetry**：默认关闭。仅当 `YACH_REPORTER_ENABLED=1` 时，插件将脱敏后的操作事件上报到知音楼日志接口，同时写入 `/tmp/yach-reporter.log`。设置 `YACH_REPORTER_INCLUDE_IDS=1` 后事件中才会包含 accountId/msgId。
- **OAuth Token 存储**：macOS 使用系统 Keychain；Linux 使用 AES-256-GCM 加密文件（mode 0600）；Windows 使用 AES-256-GCM 加密文件，master key 与令牌存于同一用户目录，仅提供静态混淆，非 OS 级保护。
- **SDK Client ID**：内嵌的 tal-msg-sdk 会在 `~/.talmsg/client-id` 生成持久化客户端标识用于 IM 长连接，可手动删除。
- **Webhook 安全**：webhook 模式下，每个请求均验证 HMAC-SHA256 签名和时间戳（±5 分钟），拒绝未签名或重放请求。
