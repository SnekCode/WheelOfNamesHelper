import { app, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { parse } from "marked";
import { EChannels } from "~/Shared/channels";
import { store } from "../main/store";

const basePath = app.getAppPath();

// get public/release-notes.md
const releaseNotesFilePath = path.join(basePath, "public", "release-notes.md");

export const getReleaseNotes = async () => {
  const data = fs.readFileSync(releaseNotesFilePath, "utf-8");
  const htmlContent = parse(data);
  return htmlContent;
};

ipcMain.on(EChannels.releaseNotes, async (event, data) => {
  store.set("changeLogViewed", data);
});

ipcMain.handle(EChannels.releaseNotes, async () => {
  const isNewNotes = store.get("changeLogViewed", false);
  if (!isNewNotes) {
    //   store.set("changeLogViewed", true);
    const notes = await getReleaseNotes();
    return [true, notes];
  } else {
    return [false, ""];
  }
});
