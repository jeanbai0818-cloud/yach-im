import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { yachPlugin } from "./src/channel/plugin.js";
import { setYachRuntime } from "./src/core/runtime.js";
import { registerYachTools } from "./src/tools/index.js";
import { registerYachCommands } from "./src/commands/index.js";
export default {
    id: "yach",
    name: "Yach",
    description: "Yach channel plugin",
    configSchema: emptyPluginConfigSchema(),
    register(api) {
        setYachRuntime(api.runtime);
        api.registerChannel({ plugin: yachPlugin });
        registerYachTools(api);
        registerYachCommands(api);
    },
};
//# sourceMappingURL=index.js.map