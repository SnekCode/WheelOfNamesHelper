import ElectronStore from "electron-store";
import { StoreKeys } from "~/Shared/store";

class Store {
  private data: { [key: string]: any } = {};

  public isMock = true;

  constructor() {
    this.clear();
  }

  public get(key: string) {
    return this.data[key];
  }

  public set(key: string | Record<string, unknown>, value?: unknown) {
    if (typeof key === "string") {
      this.data[key] = value;
    } else {
      Object.assign(this.data, key);
    }
  }

  public delete(key: string) {
    delete this.data[key];
  }

  public clear() {
    this.data = {
      [StoreKeys.data]: [],
    };
  }
}

export const store = new Store();