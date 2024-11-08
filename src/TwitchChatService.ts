// src/twitchChatService.ts
import tmi from "tmi.js";
import { Ref } from "vue";


export function connectToTwitchChat(
  channel: string,
  count: Ref<number>
) {
  const client = new tmi.Client({
    options: { debug: true },
    channels: [channel],
  });

  client.connect().catch(console.error);

  client.on("message", (channel, tags, message, self) => {
    const displayName = tags["display-name"];

    if (self) return; // Ignore messages from the bot itself
    if (message === "!wheel" && displayName ) {
      console.log(`Adding ${displayName} to the wheel`);
      // build the Entry object
      const entry = {
        text: displayName,
        claimedHere: true,
        weight: 1,
      };
      window.contextData.addWheelUser(entry);
      count.value++;
    }
    // let users remove themselves from the wheel
    if (message === "!remove" && displayName) {
      console.log(`Removing ${displayName} from the wheel`);
      window.contextData.removeWheelUser(displayName);
      count.value--;
    }

    if (message === "!here" && displayName) {
      // TODO claimed here logic
    }
    console.log(`Message: ${message}`);
    
    // dev debug mode to add random names to the wheel when the message is "!dev" accept a number after for the amount of random names to add
    if (message && displayName && import.meta.env.DEV) {
      console.log(`Adding random names to the wheel`);
      
      const randomName = Math.random().toString(36).substring(7);
      const entry = {
        text: randomName,
        claimedHere: true,
        weight: 1,
      };
      window.contextData.addWheelUser(entry);
    }
  }
  );


  return client;
}
