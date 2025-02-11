import Store from "electron-store";
import { IStore } from "~/Shared/store";

export const store = new Store<IStore>({
  migrations: {
    "2.1.0": (store) => {
        const data = store.get('entries');
        const newData = data.map((entry: any) => ({ ...entry, enabled: false }));
        store.set('entries', newData);
    },
  },
});
