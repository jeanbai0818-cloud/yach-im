---
name: yach-okr
description: 知音楼OKR查询能力。用户要"查OKR/看OKR列表/查询团队OKR"时使用。
---

## 工具：`yach_okr`（需 OAuth 授权）

| 意图 | action | 必填 |
| --- | --- | --- |
| 查OKR列表 | `list` | 无 |

**list 可选参数**：
- `query_type`：筛选类型
  - `person`：按用户筛选
  - `department`：按部门筛选
- `query_value`：筛选值（与 `query_type` 对应）
  - `person`：工号
  - `department`：部门ID
- `start_month`：开始月份，格式 `YYYY-MM`（UTC+0），不传默认去年同月
  - **注意**：请严格使用 `YYYY-MM` 格式，如 `2026-03`，传入格式错误的月份会导致服务端返回通用错误
- `end_month`：结束月份，格式 `YYYY-MM`（UTC+0），不传默认当月
  - **注意**：请严格使用 `YYYY-MM` 格式，如 `2026-04`，传入格式错误的月份会导致服务端返回通用错误
- `sort`：排序方式，`asc`=升序，`desc`=降序
- `next_page`：分页标识，从上一次查询的返回值中获取，用于翻页

## 返回数据结构

- `list`：OKR数据列表
  - `id`：OKR记录ID
  - `user`：用户信息
    - `user_id`：用户ID
    - `work_code`：工号
    - `name`：姓名
  - `okr`：OKR内容
    - `title`：OKR周期标题
    - `content`：目标（O）与关键结果（KR）列表
      - `id`：目标ID
      - `object`：目标描述
      - `krs`：关键结果列表
        - `id`：KR ID
        - `title`：KR内容描述
- `next_page`：下一页分页标识

## 参数组合注意事项

1. **query_type 与 query_value 组合**
   - `query_type` 存在时，`query_value` **必须**填写
   - 不允许只传 `query_type` 不传 `query_value`
   - 示例：`query_type=person&query_value=167680` ✅
   - 示例：`query_type=person` ❌（缺少 query_value）

2. **月份参数格式**
   - `start_month` 和 `end_month` 必须严格使用 `YYYY-MM` 格式
   - 错误格式会被服务端拒绝，返回「服务器开小差」等不友好错误
   - 正确示例：`2026-03`、`2026-04` ✅
   - 错误示例：`2026/03`、`03-2026`、`invalid-month` ❌

3. **常见错误**
   - `need_auth=true` → 先完成 OAuth 授权
   - `query_value is required when query_type is set` → `query_type` 存在时必须传 `query_value`
   - `服务器竟然开小差` → 可能是月份格式错误，请检查 `YYYY-MM` 格式
   - 如果用户提到"我上季度的OKR"、"某人的OKR"等，需要先通过 `yach_search_user` 获取工号
