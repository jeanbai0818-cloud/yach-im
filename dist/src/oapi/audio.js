import { promisify } from "node:util";
import { execFile } from "node:child_process";
const execFileAsync = promisify(execFile);
export async function getAudioDuration(filePath) {
    try {
        const { stdout } = await execFileAsync("ffprobe", [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            filePath,
        ]);
        const duration = parseFloat(stdout.trim());
        if (isNaN(duration)) {
            throw new Error("Could not parse duration");
        }
        return Math.round(duration * 100) / 100; // Round to 2 decimal places
    }
    catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to get audio duration: ${errMessage}`, { cause: err });
    }
}
//# sourceMappingURL=audio.js.map