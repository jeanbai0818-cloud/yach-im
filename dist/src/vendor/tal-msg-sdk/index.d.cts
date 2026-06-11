/**
 * Chat SDK - Multi-platform chat client for web, WeChat Mini Program, and Node.js
 *
 * This is a unified TypeScript declaration file containing all type definitions.
 *
 * @packageDocumentation
 */

// ===== Result Code Types =====
declare enum ResultCode {
    Success = 0,
    AlreadyInit = 19,
    UnInit = 11,
    UnLogined = 12,
    AlreadyLogined = 17,
    ParaError = 1,
    TimeOut = 2,
    Logging = 18,
    ContentToLarge = 15,
    ReceiverTooMany = 20,
    MessageLimit = 21
}
interface ResultMsg {
    code: ResultCode;
    preMsgId?: number;
}

// ===== Client Instance Types =====
interface SessionIdLH {
    H: number;
    L: number;
}
interface SessionInfo {
    sessionIdStr: string;
    sessionIdLH: SessionIdLH;
}
interface SdkConfigProxyConfig {
    protocol: string;
    hostname: string;
    port: number;
    url: string;
}
interface SdkConfigExtra {
    location?: string;
    logLevel?: string;
    logWriter?: Function;
}
interface SdkConfigRemoteLogConfig {
    protocol: string;
    hostname: string;
    port: number;
    url: string;
}
interface SdkConfig {
    proxyConfig?: SdkConfigProxyConfig;
    extra?: SdkConfigExtra;
    remoteLogConfig?: SdkConfigRemoteLogConfig;
}
interface InstanceSdkConfig extends SdkConfig {
    appId: string;
    bizId: string;
    clientId: string;
    version: string;
    appVersion: string;
}
declare class ClientInstance {
    unInit(): void;
}

// ===== IRC Protocol Types =====
declare class Message {
    version: number;
    format: number;
    encode: number;
    command: number;
    seqId: number;
    length: number;
    data: Buffer;
    timestamp?: number;
}
declare class MessageOption {
    saveHistory: boolean;
    historyLevel: number;
}
declare class HistoryMessageOption {
    historyLevel: number;
}
declare enum MessageVersionType {
    VersionIm1 = 1,
    VersionIm2 = 2,
    VersionChat = 3,
    VersionChatv2 = 4
}
declare enum MessageFormatType {
    ormatTars = 0,
    FormatThrift = 1,
    FormatProtobuf = 2,
    FormatJson = 3
}
declare enum MessageEncodeType {
    EncodeNone = 0,
    EncodeEncrypt = 1,
    EncodeCompress = 2
}
declare enum UserRole {
    RoleUnkown = 0,
    RoleTeacher = 1,
    RoleStudent = 2
}
declare function newMessageWithoutSeq(command: MessageCommandType, buff: Buffer): Message;
declare function newMessageWithSeq(command: MessageCommandType, seqId: number, buff: Buffer): Message;
declare enum MessageCommandType {
    LoginType,
    LoginRespType,
    PingType,
    PongType,
    RecoverPeer,
    RecoverPeerResp,
    RecoverPeerMessageNotice,
    JoinRoomType,
    JoinRoomRespType,
    JoinRoomNoticeType,
    JoinRoomInfoNoticeType,
    JoinUserListNoticeType,
    RoomDataNotice,
    RoomDataNoticeResp,
    RoomUserCountNotice,
    LeaveRoomType,
    LeaveRoomRespType,
    LeaveRoomNoticeType,
    SendRoomMessageType,
    SendRoomMessageRespType,
    RecvRoomMessageType,
    RecoverRoomMessageNotice,
    GetRoomHistoryMessageReqType,
    MuteRoomReqType,
    MuteRoomResp,
    RoomMuteStatusReqType,
    RoomMuteStatusResp,
    SetRoomDataResp,
    SetRoomData,
    SetBatchRoomData,
    SetBatchRoomDataResp,
    GetRoomData,
    GetRoomDataResp,
    RoomMsgSubscribe,
    RoomMsgSubscribeResp,
    MuteRoomNotice,
    GetRoomHistoryMessageRespType,
    SendRoomBinMessage,
    SendRoomBinMessageResp,
    RecvRoomBinMessage,
    RecvRoomBinMessageResp,
    GetRoomHistoryBinMessage,
    GetRoomHistoryBinMessageResp,
    GetRoomHistoryBinMessageNotice,
    GetRoomBatchHistoryBinMessage,
    GetRoomBatchHistoryBinMessageResp,
    GetRoomBatchHistoryBinMessageNotice,
    SendPeerBinMessage,
    SendPeerBinMessageResp,
    RecvPeerBinMessage,
    RecvPeerBinMessageResp,
    RecoverPeerBinMessage,
    RecoverPeerBinMessageResp,
    RecoverPeerBinMessageNotice,
    GetPeerMissingBinMessage,
    GetPeerMissingBinMessageResp,
    GetPeerMissingBinMessageNotice,
    RecvRoomMessageRespType,
    SendPeerMessageType,
    SendPeerMessageRespType,
    RecvPeerMessageType,
    RecvPeerMessageRespType,
    KickoutType,
    LogoutType,
    LogoutNiticeType,
    UnkownCommand,
    GetRoomUserList,
    GetRoomUserListResp,
    GetStatistics,
    GetStatisticsResp,
    GetStatisticsNotice,
    GetRoomMissingMessage,
    GetRoomMissingMessageResp,
    GetRoomMissingMessageNotice,
    GetPeerMissingMessage,
    GetPeerMissingMessageResp,
    GetPeerMissingMessageNotice
}
declare enum DeviceType {
    DeviceTypeIPhone = 0,
    DeviceTypeIPad = 1,
    DeviceTypeAndroid = 2,
    DeviceTypeWin = 3,
    DeviceTypeMac = 4,
    DeviceTypeLinux = 5,
    DeviceTypeWeb = 6,
    DeviceTypeWX = 7,
    DeviceTypeZFB = 8,
    DeviceTypeOther = 20
}
interface LoginReqParamInterface {
    appId: string;
    liveId: string;
    psId: string;
    password: string;
    nickname: string;
    deviceType: DeviceType;
    token: string;
    reconnect: boolean;
    msgPullNum: number;
    businessId: string;
    subBusinessId: string;
    roomUserMode: number;
    role: UserRole;
    kickout: boolean;
}
declare const CustomCode: {
    RoomTopic: number;
    RoomData: number;
    RoomUserList: number;
    RoomUserListEnd: number;
    RequestTimeout: number;
};
declare type Code = number;
declare function createLoginReq(params: LoginReqParamInterface): Buffer;
declare function createJoinRoomReq(roomIds: Array<string>): Buffer;
declare function createReJoinRoomReq(roomIds: Array<string>, unitSeqIds: Array<number>, joinMode: number, msgSubscribe: object): Buffer;
declare function createReJoinPeerReq(peerIds: Array<PsEntityInterface>, unitSeqIds: Array<number>): Buffer;
declare function createReJoinPeerBinReq(peerIds: Array<PsEntityInterface>, unitSeqIds: Array<number>): Buffer;
declare function createLeaveRoomReq(roomIds: Array<string>): Buffer;
declare function createRoomDataNoticeResp(msgId: string): Buffer;
declare function createSendRoomMsgReq(roomIds: Array<string>, content: string, priority: number, sendTime: null, option: MessageOption, currentSeq: number): Buffer;
declare function createRecvRoomMsgResp(msgId: string, unitSeqId: string, unitPrevSeqId: string): Buffer;
declare function createRecvPeerMsgResp(msgId: string, unitSeqId: string, unitPrevSeqId: string): Buffer;
declare function createSendPeerMsgReq(userIds: Array<PsEntityInterface>, content: string, priority: MessagePriorityType, sendTime: number, option: MessageOption, currentSeq: number): Buffer;
declare function createGetRoomHistoryMessageReq(roomId: string, tsOffset: number): Buffer;
declare function createSendRoomBinMessageReq(roomIds: Array<string>, dbKey: string, keyMsgId: string, content: string, sendTime: string, option: MessageOption, currentSeq: number): Buffer;
declare function createSendPeerBinMessageReq(userIds: Array<PsEntityInterface>, content: string, binMsgId: string, sendTime: string, option: MessageOption, currentSeq: number): Buffer;
declare function createRecvRoomBinMessageResp(msgId: string, unitSeqId: string, unitPrevSeqId: string): Buffer;
declare function createRecvPeerBinMessageResp(msgId: string, unitSeqId: string, unitPrevSeqId: string): Buffer;
declare function createGetRoomHistoryBinMessageReq(roomId: string, dbKey: string, lastKeyMsgId: string, order: boolean, count: number): Buffer;
declare function createGetRoomBatchHistoryBinMessage(getInfo: Array<RommHistoryBinMessage>): Buffer;
interface RommHistoryBinMessage {
    roomId: string;
    dbKey: string;
    lastKeyMsgId: string;
    order: boolean;
    count: number;
    option: HistoryMessageOption;
}
declare function createGetRoomUserList(roomIds: Array<string>, mode: number): Buffer;
declare function createGetStatisticsReq(key: string, params: object): Buffer;
declare function createRoomPullMsgReq(roomId: string, seqIdBegin: number, seqIdEnd: number): Buffer;
declare function createPeerPullMsgReq(userId: string, seqIdBegin: number, seqIdEnd: number): Buffer;
declare function createPeerBinPullMsgReq(userId: string, seqIdBegin: number, seqIdEnd: number): Buffer;
declare function createMuteRoomReq(roomIds: Array<string>, flag: number): Buffer;
declare function createGetRoomMuteStatusReq(roomIds: Array<string>): Buffer;
declare function createSetRoomDataReq(roomId: string, datas: Map<string, string>, sendTime: number): Buffer;
declare function createSetRoomsDataReq(roomId: Array<string>, datas: Map<string, string>, sendTime: number): Buffer;
declare function createGetRoomDataReq(roomId: string, keys: Array<string>): Buffer;
declare function createGetAllRoomDataReq(roomId: string): Buffer;
interface SetRoomSubscribeOptionReqParamInterface {
    msgType: number;
    flag: boolean;
}
declare function createSetRoomSubscribeOptionReq(roomIds: Array<string>, subOptions: Array<SetRoomSubscribeOptionReqParamInterface>): Buffer;

// ===== IRC Result Code Types =====
interface IrcResultMsgInterface {
    code: IrcResultCode;
    preMsgId?: number;
}
declare enum IrcResultCode {
    Success = 0,
    AlreadyInit = 19,
    UnInit = 11,
    UnLogined = 12,
    AlreadyLogined = 17,
    ParaError = 1,
    TimeOut = 2,
    Logging = 18,
    ContentToLarge = 15,
    ReceiverTooMany = 20,
    MessageLimit = 21
}
declare const ChatClientEventType: {
    onSDKProvisionStatusNotice: string;
    onLoginResponse: string;
    onLogoutResponse: string;
    onLogoutNotice: string;
    onNetStatusChanged: string;
    onKickoutNotice: string;
    onNetworkQulityTestResponse: string;
};
declare const RoomChatEventType: {
    onJoinRoomResponse: string;
    onJoinRoomNotice: string;
    onRecvRoomData: string;
    onRecvRoomMetaData: string;
    onRecvRoomDataUpdateNotice: string;
    onRecvRoomUserList: string;
    onRoomUserCountNotice: string;
    onRecvRoomTopic: string;
    onLeaveRoomResponse: string;
    onLeaveRoomNotice: string;
    onRecvRoomMessage: string;
    onSendRoomMessageResponse: string;
    onMuteRoomResponse: string;
    onGetRoomMuteStatusResponse: string;
    onSetRoomDataResponse: string;
    onSetRoomsDataResponse: string;
    onGetRoomDataResponse: string;
    onSetRoomSubscribeOption: string;
    onGetRoomHistoryMessageResponse: string;
    onSendRoomBinMessageResp: string;
    onRecvRoomBinMessageNotice: string;
    onGetRoomHistoryBinMessageResp: string;
    onGetRoomHistoryBinMessageNotice: string;
    onGetRoomBatchHistoryBinMessageResp: string;
    onGetRoomBatchHistoryBinMessageNotice: string;
    onGetStatisticsResp: string;
    onMuteRoomNotice: string;
};
declare const PeerChatEventType: {
    onRecvPeerMessage: string;
    onSendPeerMessageResponse: string;
    onSendPeerBinMessageResp: string;
    onRecvPeerBinMessageNotice: string;
};

// ===== IRC Message Types =====
interface SDKProvisionStatusNoticeInterface {
    status: SDKProvisionStatus;
    info: string;
}
declare enum SDKProvisionStatus {
    SDKProvisionStatus_Success = 0,
    SDKProvisionStatus_DispatchError = 1,
    SDKProvisionStatus_ConfigError = 2,
    SDKProvisionStatus_UnknownError = 100
}
interface LoginResponseInterface {
    code: Code;
    info: string;
    userInfo: PsEntityInterface;
}
interface LogoutResponseInterface {
}
interface LogoutNoticeInterface {
    code: Code;
    userInfo: PsEntityInterface;
}
interface NetStatusResponseInterface {
    netStatus: NetStatus;
}
declare enum NetStatus {
    Unkown = 0,
    Unavailable = 1,
    ServerFailed = 2,
    Connecting = 3,
    Connected = 4,
    DisConnected = 5
}
interface KickoutNoticeInterface {
    code: Code;
    info: string;
}
interface JoinRoomResponseInterface {
    code: Code;
    info: string;
    roomId: string;
    userInfo: PsEntityInterface;
}
interface JoinRoomNoticeInterface {
    info: string;
    roomId: string;
    userInfo: PsEntityInterface;
}
interface RoomDataInterface {
    value: string;
    save: boolean;
    persistent: boolean;
}
interface JoinRoomRoomDataInterface {
    roomId: string;
    msgId: string;
    handler: PsEntityInterface;
    datas: Map<string, RoomDataInterface>;
}
interface JoinRoomMetaDataInterface {
    roomId: string;
    content: {
        topic: string;
        number: number;
    };
}
interface JoinRoomUserListInterface {
    code: Code;
    userList: Array<PsEntityInterface>;
    roomId: string;
}
interface JoinRoomTopicInterface {
    topic: string;
    roomId: string;
}
interface LeaveRoomRespInterface {
    code: Code;
    info: string;
    userInfo: PsEntityInterface;
    roomId: string;
}
interface LeaveRoomNoticeInterface {
    info: string;
    userInfo: PsEntityInterface;
    roomId: string;
}
interface RecvRoomMessageInterface {
    messagePriority: MessagePriorityType;
    timestamp: number;
    msgId: number;
    fromUserInfo: PsEntityInterface;
    toRoomId: string;
    content: string;
    prevSeq: number;
    curSeq: number;
}
interface RoomUserCountNoticeInterface {
    userCount: Map<string, number>;
    teacherCount: Map<string, number>;
    studentCount: Map<string, number>;
}
interface SendRoomMessageRespInterface {
    code: Code;
    info: string;
    fromUserInfo: PsEntityInterface;
    toRoomId: string;
    preMsgId: number;
    msgId: number;
    timestamp: number;
    prevSeq: number;
    curSeq: number;
}
interface GetRoomHistoryMessageRespInterface {
    code: Code;
    info: string;
    content: Array<string>;
}
interface RecvPeerMessageNoticeInterface {
    msgId: string;
    timestamp: number;
    msgPriority: MessagePriorityType;
    fromUserInfo: PsEntityInterface;
    toUserInfo: PsEntityInterface;
    content: string;
}
interface SendPeerMessageRespInterface {
    code: Code;
    info: string;
    fromUserInfo: PsEntityInterface;
    toUserInfo: PsEntityInterface;
    msgId: number;
    preMsgId: number;
    timestamp: number;
}
interface PsEntityInterface {
    nickname: string;
    psId: string;
}
declare enum MessagePriorityType {
    MessagePriorityTopic = 0,
    MessagePriorityNotice = 1,
    MessagePriorityInteract = 98,
    MessagePriorityPrivMsg = 99
}
interface SendRoomBinMessageRespInterface {
    code: number;
    msg: string;
    roomId: string;
    msgId?: string;
    timestamp?: number;
    dbKey: string;
    keyMsgId: string;
}
interface SendPeerBinMessageRespInterface {
    code: number;
    msg: string;
    fromUserInfo: PsEntityInterface;
    toUserInfo: PsEntityInterface;
    msgId?: string;
    preMsgId: number;
    timestamp?: number;
    binMsgId: string;
}
interface RecvRoomBinMessageNoticeInterface {
    msgId: string;
    timestamp: number;
    roomId: string;
    from: string;
    dbKey: string;
    keyMsgId: string;
    content: Uint8Array;
}
interface RecvPeerBinMessageNoticeInterface {
    msgId: string;
    timestamp: number;
    fromUserInfo: PsEntityInterface;
    toUserInfo: PsEntityInterface;
    binMsgId: string;
    content: Uint8Array;
}
interface GetRoomHistoryBinMessageRespInterface {
    code: number;
    msg: string;
    roomId: string;
}
interface GetStatisticsRespInterface {
    code: number;
    msg: string;
    key?: string;
    params?: object;
    info?: object;
}
interface GetRoomUserListRespInterface {
    code: number;
    msg: string;
    userList: Array<{
        roomId: string;
    }>;
}
interface MuteRoomResponseInterface {
    code: Code;
    info: string;
    roomId: string;
}
interface RoomMsgSubscribeInterface {
    code: Code;
    info: string;
    roomId: string;
}
interface MuteRoomStatusResponseInterface {
    code: Code;
    info: string;
    roomId: string;
    flag: boolean;
}
interface SetRoomDataResponseInterface {
    code: Code;
    info: string;
    roomId: string;
    preMsgId: number;
    failKeys: Array<string>;
    msgId: string;
}
interface SetRoomsDataResultResponseInterface {
    code: Code;
    info: string;
    roomId: string;
    preMsgId: number;
    msgId: string;
    failKeys: Array<string>;
}
interface SetRoomsDataResponseInterface {
    preMsgId: number;
    msgId: string;
    result: Array<SetRoomsDataResultResponseInterface>;
}
interface GetRoomDataResponseInterface {
    code: Code;
    info: string;
    roomId: string;
    preMsgId: number;
    datas: object;
}

// ===== IRC Core Types =====
declare class IrcCore {
    private log;
    private userData;
    private config;
    private remoteConfig;
    private serverInfo;
    private liveInfo;
    private properties;
    private serverData;
    private aesEcb;
    private status;
    private reason;
    private conn;
    private msgHandle;
    private remoteConfigCount;
    private dispatchList;
    private dispatchIndex;
    private serverIndex;
    private peerBinIds;
    private peerIds;
    private roomIds;
    private roomUserCount;
    private modeRoomIdMap;
    private resultEvent;
    private remoteLog;
    private loginBegin;
    private connectBegin;
    private dispatchBegin;
    private remoteConfigBegin;
    private messageLimit;
    private messageSync;
    private peerBinMsgSync;
    private sendSync;
    private binaryMessageHistory;
    private remoteConfigTimeout;
    private dispatcherTimeout;
    private connectTimeout;
    private heartbeatManager;
    private registeredEvents;
    private subOptions;
    private ntpTime;
    private failTimes;
    private messageFilter;
    private sdkConfig;
    private hasInitResource;
    private roomMsgCache;
    private roomBinMsgCache;
    constructor(sdkConfig: InstanceSdkConfig);
    private initResource;
    private clearResource;
    IsLogined(): boolean;
    /**
     *
     * @param appId
     * @param appKey
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.AlreadyInit
     *  IrcResultCode.ParaError
     */
    init(appId: string, appKey: string): IrcResultCode;
    /**
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnInit
     */
    uninit(): IrcResultCode;
    /**
     *
     * @param liveInfo
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnInit
     *  IrcResultCode.AlreadyLogined
     *  IrcResultCode.ParaError :TODO
     */
    setLiveInfo(liveInfo: LiveInfoInterface): IrcResultCode;
    /**
     *
     */
    setSdkProperties(properties: ChatSdkPropertyInterface): IrcResultCode;
    startNetworkQulityTest(urls: Array<string>, times: number): IrcResultCode;
    /**
     *
     * @param psId
     * @param password
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnInit
     *  IrcResultCode.AlreadyInit
     *  IrcResultCode.ParaError
     */
    loginWithMode(psId: string, password: string, roomUserMode: number, kickout?: boolean): IrcResultCode;
    private handleLoginSuccess;
    private handleLoginFail;
    private handleLoginResp;
    /**
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnLogined
     */
    logout(): IrcResultCode;
    private handleKickout;
    private handleLogoutNotice;
    private handlePing;
    private handlePong;
    private handleUnkownCommand;
    private recoverPeerBin;
    private recoverPeer;
    private handleRecoverPeerResp;
    private handleRecoverPeerBinResp;
    private handleRecoverPeerNotice;
    private joinChatRooms1;
    private handleRecoverRoomMessageNotice;
    private handleRecoverPeerBinMessageNotice;
    private handleMuteRoomNotice;
    /**
     * 加入 聊天室
     * @param roomIds
     * @return
     *  IrcResultCode.Success
     *  IrcCoreStatus.UnInit
     *  IrcResultCode.UnLogined
     *  IrcResultCode.ParaError
     *  IrcResultCode.ReceiverTooMany
     */
    joinChatRoomsWithJoinMode(roomIds: Array<string>, joinMode: number): IrcResultCode;
    private handleJoinRoomResp;
    private handleJoinRoomNotice;
    private handleJoinRoomMetaDataNotice;
    private handleJoinRoomUserListNotice;
    private handleRoomUserCountNotice;
    private handleRecvRoomData;
    /**
     * 离开 聊天室
     * @param roomIds
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.ParaError
     *  IrcResultCode.ReceiverTooMany
     *  IrcResultCode.UnLogined
     *  IrcResultCode.UnInit
     */
    leaveChatRooms(roomIds: Array<string>): IrcResultCode;
    private handleLeaveRoomResp;
    private handleLeaveRoomNotice;
    /**
     * 聊天室禁言、解禁
     * @param roomIds
     * @param flag
     */
    muteRoom(roomIds: Array<string>, flag: number): IrcResultMsgInterface;
    /**
     * 聊天室禁言状态
     * @param roomIds
     * @param flag
     */
    getRoomMuteStatus(roomIds: Array<string>): IrcResultMsgInterface;
    /**
     * 设置聊天室参数
     * @param roomId
     * @param datas
     */
    setRoomData(roomId: string, datas: Map<string, string>): IrcResultMsgInterface;
    /**
   * 批量设置聊天室参数
   * @param roomId
   * @param datas
   */
    setRoomsData(roomIds: Array<string>, datas: Map<string, string>): IrcResultMsgInterface;
    /**
     * 获取聊天室的特定参数
     * @param roomId
     * @param keys
     */
    getRoomData(roomId: string, keys: Array<string>): IrcResultMsgInterface;
    /**
   * 获取聊天室的所有参数
   * @param roomId
   */
    getAllRoomData(roomId: string): IrcResultMsgInterface;
    /**
     * 设置消息订阅选项
     * @param roomIds
     * @param subOptions
     */
    setRoomSubscribeOption(roomIds: Array<string>, subOptions: Array<SetRoomSubscribeOptionReqParamInterface>): IrcResultMsgInterface;
    private handleMuteRoomResp;
    private handleMuteRoomStatusResp;
    private handleSetRoomDataResp;
    private handleSetRoomsDataResp;
    private handleGetRoomData;
    private handleSetRoomMsgSubscribeOptionResp;
    /**
   * 发送 聊天室消息
   * @param roomIds
   * @param content
   * @param msgPriority
   * @param option
   */
    sendRoomMessage(roomIds: Array<string>, content: string, msgPriority: number, option: MessageOption): IrcResultCode;
    /**
     *
     * @param roomIds
     * @param content
     * @param msgPriority
     * @param option
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnInit
     *  IrcResultCode.UnLogined
     *  IrcResultCode.ParaError
     *  IrcResultCode.ReceiverTooMany
     *  IrcResultCode.ContentToLarge
     */
    sendRoomMessageWithPreMsgId(roomIds: Array<string>, content: string, msgPriority: number, option: MessageOption): IrcResultMsgInterface;
    private handleSendRoomMessageResp;
    private sendRoomMessageRespTimeout;
    private sendRoomMessageRespCallback;
    private handleRecvRoomMessage;
    private doHandleRecvRoomMessage;
    private getRoomHistoryMessageFromHttp;
    private processRoomHistoryMessageResult;
    private onGetRoomHistoryMessageFromCacheResult;
    getRoomHistoryMessage(roomId: string, tsOffset: number, option: HistoryMessageOption): IrcResultCode;
    private handleGetRoomHistoryMessageResp;
    sendRoomBinMessage(roomIds: Array<string>, dbKey: string, keyMsgId: string, content: Uint8Array, option: MessageOption): IrcResultCode;
    sendPeerBinMessage(userIds: Array<PsEntityInterface>, binMsgId: string, content: Uint8Array, option: MessageOption): IrcResultCode;
    sendPeerBinMessageWithPreMsgIdWithOption(userIds: Array<PsEntityInterface>, binMsgId: string, content: Uint8Array, option: MessageOption): IrcResultMsgInterface;
    private handleSendRoomBinMessageResp;
    private handleSendPeerBinMessageResp;
    private handleSendRoomBinMessageRespTimeout;
    private handleSendPeerBinMessageRespTimeout;
    private handleSendPeerBinMessageRespCallback;
    private handleSendRoomBinMessageRespCallback;
    private handleRecvRoomBinMessageNotice;
    private handleRecvPeerBinMessage;
    private doHandleRecvPeerBinMessageNotice;
    private doHandleRecvRoomBinMessageNotice;
    private getRoomHistoryBinMsgFromHttp;
    private mergeRoomBinMsgResult;
    private processRoomHistoryBinMsgResult;
    private onGetRoomHistoryBinMsgFromCache;
    getRoomHistoryBinMessage(roomId: string, dbKey: string, lastKeyMsgId: string, order: boolean, count: number, option: HistoryMessageOption): IrcResultCode;
    private handleGetRoomHistoryBinMessageResp;
    private handleGetRoomHistoryBinMessageNotice;
    private convertRequest;
    private onGetBatchHistoryBinMsgFromHttpResult;
    private startGetBatchHistoryBinMsgFromHttp;
    private getBatchHistoryBinMsgFromHttp;
    private onGetBatchHistoryBinMsgFromCacheCallback;
    GetRoomBatchHistoryBinMessage(getInfo: Array<RommHistoryBinMessage>): IrcResultCode;
    private handleGetRoomBatchHistoryBinMessageResp;
    private handleGetRoomBatchHistoryBinMessageNotice;
    getRoomUserList(roomIds: Array<string>, mode: number): IrcResultCode;
    getStatistics(key: string, params: object): IrcResultCode;
    private handleGetStatisticsResp;
    private handleGetStatisticsNotice;
    /**
     * 发送 单聊消息
     * @param userIds
     * @param content
     * @param msgPriority
     */
    sendPeerMessage(userIds: Array<PsEntityInterface>, content: string, msgPriority: number, option: MessageOption): IrcResultCode;
    /**
     *
     * @param userIds
     * @param content
     * @param msgPriority
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnInit
     *  IrcResultCode.UnLogined
     *  IrcResultCode.ParaError
     *  IrcResultCode.ReceiverTooMany
     *  IrcResultCode.ContentToLarge
     */
    sendPeerMessageWithPreMsgId(userIds: Array<PsEntityInterface>, content: string, msgPriority: number, option: MessageOption): IrcResultMsgInterface;
    private handleSendPeerMessageResp;
    private sendPeerMessageRespTimeout;
    private sendPeerMessageRespCallback;
    private handleRecvPeerMessage;
    private doHandleRecvPeerMessage;
    /**
     *
     * @param eventType
     * @param callback
     * @return
     *  IrcResultCode.Success
     *  IrcResultCode.UnInit
     *  IrcResultCode.ParaError
     */
    on(eventType: string, callback: any): IrcResultCode;
    once(eventType: string, callback: any): IrcResultCode;
    off(eventType: string, callback: any): IrcResultCode;
    /**
     *
     * @param remoteconfig成功回调
     */
    private remoteconfigSuccessCallback;
    /**
     *
     * @param remoteconfig失败回调
     */
    private remoteconfigFailCallback;
    /**
     *
     * @param 备用remoteconfig成功回调
     */
    private backupRemoteconfigSuccessCallback;
    /**
     *
     * @param 备用remoteconfig失败回调
     */
    private backupRemoteconfigFailCallback;
    /**
      * 开始获取配置
      */
    private tryRemoteConfig;
    /**
     * 开始调度
     */
    private tryDispatch;
    private handleRecvMessage;
    private handleMessageTimeout;
    private handlePeerBinMessageTimeout;
    /**
     * 开始 连接接入服务器
     */
    private tryConnect;
    private messageDispatch;
    private handlePullMessageResp;
    private handlePullPeerBinMessageResp;
    private handlePullMessageNotice;
    private handlePullPeerBinMessageNotice;
    private timeoutMessageDispatch;
    /**
     * 处理 websocket onopen 事件
     */
    private handleConnOpen;
    private sendHeartbeat;
    /**
     * 处理心跳超时
     */
    private handlePingTimeout;
    /**
     * 处理 websocket onerror 事件
     */
    private handleConnError;
    private handleConnClose;
    private handleConnMessage;
    private sendMessage;
    private addUserToRoomMap;
    private remoteUserFromRoom;
    private retryInterval;
}

interface LiveInfoInterface {
    nickname: string;
    liveId: string;
    businessId: string;
    classId: string;
    location: string;
    subBusinessId: string;
    role?: UserRole;
}
interface ChatSdkPropertyEntityInterface {
    hostname: string;
    url: string;
    protocol: string;
    port?: number;
}
interface ChatSdkPropertyInterface {
    confService: ChatSdkPropertyEntityInterface;
    logService: ChatSdkPropertyEntityInterface;
}

// ===== Peer Chat Manager =====
declare class PeerChatManager {
    private ircCore;
    constructor(ircCore: IrcCore);
    sendPeerBinMessage(userIds: Array<PsEntityInterface>, binMsgId: string, content: Uint8Array): IrcResultCode;
    sendPeerBinMessageWithPreMsgId(userIds: Array<PsEntityInterface>, binMsgId: string, content: Uint8Array): IrcResultMsgInterface;
    sendPeerBinMessageWithMsgOption(userIds: Array<PsEntityInterface>, binMsgId: string, content: Uint8Array, option: MessageOption): IrcResultCode;
    sendPeerBinMessageWithPreMsgIdWithMsgOption(userIds: Array<PsEntityInterface>, binMsgId: string, content: Uint8Array, option: MessageOption): IrcResultMsgInterface;
    sendPeerMessageWithMsgOption(userIds: Array<PsEntityInterface>, content: string, msgPriority: number, option: MessageOption): IrcResultCode;
    sendPeerMessage(userIds: Array<PsEntityInterface>, content: string, msgPriority: number): IrcResultCode;
    sendPeerMessageWithPreMsgId(userIds: Array<PsEntityInterface>, content: string, msgPriority: number): IrcResultMsgInterface;
    sendPeerMessageWithPreMsgIdWithMsgOption(userIds: Array<PsEntityInterface>, content: string, msgPriority: number, option: MessageOption): IrcResultMsgInterface;
    on(eventType: string, callback: any): IrcResultCode;
    off(eventType: string, callback: any): IrcResultCode;
}

// ===== Room Chat Manager =====
declare class RoomChatManager {
    private ircCore;
    constructor(ircCore: IrcCore);
    joinChatRooms(roomIds: Array<string>): IrcResultCode;
    joinChatRoomsWithJoinMode(roomIds: Array<string>, joinMode: number): IrcResultCode;
    leaveChatRooms(roomIds: Array<string>): IrcResultCode;
    sendRoomMessage(roomIds: Array<string>, content: string, msgPriority: number): IrcResultCode;
    sendRoomMessageWithMsgOption(roomIds: Array<string>, content: string, msgPriority: number, option: MessageOption): IrcResultCode;
    muteRoom(roomIds: Array<string>, flag: number): IrcResultMsgInterface;
    getRoomMuteStatus(roomIds: Array<string>): IrcResultMsgInterface;
    setRoomData(roomId: string, datas: Map<string, string>): IrcResultMsgInterface;
    setRoomsData(roomIds: Array<string>, datas: Map<string, string>): IrcResultMsgInterface;
    getRoomData(roomId: string, keys: Array<string>): IrcResultMsgInterface;
    getAllRoomData(roomId: string): IrcResultMsgInterface;
    setRoomSubscribeOption(roomIds: Array<string>, subOptions: Array<SetRoomSubscribeOptionReqParamInterface>): IrcResultMsgInterface;
    sendRoomMessageWithPreMsgIdWithMsgOption(roomIds: Array<string>, content: string, msgPriority: number, option: MessageOption): IrcResultMsgInterface;
    sendRoomMessageWithPreMsgId(roomIds: Array<string>, content: string, msgPriority: number): IrcResultMsgInterface;
    getRoomHistoryMessage(roomId: string, tsOffset: number): IrcResultCode;
    getRoomHistoryMessageWithOption(roomId: string, tsOffset: number, option: HistoryMessageOption): IrcResultCode;
    sendRoomBinMessage(roomIds: Array<string>, dbKey: string, keyMsgId: string, content: Uint8Array): IrcResultCode;
    sendRoomBinMessageWithMsgOption(roomIds: Array<string>, dbKey: string, keyMsgId: string, content: Uint8Array, option: MessageOption): IrcResultCode;
    getRoomHistoryBinMessage(roomId: string, dbKey: string, lastKeyMsgId: string, order: boolean, count?: number): IrcResultCode;
    getRoomHistoryBinMessageWithOption(roomId: string, dbKey: string, lastKeyMsgId: string, order: boolean, option: HistoryMessageOption, count?: number): IrcResultCode;
    getRoomBatchHistoryBinaryMessages(getInfo: Array<RommHistoryBinMessage>): IrcResultCode;
    getStatistics(key: string, params: object): IrcResultCode;
    getRoomUserList(roomIds: Array<string>, mode: number): IrcResultCode;
    on(eventType: string, callback: any): IrcResultCode;
    off(eventType: string, callback: any): IrcResultCode;
}

// ===== IRC Client =====
interface LiveInfoInterface {
    nickname: string;
    liveId: string;
    businessId: string;
    classId: string;
    location: string;
    subBusinessId: string;
    role?: UserRole;
}
declare class IrcClient extends ClientInstance {
    private ircCore;
    readonly PeerChatManager: PeerChatManager;
    readonly RoomChatManager: RoomChatManager;
    constructor(sdkConfig: InstanceSdkConfig);
    init(appId: string, appKey: string): IrcResultCode;
    uninit(): IrcResultCode;
    unInit(): IrcResultCode;
    setSdkProperties(properties: ChatSdkPropertyInterface): IrcResultCode;
    setLiveInfo(liveInfo: LiveInfoInterface): IrcResultCode;
    startNetworkQulityTest(urls: Array<string>, times: number): IrcResultCode;
    login(psId: string, password: string, kickout?: boolean): IrcResultCode;
    loginWithMode(psId: string, password: string, roomUserMode: number, kickout?: boolean): IrcResultCode;
    logout(): IrcResultCode;
    on(eventType: string, callback: any): IrcResultCode;
    off(eventType: string, callback: any): IrcResultCode;
}

// ===== Main Client Class =====
declare class Client {
    static readonly CHAT = 1;
    static readonly PUSH = 2;
    static readonly IM = 3;
    static readonly CHANNEL = 4;
    readonly CHAT = 1;
    readonly PUSH = 2;
    readonly IM = 3;
    readonly CHANNEL = 4;
    static readonly VERSION: string;
    protected instances: Map<number, ClientInstance>;
    appId: string;
    bizId: string;
    clientId: string;
    appVersion: string;
    sdkConfig: SdkConfig;
    constructor(appId: string, appVersion?: string, bizId?: string);
    /**
     * 设置SDK配置
     */
    setSdkConfig(sdkConfig: SdkConfig): ResultCode;
    getInstance(type: number): ClientInstance;
    releaseInstance(type: number): void;
    static getVersion(): string;
}

// ===== Exports =====
export default Client;
export {
  Client,
  IrcClient,
  PeerChatManager,
  RoomChatManager,
  ResultCode,
  ClientInstance,
  SdkConfig,
  InstanceSdkConfig
};
