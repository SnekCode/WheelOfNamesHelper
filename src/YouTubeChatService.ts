import { Ref } from 'vue';
import { LiveChat } from 'youtube-chat';
import { WheelUsers } from './TwitchChatService';

export const resetAllClaimedHere = (users: WheelUsers) => {
  const newUsers = { ...users };
  for (const key in newUsers) {
    newUsers[key].claimedHere = false;
  }
  return newUsers;
};

export function connectToYouTubeChat(channelId: string, users: Ref<WheelUsers>, count: Ref<number>) {
  const liveChat = new LiveChat({ channelId });

  liveChat.on('start', () => {
    console.log('YouTube chat started');
  });

  liveChat.on('chat', (chatItem) => {
    const displayName = chatItem.author.name;
    const message = chatItem.message[0].text;

    if (message === '!wheel' && displayName) {
      console.log(`Adding ${displayName} to the wheel`);
      if (!users.value[displayName]) {
        users.value = updateValue(users.value, displayName, true);
        users.value = updateChances(users.value, displayName, 1);
        users.value = updateClaimedHere(users.value, displayName, true);
        count.value += 1;
      }
    }
  });

  liveChat.on('error', (err) => {
    console.error('YouTube chat error:', err);
  });

  liveChat.start();
}

function updateValue(users: WheelUsers, name: string, value: boolean): WheelUsers {
  return { ...users, [name]: { ...users[name], value } };
}

function updateChances(users: WheelUsers, name: string, chances: number): WheelUsers {
  return { ...users, [name]: { ...users[name], chances } };
}

function updateClaimedHere(users: WheelUsers, name: string, claimedHere: boolean): WheelUsers {
  return { ...users, [name]: { ...users[name], claimedHere } };
}