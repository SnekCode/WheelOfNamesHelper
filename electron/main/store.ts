import { IpcMainInvokeEvent, ipcMain } from "electron";
import Store from "electron-store";
import { IStore, IStoreKeys } from "~/Shared/store";

export const store = new Store<IStore>({
  beforeEachMigration: (_, context) => {
    console.log(
      `[store] migrate from ${context.fromVersion} => ${context.toVersion}`
    );
  }
});

ipcMain.handle(
  "getStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K): IStore[K] => {
    return store.get(name);
  }
);

ipcMain.handle(
  "setStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K, data: IStore[K]) => {
    store.set(name, data);
  }
);
