/**
 * 知音楼工具 Scope 注册表。
 *
 * 每个工具动作声明所需 OAuth scope，
 * YachToolClient.invoke(toolAction, fn) 自动查表并在调用前预检用户授权。
 *
 * ## 维护方式
 *
 * 新增工具时：
 *   1. 在 YachToolActionKey 中加入新键
 *   2. 在 YACH_TOOL_SCOPES 中声明所需 scope
 *   3. 运行 tsc --noEmit 验证一致性
 */
// ── 注：scope 键值表在 API 文档中以嵌套对象形式存储，导出为 [object Object]，
//      无法直接读取。以下 scope 值根据接口名称和已知示例（doc:create/doc:append）推断，
//      待与知音楼开放平台后端确认后补全。
// ── Scope 映射表 ──────────────────────────────────────────────────────────
/** 每个工具动作所需的 OAuth scope 列表 */
export const YACH_TOOL_SCOPES = {
    yach_calendar_create: ["schedule:create:v3", "schedule:update:v3"],
    yach_calendar_list: ["schedule:list:v3"],
    yach_calendar_detail: ["schedule:info:v3"],
    yach_calendar_update: ["schedule:update:v3"],
    yach_calendar_cancel: ["schedule:cancel:v3"],
    yach_doc_read: ["doc:text:get", "doc:content:get"],
    yach_doc_append: ["doc:content:append"],
    yach_doc_file_create: [
        "doc:file:create",
        // "doc:file:delete",
    ],
    yach_doc_import: ["doc:import:v2:async", "doc:import:v2:process"],
    yach_doc_export: ["doc:file:export", "doc:export:v2:process"],
    yach_doc_summarize: [
        "doc:file:export",
        "doc:export:v2:process",
        "doc:text:get",
        "doc:lore_node:export",
        "doc:lore_node:export_progress",
    ],
    yach_space_node_import: ["ai:lore:import", "ai:lore:v2:import_process"],
    yach_space_node_export: [
        "doc:lore_node:export",
        "doc:lore_node:export_progress",
    ],
    yach_doc_admin: [
        "doc:collaborator:add", // 添加协作者
        "doc:collab:v2:del", // 移除协作者
        "doc:admin:v2:add", // 添加管理员
        "doc:admin:v2:del", // 移除管理员
    ],
    yach_get_user_by_id: ["directory:userinfo:id"],
    yach_get_user_by_workcode: ["directory:userinfo:workcode"],
    yach_search_user: ["directory:user:search"],
    yach_im_get_messages: ["im:message:read"],
    yach_im_messages: ["im:message:send", "im:group:send"],
    yach_robot_groups: ["im:robot:group:list"],
    yach_group_create: ["im:group:create"],
    yach_group_add_members: ["im:group_user:add"],
    yach_group_list_members: ["im:group_member:list"],
    yach_group_remove_members: ["im:group_user:remove"],
    yach_im_message_recall: ["im:message:recall"],
    yach_weekly_list: ["weekly:list"],
    yach_weekly_draft_get: ["weekly:draft:info"],
    yach_weekly_draft_save: [
        "weekly:draft:info",
        "ork:query:detail",
        "weekly:draft:save",
    ],
    yach_okr_list: ["okr:list"],
    yach_team_list: ["user:team:list:info"],
    yach_topic_publish_post: ["squad:create"],
    yach_topic_publish_comment: ["squad:doc_comment:send"],
    yach_meeting_record_text: ["meeting:record:text"],
    yach_space_node_create: ["lore:node:create"],
    yach_space_node_move: ["lore:node:move"],
    yach_space_node_get_properties: ["lore:node:properties"],
    yach_space_node_set_properties: ["lore:node:properties:update"],
    yach_space_node_list: ["doc:lore_node:list"],
    yach_doc_sheet_update: ["doc:sheet:update"],
    yach_doc_sheet_append: ["doc:sheet:v2:append"],
};
/**
 * 查询工具动作所需的 scope 列表。
 * 已注册但 scope 为空数组的动作视为"不需要额外 scope"（已审计确认）。
 * 未注册的动作返回 null，调用方应拒绝执行未注册的动作。
 */
export function getRequiredScopes(toolAction) {
    if (!(toolAction in YACH_TOOL_SCOPES)) {
        return null;
    }
    return YACH_TOOL_SCOPES[toolAction];
}
//# sourceMappingURL=tool-scopes.js.map