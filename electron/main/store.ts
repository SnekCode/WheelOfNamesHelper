import { IpcMainInvokeEvent, ipcMain } from "electron";
import Store from "electron-store";
import { IStore, IStoreKeys, StoreKeys } from "~/Shared/store";
import { win } from "./main";
import { EChannels } from "~/Shared/channels";
import { WheelUsers } from "~/Shared/types";

export const store = new Store<IStore>({
  beforeEachMigration: (_, context) => {
    console.log(
      `[store] migrate from ${context.fromVersion} => ${context.toVersion}`
    );
    if (context.fromVersion === "0.2.1"){
      // migrate from 0.2.1 to 0.2.2
      // convert wheelUsers to to WheelConfig where wheelUsers data is mapped to entries
      const data = store.get("wheelUsers") as WheelUsers;
      const entries = Object.entries(data).map(([key, value]) => ({ text: key, ...value }));
      store.set(StoreKeys.data, { entries });
    }
  }
});