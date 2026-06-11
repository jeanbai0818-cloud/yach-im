import COS from "cos-nodejs-sdk-v5";
import { oapiFetch } from "../core/fetch.js";
import { yachLogger } from "../core/yach-logger.js";
const log = yachLogger("oapi/cos");
// ── YachCosApi ────────────────────────────────────────────────────────────────
export class YachCosApi {
    baseUrl;
    getToken;
    constructor(baseUrl, getToken) {
        this.baseUrl = baseUrl;
        this.getToken = getToken;
    }
    async getCredentials(type) {
        const token = await this.getToken();
        const res = await oapiFetch(`${this.baseUrl}/open/api/sts/get?access_token=${token}&type=${encodeURIComponent(type)}`);
        if (!res.ok)
            throw new Error(`[yach-cos] getCredentials failed: HTTP ${res.status}`);
        const data = (await res.json());
        if (data.code !== 200 || !data.obj)
            throw new Error(`[yach-cos] getCredentials error: ${JSON.stringify(data)}`);
        return data.obj;
    }
    async upload(params) {
        const creds = await this.getCredentials(params.cosType);
        const { credentials, bucket, region, key: keyPrefix, domain } = creds;
        const key = keyPrefix + params.filename;
        const encodedKey = keyPrefix + encodeURIComponent(params.filename);
        log.debug("upload", { bucket, key, contentType: params.contentType });
        const cos = new COS({
            SecretId: credentials.tmpSecretId,
            SecretKey: credentials.tmpSecretKey,
            SecurityToken: credentials.stsToken,
        });
        await cos.putObject({
            Bucket: bucket,
            Region: region,
            Key: key,
            Body: params.data,
            ContentType: params.contentType,
        });
        return `https://${domain}${encodedKey}`;
    }
}
//# sourceMappingURL=cos.js.map