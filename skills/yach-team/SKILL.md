---
name: yach-list-teams
description: >
  知音楼用户伙伴分组查询能力。
  仅在用户明确要求"查伙伴/看伙伴列表/我的伙伴分组"时使用。
---

> **⚠️ 数据访问说明**
> - 本工具通过 OAuth 授权以当前用户身份获取其个人伙伴分组数据。
> - 调用前应确认用户确实需要此信息，不要在无关上下文中主动调用。

## 工具：`yach_list_teams`（需 OAuth 授权）

| 意图 | action | 必填 |
| --- | --- | --- |
| 查用户伙伴分组列表 | `list_teams` | 无 |

**list_teams 参数**：
- 无需额外参数，直接返回当前用户的伙伴分组列表

## 返回数据结构

- `list`：伙伴数据列表
  - `id`：伙伴ID（分组ID）
  - `name`：伙伴名称（分组名称）

## 使用场景

当用户询问以下问题时使用：
- "我的伙伴有哪些"
- "查看我的伙伴分组"
- "列出所有伙伴"
- "我的分组列表"

## 与周报查询的配合

返回的数据可以用于周报查询筛选：
- 返回的 `id` 可以在周报查询时作为 `query_type=team_id` 的 `query_value` 使用
- 返回的 `name` 可以在周报查询时作为 `query_type=team_name` 的 `query_value` 使用

例如：
```javascript
// 先获取伙伴列表
const teams = await yach_list_teams({ action: "list_teams" });

// 然后使用某个伙伴ID查询周报
const weekly = await yach_weekly({
  action: "list",
  query_type: "team_id",
  query_value: teams.list[0].id  // 使用伙伴ID
});
```

## 常见错误

- `need_auth=true` → 先完成 OAuth 授权
