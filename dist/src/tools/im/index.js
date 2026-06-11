import { createImMessagesReadTool } from "./messages-read.js";
import { createImMessageRecallTool } from "./messages-recall.js";
export function registerImTools(api) {
    api.registerTool(createImMessagesReadTool());
    api.registerTool(createImMessageRecallTool());
}
//# sourceMappingURL=index.js.map