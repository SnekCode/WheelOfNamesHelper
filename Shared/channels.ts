import { ProgressInfo } from "electron-updater";

export enum EChannels {
  hideMessage = "hideMessage",
  showMessage = "showMessage",
  updateAvailable = "updateAvailable",
  updateDownloaded = "updateDownloaded",
  updateError = "updateError",
  update = "update",
  updateDownloadProgress = "updateDownloadProgress",
  updateInfo = "updateInfo",
}

export interface IChannelReceive {
  updateAvailable: boolean;
  updateDownloaded: boolean;
  updateInfo: string;
  updateDownloadProgress: ProgressInfo;
}

export interface IChannelSend {
  update: boolean;
}

export interface IChannels {
  updateDownloadProgress: ProgressInfo;
  updateInfo: (s: string) => string;
  updateDownloaded: (bool: boolean) => boolean;
  updateAvailable: (bool: boolean) => boolean;
}

export type IChannelKeys = keyof IChannels;

export const channelLog = (
  channel: string,
  direction: "sending" | "receiving",
  ...args: any[]
) => {
  // formatted log direction on Channel: arg1, arg2, arg3 with color based on direction
  // recieving is green sending in yellow
  // if in browser log to console

  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    const logDirection = direction === "sending" ? "sending" : "receiving";
    const logColor = direction === "sending" ? "color: yellow" : "color: green";
    const logArgs = args.map((arg) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg);
      } else {
        return arg;
      }
    });
    console.log(
      `%c${logDirection} on ${channel}: ${logArgs.join(", ")}`,
      logColor
    );
  } else {
    console.log(`${direction} on ${channel}: ${args.join(", ")}`);
  }
};
