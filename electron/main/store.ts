import Store from "electron-store";
import { IStore } from "~/Shared/store";
import { migrate0_2_1, migrate2_1_0 } from "../migration/migration";

export const store = new Store<IStore>({
  beforeEachMigration: (_, context) => {
    console.log(
      `[store] migrate from ${context.fromVersion} => ${context.toVersion}`
    );
    if (context.fromVersion === "0.2.1") {
      migrate0_2_1();
    }
    if (context.fromVersion === "2.0.2") {
      console.log("migrate2_1_0");
      migrate2_1_0();
    }
  },
});
