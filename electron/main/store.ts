import { IpcMainInvokeEvent, ipcMain } from "electron";
import Store from "electron-store";
import { IStore, IStoreKeys } from "~/Shared/store";
import { win } from "./main";
import { EChannels } from "~/Shared/channels";

export const store = new Store<IStore>({
  beforeEachMigration: (_, context) => {
    console.log(
      `[store] migrate from ${context.fromVersion} => ${context.toVersion}`
    );
  }
});

const broadcastUpdate = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  win?.webContents.send(EChannels.storeUpdate, name, data);
}

export const setStore = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  store.set(name, data);
  console.warn(`Invoke: [store] set ${name} =>`, data);
  broadcastUpdate(name, data);
}

ipcMain.handle(
  "addWheelUser",
  (_: IpcMainInvokeEvent, name: string, user: IStore["data"][0]) => {
    const data = store.get("data");
    data[name] = user;
    store.set("data", data);
    broadcastUpdate("data", data);
  }
);

ipcMain.handle(
  "removeWheelUser",
  (_: IpcMainInvokeEvent, name: string) => {
    const data = store.get("data");
    delete data[name];
    store.set("data", data);
    broadcastUpdate("data", data);
  }
);

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
    console.warn(`Invoke: [store] set ${name} =>`, data);
    broadcastUpdate(name, data);
  }
);