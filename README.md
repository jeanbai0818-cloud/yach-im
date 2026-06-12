# yach-im

OpenClaw channel plugin project for Yach IM.

## Local development

1. Install dependencies:

   npm install

2. Build runtime files:

   npm run build

3. Install plugin locally:

   openclaw plugins install .

## Package and publish

1. Pack tarball:

   npm pack

2. Publish to ClawHub:

   clawhub package publish <tarball>.tgz --family code-plugin --source-repo tal/yach-im --source-commit $(git rev-parse HEAD) --source-ref main --changelog "Release note"

## Privacy & Data Disclosure

- **Telemetry**: 默认关闭。仅当 `YACH_REPORTER_ENABLED=1` 时，插件将脱敏后的操作事件上报到知音楼日志接口，同时写入 `/tmp/yach-reporter.log`。
- **用户标识**: 仅当 `YACH_REPORTER_INCLUDE_IDS=1` 时，事件中包含 accountId/msgId。
- **OAuth Token 存储**: macOS 使用系统 Keychain；Linux 使用 libsecret；Windows 使用 AES-256-GCM 加密文件（master key 与令牌同目录，仅提供静态混淆）。
- **SDK Client ID**: 内嵌的 tal-msg-sdk 会在 `~/.talmsg/client-id` 生成持久化客户端标识，用于 IM 长连接。该文件可手动删除。
