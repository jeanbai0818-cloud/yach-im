---
name: yach-contacts
description: 知音楼用户搜索能力。按用户 ID / 工号查询，或按姓名模糊搜索。
---

## 工具：`yach_search_user`

| action | 必填 | 说明 |
| --- | --- | --- |
| `get_by_id` | `user_id` | 按 yachid 精确查询 |
| `get_by_workcode` | `work_code` | 按企业工号精确查询 |
| `search` | `keyword` | 按姓名模糊搜索 |

- `user_id` 格式：`yach100001`
- `work_code` 格式：`100001`
- 无法查询外部企业或已离职用户
