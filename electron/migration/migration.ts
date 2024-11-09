import { StoreKeys } from "~/Shared/store";
import { WheelUsers } from "~/Shared/types";
import { store } from "../main/store";


export const migrate0_2_1=()=>{
  // migrate from 0.2.1 to 0.2.2
  // convert wheelUsers to to WheelConfig where wheelUsers data is mapped to entries
  const data = JSON.parse(store.get("wheelUsers")) as WheelUsers
  const entries = Object.entries(data)
  .filter(([_, value]) => value.chances > 0)
  .map(([key, value]) => ({
    text: key,
    weight: value.chances,
    claimedHere: value.claimedHere,
    enabled: true
  }));
  store.set(StoreKeys.data, entries);
}