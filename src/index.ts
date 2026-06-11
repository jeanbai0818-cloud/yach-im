import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";
import { yachImPlugin } from "./channel.js";

export default defineChannelPluginEntry({
  id: "yach-im",
  name: "Yach IM",
  description: "OpenClaw chat channel plugin for Yach.",
  plugin: yachImPlugin,
});
