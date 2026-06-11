import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
const { setRuntime: setYachRuntime, getRuntime: getYachRuntime } = createPluginRuntimeStore("Yach runtime not initialized");
/** 兼容 openclaw 4.x (loadConfig) 和 5.x (current) */
function getYachConfig() {
    const runtime = getYachRuntime();
    const c = runtime.config;
    return (c.current ?? c.loadConfig).call(c);
}
export { getYachRuntime, setYachRuntime, getYachConfig };
//# sourceMappingURL=runtime.js.map