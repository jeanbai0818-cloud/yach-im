import { getAccessToken } from "./app-token.js";
import { YachImApi } from "../oapi/im.js";
import { YachStreamApi } from "../oapi/stream.js";
import { YachCosApi } from "../oapi/cos.js";
import { YachExpressionApi } from "../oapi/expression.js";
import { YachGroupApi } from "../oapi/group.js";
import { YachContactsApi } from "../oapi/contacts.js";
import { YachCalendarApi } from "../oapi/calendar.js";
import { YachDocApi } from "../oapi/doc.js";
import { YachWeeklyApi } from "../oapi/weekly.js";
import { YachRobotApi } from "../oapi/robot.js";
import { YachOkrApi } from "../oapi/okr.js";
import { YachTeamApi } from "../oapi/team.js";
import { YachTopicApi } from "../oapi/topic.js";
import { YachMeetingApi } from "../oapi/meeting.js";
export class YachClient {
    baseUrl;
    appKey;
    appSecret;
    im;
    stream;
    cos;
    expression;
    group;
    contacts;
    calendar;
    doc;
    weekly;
    robot;
    okr;
    team;
    topic;
    meeting;
    fixedToken;
    constructor(params) {
        this.baseUrl = params.baseUrl;
        this.appKey = params.appKey;
        this.appSecret = params.appSecret;
        const getToken = () => this.resolveToken();
        const getAppToken = () => getAccessToken(params.baseUrl, { appKey: params.appKey, appSecret: params.appSecret });
        this.im = new YachImApi(params.baseUrl, getToken);
        this.stream = new YachStreamApi(params.baseUrl, getToken);
        this.cos = new YachCosApi(params.baseUrl, getAppToken);
        this.expression = new YachExpressionApi(params.baseUrl, getToken);
        this.group = new YachGroupApi(params.baseUrl, getToken);
        this.contacts = new YachContactsApi(params.baseUrl, getToken);
        this.calendar = new YachCalendarApi(params.baseUrl, getToken);
        this.doc = new YachDocApi(params.baseUrl, getToken);
        this.weekly = new YachWeeklyApi(params.baseUrl, getToken);
        this.robot = new YachRobotApi(params.baseUrl, getToken);
        this.okr = new YachOkrApi(params.baseUrl, getToken);
        this.team = new YachTeamApi(params.baseUrl, getToken);
        this.topic = new YachTopicApi(params.baseUrl, getToken);
        this.meeting = new YachMeetingApi(params.baseUrl, getToken);
    }
    static fromAccount(account) {
        if (!account.appKey || !account.appSecret) {
            throw new Error(`[yach] account ${account.accountId} missing appKey/appSecret`);
        }
        return new YachClient({
            baseUrl: account.baseUrl,
            appKey: account.appKey,
            appSecret: account.appSecret,
        });
    }
    /**
     * 派生一个绑定了指定 access_token 的 client（适用于 user token 场景）。
     * 派生 client 调用任何方法时直接使用 token，不再走 getAccessToken()。
     */
    withToken(token) {
        const c = new YachClient({ baseUrl: this.baseUrl, appKey: this.appKey, appSecret: this.appSecret });
        c.fixedToken = token;
        return c;
    }
    resolveToken() {
        if (this.fixedToken)
            return Promise.resolve(this.fixedToken);
        return getAccessToken(this.baseUrl, { appKey: this.appKey, appSecret: this.appSecret });
    }
}
//# sourceMappingURL=yach-client.js.map