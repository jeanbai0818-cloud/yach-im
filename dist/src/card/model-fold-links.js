/**
 * 知音楼 fold link 工具。
 *
 * 知音楼支持一种特殊 markdown 链接：点击后自动发送一条 fold 类型消息，
 * 内容为 reply 参数的 URL decode 值，可用于实现类似 Telegram inline button 的交互。
 *
 * 格式：[显示文本](yach://yach.zhiyinlou.com/session/robot?type=fold&extra=%7B%7D&reply=<encoded>)
 */
const FOLD_BASE = "yach://yach.zhiyinlou.com/session/robot?type=fold&extra=%7B%7D&reply=";
export function buildFoldUrl(cmd) {
    return `${FOLD_BASE}${encodeURIComponent(cmd)}`;
}
function foldLink(text, cmd) {
    return `[${text}](${buildFoldUrl(cmd)})`;
}
/**
 * 将 /models 命令返回的纯文本转换为可点击的 fold link markdown。
 */
export function transformModelTextToFoldLinks(text) {
    const lines = text.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    if (firstLine === "Providers:") {
        const out = lines.map((line) => {
            const m = line.match(/^(- )(\S+) \((\d+)\)$/);
            if (m) {
                const provider = m[2];
                return `${m[1]}${foldLink(`${provider} (${m[3]})`, `/models ${provider}`)}`;
            }
            return line;
        });
        return out.join("\n");
    }
    if (firstLine.startsWith("Models (")) {
        const out = lines.map((line) => {
            const modelM = line.match(/^(- )((\S+)\/(\S+))$/);
            if (modelM) {
                const ref = modelM[2];
                return `${modelM[1]}${foldLink(ref, `/model ${ref}`)}`;
            }
            const moreM = line.match(/^(More: )(\/models .+)$/);
            if (moreM)
                return foldLink(line, moreM[2]);
            const allM = line.match(/^(All: )(\/models .+)$/);
            if (allM)
                return foldLink(line, allM[2]);
            return line;
        });
        return out.join("\n");
    }
    return null;
}
/**
 * 从 fold 消息的 content（yach:// URL）中提取实际命令文本。
 */
export function decodeFoldContent(content) {
    const m = content.match(/[?&]reply=(.*)$/);
    if (m?.[1] !== undefined) {
        try {
            return decodeURIComponent(m[1]);
        }
        catch {
            return m[1];
        }
    }
    return content;
}
//# sourceMappingURL=model-fold-links.js.map