<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import Updater from "./components/Updater.vue";
import ReleaseNotes from "./components/ReleaseNotes.vue";
import tmi from "tmi.js";
import { Entry, Winner } from "../Shared/types";
import { Service } from "../Shared/enums";
import { StoreKeys } from "../Shared/store";

enum FilterType {
  ACTIVITY = "activity",
  WEIGHT = "weight",
  ALPHABETICAL = "alphabetical",
  ENABLED = "enabled",
}
enum SortType {
  ASC = "asc",
  DESC = "desc",
}
const { store, ipcRenderer, contextData } = window;

const twitchHandle = ref(""); // Add a ref for the channel
const twitchClient = ref<tmi.Client | void>(); // Add a ref for the twitch client
const twitchWheelCount = ref(0); // Add a ref for the count
const twitchHereCount = ref(0); // Add a ref for the count
const youtubeWheelCount = ref(0); // Add a ref for the count
const youtubeHereCount = ref(0); // Add a ref for the count
const users = ref<Entry[]>([] as Entry[]); // Add a ref for the users
const winners = ref<Winner[]>([]);
let receivedWinnerUpdate = false;
const filterText = ref(""); // Add a ref for the filter text
let timerRef = ref(""); // Add a ref for the timer
const appLoadTime = ref(Date.now()); // Add a ref for the app load time

const newUser = ref(""); // Add a ref for the new user
const newChances = ref("1"); // Add a ref for the new chances

const messagesCount = ref(0); // Add a ref for the messages count

// youtube status variables
const isLiveBroadCast = ref(false);
const isYoutubeAuthenticated = ref(false);
const isTwitchConnected = ref(false);
const isDiscordConnected = ref(false);
const discordViewerChannel = ref("");
const discordStreamerChannel = ref("");
const youtubeHandle = ref("");
const videoId = ref("");
const searching = ref(false);
const filterType = ref(FilterType.ACTIVITY);
const sortType = ref(SortType.DESC);

const addUser = () => {
  if (newUser.value && newChances.value) {
    contextData.addUpdateWheelUser(
      {
        text: newUser.value,
        weight: parseInt(newChances.value),
        enabled: true,
        claimedHere: false,
      } as Entry,
      true
    );
  }
};

// updater / listener
ipcRenderer.on('storeUpdate', (event, storeName, data) => {
    if (storeName === StoreKeys.winners) {
        receivedWinnerUpdate = true;
        winners.value = data;
    }
    if (storeName === 'discord_enabled') {
        isDiscordConnected.value = data;
    }
    if( storeName === 'discord_viewersChannelName') {
        discordViewerChannel.value = data;
    }
    if( storeName === 'discord_userVoiceChannelName') {
        discordStreamerChannel.value = data;
    }
    console.log(`Store updated: ${storeName}`, data);
});

ipcRenderer.invoke("getStore", StoreKeys.winners).then((data: Winner[] | undefined) => {
  if (!receivedWinnerUpdate) winners.value = data ?? [];
});

ipcRenderer.on(`${Service.YouTube}-add-wheel`, () => {
  youtubeWheelCount.value += 1;
});

ipcRenderer.on(`${Service.YouTube}-remove-wheel`, () => {
  youtubeWheelCount.value -= 1;
});

ipcRenderer.on(`${Service.YouTube}-add-here`, () => {
  youtubeHereCount.value += 1;
});

ipcRenderer.on(`${Service.YouTube}-remove-here`, () => {
  youtubeHereCount.value -= 1;
});

ipcRenderer.on(`${Service.Twitch}-add-wheel`, () => {
  twitchWheelCount.value += 1;
});

ipcRenderer.on(`${Service.Twitch}-remove-wheel`, () => {
  twitchWheelCount.value -= 1;
});

ipcRenderer.on(`${Service.Twitch}-add-here`, () => {
  twitchHereCount.value += 1;
});

ipcRenderer.on(`${Service.Twitch}-remove-here`, () => {
  twitchHereCount.value -= 1;
});

ipcRenderer.on('youtube-broadcast-searching', (_, bool: boolean) => {
  // isLiveBroadCast.value = bool;
  searching.value = bool;
});

ipcRenderer.on("youtube-authenticated", () => {
  console.log("youtube-authenticated");

  isYoutubeAuthenticated.value = true;
});

ipcRenderer.on("youtube-unauthenticated", () => {
  isYoutubeAuthenticated.value = false;
});

ipcRenderer.on("youtube-handle", (_, data) => {
  youtubeHandle.value = data;
});

ipcRenderer.on(
  "youtube-status",
  (
    _,
    status: {
      isLiveBroadCast: boolean;
      handle: string;
      videoId: string;
      searching: boolean;
    }
  ) => {
    console.log("youtube-status", status);
    isLiveBroadCast.value = status.isLiveBroadCast;
    youtubeHandle.value = status.handle;
    videoId.value = status.videoId;
    searching.value = status.searching;
  }
);

ipcRenderer.on('twitch-authenticated', () => {
  isTwitchConnected.value = true;
});

ipcRenderer.on('twitch-unauthenticated', () => {
  isTwitchConnected.value = false;
});

ipcRenderer.on("twitch-handle", (_, data) => {
  twitchHandle.value = data;
});

// get the channel name from the store
ipcRenderer.invoke("getStore", "twitchChannelName").then((channelName) => {
  twitchHandle.value = channelName;
});

// get discord channel names from the store
ipcRenderer.invoke("getStore", "discord_viewersChannelName").then((channelName) => {
  discordViewerChannel.value = channelName;
});
ipcRenderer.invoke("getStore", "discord_userVoiceChannelName").then((channelName) => {
  discordStreamerChannel.value = channelName;
});

// TODO change event name from handle to youtubeHandle e.g
ipcRenderer.invoke("getStore", "handle").then((handleName) => {
  youtubeHandle.value = handleName;
});

// get saved wheelusers from the store
ipcRenderer.invoke("getStore", "entries").then((data) => {
  if (!data) {
    users.value = [];
  } else {
    users.value = data;
  }
});

ipcRenderer.invoke("getStore", "discord_enabled").then((value) => {
  isDiscordConnected.value = value;
});


// Twitch chat services setup
ipcRenderer.send("did-finish-load");
// ipcRenderer.on("twitch-chat-connect", (_, data) => {
//     isTwitchConnected.value = data;
// });


// listen for app close event
ipcRenderer.on("app-close", () => {
  twitchClient.value?.disconnect();
});

// listen for storeUpdates
ipcRenderer.on("storeUpdate", (event, storeName, data) => {
  console.log("storeUpdate", name, data);
  if (storeName === "entries") {
    users.value = data;
  }
});

let intervalId: NodeJS.Timeout | null = null;

const updateTimer = () => {
  timerRef.value = getTime(appLoadTime.value);
};

onMounted(() => {
  updateTimer(); // Initial call to set the value immediately
  intervalId = setInterval(updateTimer, 1000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId); // Clean up interval when component is unmounted
});



const filterAndSort = <T,>(items: T[], getEntry: (item: T) => Entry, getActivity: (item: T) => number) => {
  const filter = filterText.value.trim().toLowerCase();
  return items
    .filter(item => getEntry(item).text.toLowerCase().includes(filter))
    .sort((a, b) => {
      const first = getEntry(a);
      const second = getEntry(b);
      let order: number;
      switch (filterType.value) {
        case FilterType.WEIGHT:
          order = second.weight - first.weight;
          break;
        case FilterType.ALPHABETICAL:
          order = first.text.localeCompare(second.text);
          break;
        case FilterType.ENABLED:
          order = Number(Boolean(second.enabled)) - Number(Boolean(first.enabled));
          break;
        default:
          order = getActivity(b) - getActivity(a);
      }
      return sortType.value === SortType.ASC ? -order : order;
    });
};

const lists = computed(() => [
  {
    id: "queue",
    title: "Wheel Queue",
    empty: "No names in the queue.",
    cards: filterAndSort(
      users.value.filter(entry => entry.weight > 0 || filterText.value.trim()),
      entry => entry,
      entry => entry.timestamp ?? 0
    )
      .map(entry => ({ key: entry.channelId ?? entry.text, entry, winner: undefined })),
  },
  {
    id: "winners",
    title: "Winners",
    empty: "No winners yet.",
    cards: filterAndSort(winners.value, winner => winner.entry ?? {
      text: winner.name, service: winner.service, weight: 1, claimedHere: false,
    }, winner => winner.drawnAt)
      .map(winner => ({ key: winner.id!, entry: winner.entry, winner })),
  },
]);

const cardError = ref("");
const updateCard = async (action: string, ...args: string[]) => {
  cardError.value = "";
  try {
    if (!await ipcRenderer.invoke(action, ...args)) {
      cardError.value = "Could not move this card. If the wheel is spinning, try again after closing the result.";
    }
  } catch {
    cardError.value = "Could not update this card. Please try again.";
  }
};

const removeAllWinners = () => {
  if (window.confirm("Remove all winners from the history?")) {
    void updateCard("removeAllWinners");
  }
};

const resetWheelRequests = () => {
  twitchWheelCount.value = 0;
  twitchHereCount.value = 0;

  youtubeWheelCount.value = 0;
  youtubeHereCount.value = 0;
};

const resetClaims = () => {
  contextData.resetClaims();
  resetWheelRequests();
};

const removeNotClaimed = () => {
  contextData.removeNotClaimed();
  resetWheelRequests();

};

const incrementChances = (user: Entry) => {
  user.weight = (user.weight || 0) + 1;
  contextData.addUpdateWheelUser({ ...user });
};

const decrementChances = (user: Entry) => {
  user.weight = Math.max((user.weight || 0) - 1, 0);
  if (user.weight === 0) {
    contextData.removeWheelUser(user.channelId ?? user.text);
  } else {
    contextData.addUpdateWheelUser({ ...user });
  }
};

const openWheelWindow = async () => {
  await window.electronAPI.openWheelWindow();
};

const getTime = (timestamp: number) => {
  const currentTime = Date.now();
  const differenceMilliseconds = currentTime - timestamp;
  const differenceInSeconds = differenceMilliseconds / 1000;
  const minutes = Math.floor(differenceInSeconds / 60); // Get the minutes
  const seconds = parseInt((differenceInSeconds % 60).toFixed(0)); // Get the remaining seconds
  if (timestamp === 0) {
    return "???";
  }
  return `${minutes}m ${seconds}s`;
};

const clearDiscordChannel = () => {
  ipcRenderer.send("clear_voice_channel");
};


</script>

<template>
  <button @click="openWheelWindow">Open Wheel</button>
  <!-- watermark style text at the top left of the channel value -->
  <div style="position: fixed; left: -100px">{{ messagesCount }}</div>
  <div class="hiddenTimer">{{
    timerRef }}</div>
  <div class="channel-name">
    <!-- Twitch Section -->
    <div class="channel-section">
      <label for="channel-name">Twitch Channel</label>
      <div v-if="!twitchHandle" class="hint">(Sign In to Twitch account)</div>
      <div v-else>
        {{ twitchHandle }}
        <span v-if="isTwitchConnected" class="check-mark">✔️</span>
        <span v-else class="check-mark" style="color: pink">Sign in for Chat Bot</span>
      </div>
    </div>

    <!-- YouTube Section -->
    <div class="youtube-section">
      <div class="channel-section">
        <label for="youtube-channel">YouTube Channel</label>
        <div v-if="!youtubeHandle" class="hint">
          (Sign In to Youtube account)
        </div>
        <div v-else>
          {{ youtubeHandle }}
          <span v-if="isYoutubeAuthenticated" class="check-mark">✔️</span>
          <span v-else class="check-mark" style="color: pink">Sign in for !odds</span>
        </div>
      </div>
      <button :class="`youtube-button ${isYoutubeAuthenticated ? '': 'hide'} ${searching ? 'youtube-button-searching' : ''}`">
        {{ isLiveBroadCast ? "Live" : "Waiting" }}
      </button>
    </div>

    <!-- Discord Section -->
    <div v-if="isDiscordConnected" class="channel-section">
      <label for="discord-channel">Discord</label>
        <span class="check-mark">✔️</span>
      <div>Streamer Channel: {{ discordStreamerChannel }}</div>
      <div>Viewer Channel: {{ discordViewerChannel }}</div>
    </div>
  </div>

  <!-- Update component -->
  <Updater />
  <!-- Release Notes component -->
  <ReleaseNotes />
  <!-- button top right of screen with red background for reset -->
  <div class="container">
    <div class="caution">
      <button @click="removeNotClaimed" class="removeClaimed">
        Remove Not Claimed
      </button>
      <button @click="resetClaims" class="resetClaimed">Reset !here</button>
      <button v-if="isDiscordConnected" @click="clearDiscordChannel" class="resetClaimed">Clear Discord Channel</button>
    </div>
    <div class="container">
      <div class="flex-center">
        <div style="margin: 10px">Twitch !wheel: {{ twitchWheelCount }}</div>
        <div style="margin: 10px">Twitch !here: {{ twitchHereCount }}</div>
      </div>
      <div class="flex-center">
        <div style="margin: 10px">YouTube !wheel: {{ youtubeWheelCount }}</div>
        <div style="margin: 10px">YouTube !here: {{ youtubeHereCount }}</div>
      </div>
    </div>
    <button @click="resetWheelRequests" class="resetCount">Reset Count</button>
    <br />
    <br />

    <!-- Add Button with two input fields one for name and the other for chances the add button will add the name and chances to the wheelofname users -->
    <input style="margin: 15px" v-model="newUser" placeholder="Enter the name" />
    <input style="margin: 15px" v-model="newChances" placeholder="Enter the chances"
      @input="newChances = newChances.replace(/\D/g, '')" />
    <button :class="{
      addViewer: newUser && newChances,
      disabled: !newUser || !newChances,
    }" style="margin: 15px" @click="addUser">
      Add Viewer
    </button>

    <div style="display: flex; align-items: center">
      <!-- drop down menu for all sort types -->
      <select class="select" v-model="filterType">
        <option value="activity">Sort by Activity</option>
        <option value="weight">Sort by Weight</option>
        <option value="alphabetical">Sort by Alphabetical</option>
        <option value="enabled">Sort by Enabled</option>
      </select>
      <!-- drop down menu for sort ascension -->
      <select class="select" v-model="sortType">
        <option value="asc">Sort Ascending</option>
        <option value="desc">Sort Descending</option>
      </select>
      <input class="search" v-model="filterText" aria-label="Filter both lists by name" placeholder="Filter both lists by name" />
      <button class="clear" @click="filterText = ''">✖</button>
    </div>
    <p v-if="cardError" role="status">{{ cardError }}</p>
    <div class="wheel-lists">
      <section v-for="list in lists" :key="list.id" :class="['wheel-list', list.id]"
        :aria-labelledby="`${list.id}-heading`">
        <header class="wheel-list-heading">
          <h2 :id="`${list.id}-heading`">{{ list.title }}</h2>
          <button v-if="list.id === 'winners' && winners.length" class="remove-card" @click="removeAllWinners">
            Remove All Winners
          </button>
        </header>
        <p v-if="!list.cards.length">{{ filterText.trim() ? "No matching names." : list.empty }}</p>
        <ul v-else class="card-list">
          <li v-for="{ key, entry, winner } in list.cards" :key="key" class="userList"
            :class="{ new: entry && !entry.claimedHere, here: entry?.claimedHere }">
            <div v-if="winner" class="card-details">
              <strong>{{ winner.name }}</strong>
              <div v-if="winner.service">{{ winner.service }}</div>
              <time :datetime="new Date(winner.drawnAt).toISOString()">{{ new Date(winner.drawnAt).toLocaleString() }}</time>
              <div v-if="entry">{{ entry.weight }} chances · {{ entry.enabled ? "Enabled" : "Disabled" }}</div>
            </div>
            <div v-else-if="entry" class="queue-details">
              <button class="subbtn" :aria-label="`Decrease chances for ${entry.text}`"
                @click="decrementChances(entry)">➖</button>
              <div class="card-details">
                <strong>{{ entry.text }}</strong>
                <div>{{ entry.weight }} chances · {{ getTime(entry.timestamp ?? 0) }}</div>
                <label>
                  <input type="checkbox" :checked="entry.enabled"
                    @change="contextData.addUpdateWheelUser({ ...entry, enabled: !entry.enabled })" />
                  Enabled
                </label>
              </div>
              <button class="addbtn" :aria-label="`Increase chances for ${entry.text}`"
                @click="incrementChances(entry)">➕</button>
            </div>
            <div class="card-actions">
              <template v-if="winner">
                <button @click="updateCard('returnWinnerToQueue', key)">Back to Queue</button>
                <button class="remove-card" @click="updateCard('removeWinner', key)">Remove</button>
              </template>
              <button v-else @click="updateCard('moveToWinners', key)">Move to Winners</button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style>
/* class="flex-center" style="position: absolute; top: 0; right: 0; background-color: red; color: white; border: none; cursor: pointer; padding: 5px 12px; margin: 10px; font-size: 14px;" */

.caution {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
}

.resetClaimed {
  background-color: rgba(255, 0, 0, 0.4);
  color: white;
  border-width: 2px;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none;
  /* Prevent text selection */
}

.resetClaimed:hover {
  background-color: rgba(255, 0, 0, 0.8);
  border-color: white;
}

.removeClaimed {
  background-color: rgba(255, 0, 0, 0.4);
  color: white;
  border-width: 2px;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none;
  /* Prevent text selection */
}

.removeClaimed:hover {
  background-color: rgba(255, 0, 0, 0.8);
  border-color: white;
}

.resetCount {
  /* position: absolute;
  top: 0;
  right: 100; */
  background-color: blue;
  color: white;
  border-width: 2px;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none;
  /* Prevent text selection */
}

.resetCount:hover {
  background-color: darkblue;
  border-color: white;
}

.copyButton {
  background-color: #4caf4fee;
  color: rgb(255, 255, 255);
  color: white;
  border: none;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none;
  /* Prevent text selection */
}

.check-mark {
  margin-left: 0.2em;
  color: green;
}

.youtube-section {
  /* align items left */
  display: flex;
  flex-direction: column;
  justify-items: end;
}

.youtube-button {
  background-color: rgba(255, 0, 0, 0.4);
  /* YouTube red */
  border-width: 2px;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 2em;
  max-width: fit-content;
  text-align: center;
  justify-content: center;
  user-select: none;
  /* Prevent text selection */
}

.youtube-button-searching {
  animation: pulse 2s infinite;
}

.youtube-button:hover {
  background-color: rgba(255, 0, 0, 0.8);
  /* Darker red on hover */
  border-color: white;
}

/* \ animation that pulses the border of the .youtube-button  */
@keyframes pulse {
  0% {
    border-color: white;
    opacity: 0.2;
  }

  50% {
    border-color: #ff0000;
    opacity: 1;
  }

  100% {
    border-color: white;
    opacity: 0.2;
  }
}

.addViewer {
  background-color: #4caf4fee;
  color: rgb(255, 255, 255);
  border: none;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none;
  /* Prevent text selection */
}

.disabled {
  background-color: #ccc;
  color: #666;
  opacity: 0.5;
  cursor: not-allowed;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none;
  /* Prevent text selection */
}

.container {
  margin-top: 0;
  user-select: none;
  /* Prevent text selection */
}

.channel-name {
  position: absolute;
  top: 0px;
  left: 0;
  margin: 5px;
  font-size: 16px;
  user-select: none;
  /* Prevent text selection */
  text-align: left;
}

.hiddenTimer {
  position: fixed;
  right: 0;
  top: 0;
  color: white;
  margin: 5px;
  font-size: 16px;
  user-select: none;
  opacity: 0;
}

.channel-section {
  opacity: 0.8;
}

.recording {
  animation: recording 1s infinite alternate;
  border-radius: 50%;
  height: 0.5em;
  width: 0.5em;
  margin-bottom: 0.1em;
  display: inline-block;
  margin-left: 0.5em;
}

@keyframes recording {
  0% {
    background-color: rgb(109, 109, 109);
  }

  50% {
    background-color: #f00;
  }

  100% {
    background-color: red;
  }
}

.wheel-lists {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1rem;
  margin-top: 1rem;
  text-align: left;
}

.wheel-list {
  min-width: 0;
  border: 1px solid #8888;
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.wheel-list.winners {
  border-top: 3px solid #d7a849;
}

.wheel-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.wheel-list h2 {
  margin: 0;
  font-size: 1.1rem;
}

.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.winners .card-list {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 560px) {
  .wheel-lists {
    grid-template-columns: minmax(0, 1fr);
  }
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.search {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.select {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-right: 15px;
}

.clear {
  background-color: #f44336;
  color: white;
  border: none;
  cursor: pointer;
  padding: 3px 9px;
  margin-left: 10px;
  font-size: 20px;
}

.userList {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 0.5em;
  background-color: #65a0c7;
  color: black;
  text-align: center;
}

.queue-details, .card-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.card-details {
  min-width: 0;
  overflow-wrap: anywhere;
}

.card-actions {
  flex-wrap: wrap;
}

.card-actions button, .wheel-list-heading button {
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
}

.wheel-list .remove-card {
  background-color: #922d28;
  color: white;
}

.new {
  background-color: #7181bd;
}

.here {
  background-color: #54b3ce;
}

.addbtn {
  background-color: #4caf4fee;
  color: rgb(255, 255, 255);
  border: none;
  cursor: pointer;
  padding: 10px;
  margin-right: 10px;
  font-size: 12px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subbtn {
  background-color: #bd332ae8;
  color: rgb(253, 0, 0);
  border: none;
  cursor: pointer;
  padding: 10px;
  margin-left: 10px;
  font-size: 12px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hide {
  display: none;
}

.logo.electron:hover {
  filter: drop-shadow(0 0 2em #9feaf9);
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
