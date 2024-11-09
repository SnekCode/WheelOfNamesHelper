import Store from "electron-store";
import { IStore } from "~/Shared/store";
import { migrate0_2_1 } from "../migration/migration";

export const store = new Store<IStore>({
  beforeEachMigration: (_, context) => {
    console.log(
      `[store] migrate from ${context.fromVersion} => ${context.toVersion}`
    );
    if (context.fromVersion === "0.2.1") {
      migrate0_2_1();
    }
  },
});

// if (import.meta.env.DEV) {
//   migrate0_2_1();
//   // win on will close event to delete the StoreKeys.data
// }
