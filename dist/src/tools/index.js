import { registerCalendarTools } from "./calendar/index.js";
import { registerDocTools } from "./doc/index.js";
import { registerSpaceTools } from "./space/space-node.js";
import { registerContactsTools } from "./contacts/index.js";
import { registerImTools } from "./im/index.js";
import { registerRobotTools } from "./robot/index.js";
import { registerWeeklyTools } from "./weekly/index.js";
import { registerOkrTools } from "./okr/index.js";
import { registerTopicTools } from "./topic/index.js";
import { registerGroupTools } from "./group/index.js";
import { registerMeetingTools } from "./meeting/index.js";
export function registerYachTools(api) {
    registerCalendarTools(api);
    registerDocTools(api);
    registerSpaceTools(api);
    registerContactsTools(api);
    registerImTools(api);
    registerRobotTools(api);
    registerWeeklyTools(api);
    registerOkrTools(api);
    registerTopicTools(api);
    registerGroupTools(api);
    registerMeetingTools(api);
}
//# sourceMappingURL=index.js.map