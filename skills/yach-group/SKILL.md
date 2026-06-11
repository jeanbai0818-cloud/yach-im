---
name: yach-group
description: 知音楼群组管理能力。用户要"创建群/加人进群/踢人出群/看群成员"且明确同意执行时使用。
---

## 工具：`yach_group`

> ⚠️ 风险提示：`remove_members` 使用 app token，权限较高，执行前必须二次确认用户意图并传 `confirm_risk: true`。

| action | 必填参数 | 说明 |
| --- | --- | --- |
| `create` | `group_name`, `owner_user_id` | 创建新群 |
| `add_members` | `group_id`, `member_user_ids`, `op_uid` | 添加群成员 |
| `list_members` | `group_id` | 获取群成员列表 |
| `remove_members` | `group_id`, `member_user_ids`, `op_uid`, `confirm_risk` | 删除群成员 |

## 参数详解

### 创建群 (`create`)

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `group_name` | ✅ | 群名称 |
| `owner_user_id` | ✅ | 群主用户 ID（格式：`yach100001`） |
| `member_user_ids` | — | 初始成员 ID 数组（不传则只有群主） |
| `source` | — | 群类型：`0`=普通群（默认），`3`=审批群，`4`=项目群，`102`=应用模版群 |
| `tpl_id` | — | 模版群 ID（创建模版群时必填） |
| `tpl_ext` | — | 群应用跳转需要的业务参数 |
| `unique_key` | — | 幂等性控制，相同 key 不会重复创建 |

### 添加群成员 (`add_members`)

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `group_id` | ✅ | 群 ID（`group_tid`） |
| `member_user_ids` | ✅ | 成员用户 ID 数组 |
| `op_uid` | ✅ | 操作人用户 ID（通常是邀请人 ID） |

### 获取群成员列表 (`list_members`)

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `group_id` | ✅ | 群 ID（`group_tid`） |
| `page` | — | 当前页数，默认 1 |
| `count` | — | 每页条数，最大 100，默认 100 |

### 删除群成员 (`remove_members`)

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `group_id` | ✅ | 群 ID（`group_tid`） |
| `member_user_ids` | ✅ | 要删除的成员用户 ID 数组 |
| `op_uid` | ✅ | 操作人用户 ID |
| `confirm_risk` | ✅ | 固定 `true`，表示用户已确认执行踢人操作 |

## 返回结构

### 创建群

```json
{
  "group_id": "2771361680",
  "name": "测试群",
  "pic": "头像链接"
}
```

### 群成员列表

```json
{
  "list": [
    {
      "uuid": "yach137620",
      "name": "张三",
      "pic": "头像链接",
      "group_users_type": 0
    }
  ],
  "total": "100"
}
```

| 字段 | 说明 |
| --- | --- |
| `uuid` | 用户 ID（`yach` 开头） |
| `name` | 用户姓名 |
| `pic` | 头像链接 |
| `group_users_type` | `0`=群主，`1`=管理员，`2`=普通用户 |

## 核心约束

- 群成员总数限制：**最多 1000 人**
- `group_id` 格式：数字字符串（如 `"2771361680"`）
- 用户 ID 格式：`yach` 开头（如 `"yach137620"`）
- `op_uid`（操作人 ID）在添加/删除成员时必填

## 使用场景

### 1. 创建新群

```
创建一个叫"项目讨论群"的群，群主是 yach100001，初始成员有 yach100002, yach100003
```

### 2. 添加群成员

```
把 yach100004, yach100005 加到群 2771361680 里，邀请人是 yach100001
```

### 3. 查看群成员

```
查看群 2771361680 的所有成员
```

### 4. 移除群成员

```
把 yach100004 从群 2771361680 里移除，操作人是 yach100001
```

## 常见错误

- 创建群失败 → 检查 `owner_user_id` 格式是否正确（`yach` 开头）
- 添加成员失败 → 检查 `group_id` 是否正确、`member_user_ids` 格式是否为数组
- 无法移除群主 → 群主不能被移除，只能转让
- 群成员已满 → 检查群人数是否超过 1000 人限制
