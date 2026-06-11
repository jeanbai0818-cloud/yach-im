# CLAUDE.md - yach-im 项目上下文

> 给 Claude Code 看的项目说明。每次开新 session 先读这个文件。

---

## 这个项目是什么

yach-im 是 OpenClaw 的聊天渠道插件，用于把 OpenClaw 接入 Yach IM。

当前仓库是标准 channel 插件结构，包含主入口和 setup 入口，支持本地安装、打包和发布到 ClawHub。

---

## 双推地址

| 目标 | 地址 |
|------|------|
| GitHub | https://github.com/jeanbai0818-cloud/yach-im |
| ClawHub | @tal/yach-im |

每次发版都要双推，缺一不可。

发布顺序固定：先推个人仓库 jeanbai0818-cloud/yach-im，再发布 ClawHub。

---

## 版本号规范

格式：YYYY.M.D，补丁版本用 YYYY.M.D-1、-2、-3。

package.json 和 openclaw.plugin.json 的版本号必须始终保持一致。

### 版本号生成规则（发版前必须执行）

```bash
# 查当前日期
date '+%Y.%-m.%-d'
```

1. 如果当前版本小于今天日期：直接用今天日期作为新版本。
2. 如果当前版本等于今天日期：追加 -1；再发则 -2。
3. 如果当前版本大于今天日期：改为今天日期并追加后缀，从 -1 起。

核心原则：版本号中的日期不得早于也不得超过推送当天的实际日期。

---

## 发版完整流程

```bash
# 1. 确认两个版本号一致
grep '"version"' package.json openclaw.plugin.json

# 2. 编译
npm run build

# 3. 提交推送 GitHub
git add <files>
git commit -m "chore: release <version>"
git push

# 4. 打包
npm pack

# 5. 发布 ClawHub（用当前 commit SHA）
clawhub package publish <tarball>.tgz \
  --family code-plugin \
  --source-repo jeanbai0818-cloud/yach-im \
  --source-commit $(git rev-parse HEAD) \
  --source-ref main \
  --changelog "Release note"
```

---

## 关键标识符（不要搞混）

| 字段 | 值 |
|------|----|
| manifest id（openclaw.plugin.json 的 id） | yach-im |
| npm package name（package.json 的 name） | @tal/yach-im |
| ClawHub Runtime ID | yach-im |
| ClawHub 安装命令 | openclaw plugins install clawhub:@tal/yach-im |
| GitHub repo | jeanbai0818-cloud/yach-im |
| ClawHub publisher | tal |

---

## 目录结构

```text
dist/                          编译产物（基于 @xes/yach v2.8.2）
  index.js                     插件入口：注册 channel + tools + commands
  src/
    accounts/                  多账号管理
    card/                      流式消息卡片
    channel/                   渠道核心（plugin、webhook、sdk、monitor）
    commands/                  CLI 命令注册
    core/                      鉴权、yach-client、runtime、logger
    messaging/
      inbound/                 入站消息解析、分发、去重、中断检测
      outbound/                出站队列、回复调度
    oapi/                      知音楼 Open API 封装（IM、日历、通讯录、文档、会议、OKR…）
    tools/                     18 个 MCP tool
    vendor/                    tal-msg-sdk 等内部依赖
skills/                        13 个 SKILL.md（yach-im、calendar、doc…）
openclaw.plugin.json           插件清单（kind=channel）
package.json                   npm 包与 openclaw 元数据
README.md
CLAUDE.md                      本文件
```

---

## 常见操作速查

本地安装验证：
```bash
openclaw plugins install .
openclaw gateway restart
```

查看已发布版本：
```bash
clawhub package inspect @tal/yach-im
```

查看插件日志：
```bash
openclaw logs 2>&1 | grep yach-im
```

语法检查：
```bash
node --check dist/index.js
node --check dist/src/channel/plugin.js
node --check dist/src/tools/index.js
```
