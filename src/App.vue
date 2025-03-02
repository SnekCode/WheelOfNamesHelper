<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import Updater from "./components/Updater.vue";
import ReleaseNotes from "./components/ReleaseNotes.vue";
import tmi from "tmi.js";
import { Entry } from "../Shared/types";
import { Service } from "../Shared/enums";

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
    // contextData.forceUpdate();
  }
};

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



const sortWeight = (a: Entry, b: Entry) => b.weight - a.weight;
const sortTimestamp = (a: Entry, b: Entry) => {
  const time1: number = a.timestamp || 0;
  const time2: number = b.timestamp || 0;
  return time2 - time1;
};

const sortAlphabetical = (a: Entry, b: Entry) => a.text.localeCompare(b.text);

const filteredUsers = computed<Entry[]>(() => {
  const sort = (a: Entry, b: Entry) => {
    switch (filterType.value) {
      case FilterType.WEIGHT:
        return sortWeight(a, b);
      case FilterType.ACTIVITY:
        return sortTimestamp(a, b);
      case FilterType.ALPHABETICAL:
        return sortAlphabetical(a, b);
      case FilterType.ENABLED:
        return a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1;
      default:
        return sortTimestamp(a, b);
    }
  };

  const filter = filterText.value.toLowerCase();
  const filters = users.value
    .filter((user) => user.text.toLowerCase().includes(filter))
    .sort(sort);

  if (sortType.value === SortType.ASC) {
    return filters.reverse();
  }

  return filters;
});

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
    contextData.removeWheelUser(user.text);
  } else {
    contextData.addUpdateWheelUser({ ...user });
  }
};

const openWheelWindow = async () => {
  await window.electronAPI.openWheelWindow();
  window.electronAPI.setDefaults();
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
      <button :class="`youtube-button ${searching ? 'youtube-button-searching' : ''
        } ${isLiveBroadCast ? 'hide' : ''}`">
        {{ searching ? "Waiting..." : "Check Status" }}
      </button>
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
      <input class="search" v-model="filterText" placeholder="Filter users by name" />
      <button class="clear" @click="filterText = ''">✖</button>
    </div>
    <br />
    <br />
    <!-- <input v-on:blur="updateChannel" v-model="channel" placeholder="Enter the channel to join" /> -->
    <!-- map over the wheelUsers object to display in a grid pattern with buttons to remove from the object -->
    <div class="grid">
      <div v-for="user in filteredUsers" :key="user.text">
        <div class="userList" v-if="(user && user.weight > 0) || filterText"
          :class="{ new: !user.claimedHere, here: user.claimedHere }">
          <button class="subbtn" @click="decrementChances(user)">➖</button>
          <!-- @click="contextData.removeWheelUser(user.text)" -->
          <div class="name">
            {{ user.text }}
            <div>{{ user.weight }}</div>
            <div>{{ getTime(user.timestamp ?? 0) }}</div>
            <!-- checkbox based on the user.enabled property. This should set the property when checked -->
            <!-- contextData.updateWheelUser({...user, enabled:}) -->
            <!-- onclick pass the checkbox value to contextData.updateWheelUser -->
            <input type="checkbox" v-model="user.enabled"
              @click="contextData.addUpdateWheelUser({...user, enabled: !user.enabled})" />

          </div>
          <button class="addbtn" @click="incrementChances(user)">➕</button>
        </div>
      </div>
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 200px));
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
  align-items: center;
  justify-content: space-between;
  margin: 0.5em;
  padding: 0.5em;
  border: 1px solid #ccc;
  border-radius: 0.5em;
  background-color: #65a0c7;
  color: black;
}

.name {
  width: 10rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.new {
  background-color: #4c5eaf;
  opacity: 0.7;
}

.here {
  background-color: #36cef4;
  opacity: 0.7;
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
