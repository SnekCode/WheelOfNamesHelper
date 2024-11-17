// src/twitchChatService.ts
import tmi from "tmi.js";
import { Ref } from "vue";
import { Entry } from "~/Shared/types";


export function connectToTwitchChat(
  channel: string,
  users: Ref<Entry[]>,
  wheelcount: Ref<number>,
  herecount: Ref<number>,
  messagesCount: Ref<number>
) {
  const client = new tmi.Client({
    options: { debug: true },
    channels: [channel],
  });

  client.connect().catch(console.error);

  client.on("message", async (channel, tags, message, self) => {
    const displayName = tags["display-name"];
    const channelId = tags["user-id"];

    if (self) return; // Ignore messages from the bot itself
    if (message === "!wheel" && displayName ) {
      console.log(`Adding ${displayName} to the wheel`);
      // build the Entry object
      const entry = {
        text: displayName,
        channelId: tags["user-id"],
        claimedHere: true,
        weight: 1,
        enabled: true,
      };
      const bool = await window.contextData.addWheelUser(entry);
      if (bool) wheelcount.value++;
    }
    // let users remove themselves from the wheel
    if (message === "!remove" && displayName) {
      console.log(`Removing ${displayName} from the wheel`);
      const bool = await window.contextData.removeWheelUser(displayName);
      if(bool) wheelcount.value--;
    }

    if (message === "!here" && displayName) {
      // TODO claimed here logic
      // filter through users looking for user.text === displayName and set claimedHere to true and duplicate the weight
      const user = users.value.find((user) => user.text === displayName);
      if (user && !user?.claimedHere) {
        console.log(`Claiming ${displayName} is here`, {...user});
        user.claimedHere = true;
        user.weight = user.weight * 2;
        window.contextData.updateWheelUser({...user});
        herecount.value++;
      }
    }

    // update the user's activity
    if (displayName) {
      window.contextData.updateActivity(displayName, channelId);
      messagesCount.value++;
    }

    // // dev debug mode to add random names to the wheel when the message is "!dev" accept a number after for the amount of random names to add
    // if (message && displayName && import.meta.env.DEV) {
    //   console.log(`Adding random names to the wheel`, message);
      
    //   const randomName = Math.random().toString(36).substring(7);
    //   const entry = {
    //     text: randomName,
    //     claimedHere: true,
    //     weight: 1,
    //     enabled: true,
    //   };
    //   window.contextData.addWheelUser(entry);
    //   wheelcount.value++;
    // }
  }
  );


  return client;
}
