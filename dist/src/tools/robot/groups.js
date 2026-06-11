/**
 * yach_robot — 机器人能力工具（app token）
 *
 * groups — 获取机器人所在群列表
 */
import { jsonResult } from "openclaw/plugin-sdk/agent-runtime";
import { createYachToolClient } from "../../core/tool-client.js";
import { handleInvokeErrorWithAutoAuth } from "../auto-auth.js";
// ── yach_robot:groups ─────────────────────────────────────────────────────
export function createRobotGroupsTool() {
    return {
        name: "yach_robot_groups",
        label: "获取机器人所在群列表",
        description: "获取当前机器人所在的所有群聊列表，返回每个群的群 ID（groupId）、群名称等基本信息。" +
            "当需要向某个群发送消息但不知道群 ID 时，可先调用此工具列出机器人所在群，再用群 ID 调用消息发送工具。",
        parameters: {
            type: "object",
        },
        execute: async (_toolCallId, _rawParams) => {
            const client = createYachToolClient();
            try {
                const result = await client.invoke("yach_robot_groups", (c) => c.robot.listRobotGroups(), { as: "app" });
                return jsonResult({ groups: result });
            }
            catch (err) {
                return handleInvokeErrorWithAutoAuth(err, undefined, { toolName: "yach_robot_groups" });
            }
        },
    };
}
//# sourceMappingURL=groups.js.map