# CLAUDE.md — yach-im 项目上下文

> 给 Claude Code 看的项目说明。每次开新 session 先读这个文件。

---

## 这个项目是什么

yach-im 是 OpenClaw 的聊天渠道插件，用于把 OpenClaw 接入 Yach（知音楼）IM。

主要能力：
- 注册 Yach 渠道（channel），支持消息收发、指令触发、动态 agent
- 18 个 MCP tool，覆盖 IM / 日历 / 通讯录 / 文档 / 会议 / OKR / 机器人 / 空间 / 专题 / 周报 / 团队
- 13 个 skill（SKILL.md），定义 agent 在各场景下的行为

---

## 双推地址

| 目标 | 地址 |
|------|------|
| GitHub | `https://github.com/jeanbai0818-cloud/yach-im` |
| ClawHub | `@tal/yach-im` |

**每次发版都要双推**，缺一不可。

发布顺序固定：先推 GitHub，再发布 ClawHub。

---

## 版本号规范

格式：`YYYY.M.D`，补丁版本用 `YYYY.M.D-1`、`-2`、`-3`……

**`package.json` 和 `openclaw.plugin.json` 的版本号必须始终保持一致。**

### 版本号生成规则（发版前必须执行）

```bash
# 查当前日期
date '+%Y.%-m.%-d'
```

1. **如果当前版本 < 今天日期**：直接用今天日期，例如今天 2026.6.18 → 版本改为 `2026.6.18`
2. **如果当前版本 = 今天日期**（已发过一版）：追加 `-1`，即 `2026.6.18-1`；再发则 `-2`……
3. **如果当前版本 > 今天日期**（版本号超前了）：改为今天日期追加后缀，从 `-1` 起，例如今天 6.18 但版本已到 6.20，则用 `2026.6.18-1`

> 核心原则：版本号中的日期不得早于也不得超过推送当天的实际日期。

---

## 发版完整流程

```bash
# 1. 确认两个版本号一致
grep '"version"' package.json openclaw.plugin.json

# 2. 语法检查（修改了哪些文件就检查哪些）
node --check dist/index.js
node --check dist/src/channel/plugin.js
node --check dist/src/tools/index.js

# 3. 提交推送 GitHub
git add <files>
git commit -m "描述 (版本号)"
git push

# 4. 打包
npm pack

# 5. 发布 ClawHub（用当前 commit SHA）
clawhub package publish <tarball>.tgz \
  --family code-plugin \
  --source-repo jeanbai0818-cloud/yach-im \
  --source-commit $(git rev-parse HEAD) \
  --source-ref main \
  --changelog "本次变更说明"
```

> **`--source-repo` 与 `@tal/yach-im` 不矛盾：**
> - `--source-repo jeanbai0818-cloud/yach-im` — GitHub 源码仓库路径（`git remote -v` 可验证）
> - `@tal/yach-im` — ClawHub 注册表包名，`@tal` 是 ClawHub publisher 组织，与 GitHub 账号无关
>
> 只有当源码迁移到 GitHub `tal` 组织后，`--source-repo` 才需要改为 `tal/yach-im`。

---

## 关键标识符（不要搞混）

| 字段 | 值 |
|------|----|
| manifest id（`openclaw.plugin.json` 的 `id`） | `yach-im` |
| npm package name（`package.json` 的 `name`） | `@tal/yach-im` |
| ClawHub Runtime ID | `yach-im` |
| ClawHub 安装命令 | `openclaw plugins install clawhub:@tal/yach-im` |
| GitHub repo | `jeanbai0818-cloud/yach-im` |
| ClawHub publisher | `tal` |

---

## 18 个 MCP Tool 一览

| Tool 名 | 所在文件 | 说明 |
|---------|---------|------|
| `yach_im_get_messages` | `tools/im/messages-read.js` | 读取 IM 消息历史 |
| `yach_im_user_messages` | `tools/im/messages-send.js` | 向用户发送 IM 消息 |
| `yach_im_message_recall` | `tools/im/messages-recall.js` | 撤回 IM 消息 |
| `yach_calendar` | `tools/calendar/index.js` | 日历事件查询与创建 |
| `yach_search_user` | `tools/contacts/index.js` | 通讯录用户搜索 |
| `yach_doc_admin` | `tools/doc/index.js` | 文档管理 |
| `yach_doc_append` | `tools/doc/index.js` | 追加文档内容 |
| `yach_doc_file` | `tools/doc/index.js` | 文件操作 |
| `yach_doc_sheet` | `tools/doc/index.js` | 表格操作 |
| `yach_doc_summarize` | `tools/doc/summarize.js` | 文档摘要 |
| `yach_group` | `tools/group/index.js` | 群组管理 |
| `yach_meeting_record_text` | `tools/meeting/index.js` | 会议纪要文字 |
| `yach_okr` | `tools/okr/index.js` | OKR 查询与更新 |
| `yach_robot_groups` | `tools/robot/groups.js` | 机器人群组管理 |
| `yach_space_node` | `tools/space/space-node.js` | 知识空间节点操作 |
| `yach_topic_publish_post` | `tools/topic/publish-post.js` | 发布专题帖子 |
| `yach_topic_publish_comment` | `tools/topic/publish-comment.js` | 发布专题评论 |
| `yach_weekly` | `tools/weekly/index.js` | 周报草稿与发布 |
| `yach_list_teams` | `tools/contacts/index.js` | 团队列表查询 |

---

## 目录结构

```text
dist/                          编译产物（直接发布，不发 src/）
  index.js                     插件入口：注册 channel + tools + commands
  src/
    accounts/                  多账号管理
    card/                      流式消息卡片渲染
    channel/
      plugin.js                渠道注册与生命周期
      webhook.js               Webhook 接收处理
      sdk.js                   Yach SDK 封装
      monitor.js               连接状态监控
      dynamic-agent.js         动态 agent 调度
    commands/                  CLI 命令注册
    core/
      aes.js                   AES 加解密
      app-token.js             App token 管理
      config.js                插件配置
      device-flow.js           设备授权流程
      fetch.js                 HTTP 请求封装
      reporter.js              错误上报
      runtime.js               运行时工具
      tool-client.js           Tool 调用客户端
      tool-scopes.js           Tool 权限声明
      types.js                 共享类型定义
      user-token-client.js     用户 token 客户端
      user-token-errors.js     用户 token 错误处理
      user-token-store.js      用户 token 存储
      yach-client.js           知音楼 API 客户端
      yach-logger.js           日志封装
      yach-ticket.js           Ticket 鉴权
    messaging/
      inbound/                 入站消息解析、分发、去重、中断检测
      outbound/                出站队列、回复调度
    oapi/                      知音楼 Open API 封装（IM、日历、通讯录、文档、会议、OKR…）
    tools/
      index.js                 tool 注册（factory 形式）
      helpers.js               tool 共用工具函数
      auto-auth.js             自动鉴权中间件
      calendar/                日历 tool
      contacts/                通讯录 tool（search_user + list_teams）
      doc/                     文档 tool（admin/append/file/sheet/summarize）
      group/                   群组 tool
      im/                      IM tool（get_messages/user_messages/message_recall）
      meeting/                 会议 tool
      okr/                     OKR tool
      robot/                   机器人 tool（groups）
      space/                   空间 tool（space_node）
      topic/                   专题 tool（publish_post/publish_comment）
      weekly/                  周报 tool（draft_logic/index）
    vendor/                    tal-msg-sdk 等内部依赖
skills/                        13 个 SKILL.md
  yach-im/                     IM 渠道 skill
  yach-calendar/               日历 skill
  yach-contacts/               通讯录 skill
  yach-doc-read/               文档读取 skill
  yach-doc-write/              文档写入 skill
  yach-group/                  群组 skill
  yach-meeting/                会议 skill
  yach-okr/                    OKR skill
  yach-robot/                  机器人 skill
  yach-space/                  空间 skill
  yach-team/                   团队 skill
  yach-topic/                  专题 skill
  yach-weekly/                 周报 skill
openclaw.plugin.json           插件清单（kind=channel）
package.json                   npm 包与 openclaw 元数据
README.md
CLAUDE.md                      本文件
```

---

## 常见操作速查

**更新后本地安装验证：**
```bash
openclaw plugins install .
openclaw gateway restart
```

**查看已发布版本：**
```bash
clawhub package inspect @tal/yach-im
```

**查看插件日志（确认没有 ParseError）：**
```bash
openclaw logs 2>&1 | grep yach-im
```

**修改 JS 文件后的语法检查：**
```bash
node --check dist/index.js
node --check dist/src/channel/plugin.js
node --check dist/src/tools/index.js
```
