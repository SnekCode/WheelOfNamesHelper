// src/twitchChatService.ts
import tmi from 'tmi.js';
import { Ref } from "vue";

export type WheelUsers = {
  [key: string]: {
    value: boolean;
    chances: number;
    claimedHere: boolean;
  };
};

export const wheelUsers: WheelUsers = {

};

// update value only spread rest of object
const updateValue = (users: WheelUsers, key: string, value: boolean) => {
    return {
        ...users,
        [key]: {
        ...users[key],
        value,
        },
    };
}

// update chances only spread rest of object
const updateChances = (users: WheelUsers, key: string, chances: number) => {
  return {
    ...users,
    [key]: {
      ...users[key],
      chances,
    },
  };
};

// update claimedHere only spread rest of object
const updateClaimedHere = (
  users: WheelUsers,
  key: string,
  claimedHere: boolean
) => {
  return {
    ...users,
    [key]: {
      ...users[key],
      claimedHere,
    },
  };
};

export const resetAllClaimedHere = (users: WheelUsers) => {
    const newUsers = { ...users };
    for (const key in newUsers) {
        newUsers[key].claimedHere = false;
    }
    return newUsers;
};


export function connectToTwitchChat(channel: string, users: Ref<WheelUsers>, count : Ref<number>) {
  const client = new tmi.Client({
    options: { debug: true },
    channels: [channel],
  });

  client.connect().catch(console.error);

  client.on("message", (channel, tags, message, self) => {
    if (self) return; // Ignore messages from the bot itself
    // check if message is a command "!wheel"
    if (message === "!wheel" && tags["display-name"]) {
      // Here you can add code to handle the command, e.g., spin the wheel
      console.log(`Adding ${tags["display-name"]} to the wheel`);
      if (!wheelUsers[tags["display-name"]]) {
        users.value = updateValue(users.value, tags["display-name"], true);
        users.value = updateChances(users.value, tags["display-name"], 1);
        users.value = updateClaimedHere(
          users.value,
          tags["display-name"],
          true
        );
      }else{
          users.value = updateValue(users.value, tags["display-name"], true);
      }
        count.value = count.value + 1;
    }
    // let users remove themselves from the wheel
    if (message === "!remove" && tags["display-name"]) {
      console.log(`Removing ${tags["display-name"]} from the wheel`);
      users.value = updateValue(users.value, tags["display-name"], false);
      count.value = count.value - 1;
    }

    if (message === "!here" && tags["display-name"]) {
        console.log(`Claiming ${tags["display-name"]} from the wheel`);
        if (!wheelUsers[tags["display-name"]].claimedHere) {
            users.value = updateClaimedHere(
              users.value,
              tags["display-name"],
              true
            );
            // double the chances of the user
            users.value = updateChances(
              users.value,
              tags["display-name"],
              wheelUsers[tags["display-name"]].chances * 2
            );
            count.value = count.value + 1;
        }

    }
    // Here you can add code to handle the message, e.g., display it in your app
  });

  return client;
}