import { yachLogger } from "./yach-logger.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const log = yachLogger("oapi/config");
const CONFIG_FILE = "yach-config.json";
const DEFAULT_VERSION_AREA = "YachAreaRed";
class ConfigManager {
    static instance;
    config = {};
    configFilePath;
    initialized = false;
    constructor() {
        // ES module compatible __dirname
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // Look for config in project root or parent directory
        const possiblePaths = [
            path.join(process.cwd(), CONFIG_FILE),
            path.join(process.cwd(), "..", CONFIG_FILE),
            path.join(__dirname, "..", "..", CONFIG_FILE),
        ];
        this.configFilePath = possiblePaths.find(p => fs.existsSync(p)) || path.join(process.cwd(), CONFIG_FILE);
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    loadConfigFromFile() {
        try {
            if (fs.existsSync(this.configFilePath)) {
                const fileContent = fs.readFileSync(this.configFilePath, "utf-8");
                this.config = JSON.parse(fileContent);
                log.debug(`Loaded config from ${this.configFilePath}`, {});
            }
            else {
                this.config = {};
                log.debug(`Config file not found at ${this.configFilePath}, using defaults`, {});
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.warn(`Failed to load config from ${this.configFilePath}: ${errorMsg}`, {});
            this.config = {};
        }
        this.initialized = true;
    }
    getVersionArea() {
        if (!this.initialized) {
            this.loadConfigFromFile();
        }
        return this.config.versionArea || DEFAULT_VERSION_AREA;
    }
    setVersionArea(value) {
        if (!this.initialized) {
            this.loadConfigFromFile();
        }
        // Update memory
        this.config.versionArea = value;
        // Update file
        try {
            // Ensure directory exists
            const dir = path.dirname(this.configFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), "utf-8");
            log.info(`Updated versionArea to "${value}" in ${this.configFilePath}`, {});
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.error(`Failed to save config to ${this.configFilePath}: ${errorMsg}`, {});
        }
    }
    reload() {
        this.initialized = false;
        this.loadConfigFromFile();
        log.info("Reloaded configuration from file", {});
    }
}
export const configManager = ConfigManager.getInstance();
//# sourceMappingURL=config.js.map