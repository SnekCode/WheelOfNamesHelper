<script setup lang="ts">
import { ref, computed } from "vue";
import { connectToTwitchChat } from "./TwitchChatService";
import Updater from "./components/Updater.vue";
import tmi from "tmi.js";
import { Entry } from "~/Shared/types";

const { store, ipcRenderer, contextData } = window;

const channel = ref(""); // Add a ref for the channel
const twitchClient = ref<tmi.Client | void>(); // Add a ref for the twitch client
const twitchCount = ref(0); // Add a ref for the count
const twitchClaimedCount = ref(0); // Add a ref for the count
const youtubeCount = ref(0); // Add a ref for the count
const youtubeClaimedCount = ref(0); // Add a ref for the count
const users = ref<Entry[]>([] as Entry[]); // Add a ref for the users
const filterText = ref(""); // Add a ref for the filter text

const newUser = ref(""); // Add a ref for the new user
const newChances = ref("1"); // Add a ref for the new chances

// youtube status variables
const isLiveBroadCast = ref(false);
const handle = ref("");
const videoId = ref("");
const searching = ref(false);

const addUser = () => {
  if (newUser.value && newChances.value) {
    contextData.addWheelUser(
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

console.log("entries top lvl", users.value);


ipcRenderer.on("youtube-add-count", () => {
  youtubeCount.value += 1;
});

ipcRenderer.on("youtube-sub-count", () => {
  youtubeCount.value -= 1;
});

ipcRenderer.on("twitch-here-count", () => {
  youtubeClaimedCount.value += 1;
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
    handle.value = status.handle;
    videoId.value = status.videoId;
    searching.value = status.searching;
  }
);

// get the channel name from the store
ipcRenderer.invoke("getStore", "twitchChannelName").then((channelName) => {
  console.log("channelName", channelName);
  channel.value = channelName;
  twitchClient.value = connectToTwitchChat(
    channel.value,
    users,
    twitchCount,
    twitchClaimedCount
  );
});

ipcRenderer.invoke("getStore", "handle").then((handleName) => {
  console.log("handleName", handleName);
  handle.value = handleName;
});

// get saved wheelusers from the store
ipcRenderer.invoke("getStore", "entries").then((data) => {
  console.log("entries", data);
  if (!data) {
    users.value = [];
  } else {
    users.value = data;
  }
});

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

store.on((_: any, name: string, data: string) => {
  console.log("store.on", name, data);
  if (name === "twitchChannelName") {
    channel.value = data;
    twitchClient.value?.disconnect();
    twitchClient.value = connectToTwitchChat(
      channel.value,
      users,
      twitchCount,
      twitchClaimedCount
    );
  }
  if (name === "handle") {
    handle.value = data;
  }
});

const filteredUsers = computed<Entry[]>(() => {
  const filter = filterText.value.toLowerCase();
  const filters = users.value
    .filter((user) => user.text.toLowerCase().includes(filter))
    .sort((a, b) => b.weight - a.weight);
  console.log("filters", filters);

  return filters;
});

const resetWheelRequests = () => {
  twitchCount.value = 0;
  twitchClaimedCount.value = 0;
  youtubeCount.value = 0;
  youtubeClaimedCount.value = 0;
};

const resetClaims = () => {
  contextData.resetClaims();
};

const incrementChances = (user: Entry) => {
  user.weight = (user.weight || 0) + 1;
  contextData.updateWheelUser({ ...user });
};

const decrementChances = (user: Entry) => {
  user.weight = Math.max((user.weight || 0) - 1, 0);
  if (user.weight === 0) {
    contextData.removeWheelUser(user.text);
  } else {
    contextData.updateWheelUser({ ...user });
  }
};

const openWheelWindow = async () => {
  await window.electronAPI.openWheelWindow();
  window.electronAPI.setDefaults();
};

const youtubeCheckStatus = async () => {
  await ipcRenderer.invoke("youtube-check-status");
};
</script>

<template>
  <button @click="openWheelWindow">Open Wheel</button>
  <!-- watermark style text at the top left of the channel value -->

  <div class="channel-name">
    <!-- Twitch Section -->
    <div class="channel-section">
      <label for="channel-name">Twitch Channel</label>
      <div v-if="!channel" class="hint">(Set channel in App menu dropdown)</div>
      <div v-else>
        {{ channel }}<span v-if="channel" class="check-mark">✔️</span>
      </div>
    </div>

    <!-- YouTube Section -->
    <div class="youtube-section">
      <label for="youtube-channel">YouTube Channel</label>
      <div v-if="!handle" class="hint">(Set channel in App menu dropdown)</div>
      <div v-else>
        {{ handle }}<span v-if="isLiveBroadCast" class="check-mark">✔️</span>

        <button
          @click="youtubeCheckStatus"
          :class="`youtube-button ${
            searching ? 'youtube-button-searching' : ''
          } ${isLiveBroadCast ? 'hide' : ''}`"
        >
          {{ searching ? "Waiting..." : "Check Status" }}
        </button>
      </div>
    </div>
  </div>

  <!-- Update component -->
  <Updater />
  <!-- button top right of screen with red background for reset -->
  <div class="container">
    <button @click="resetClaims" class="resetClaimed">Reset !here</button>

    <div class="container">
      <div class="flex-center">
        <div style="margin: 10px">Twitch !wheel: {{ twitchCount }}</div>
        <div style="margin: 10px">Twitch !here: {{ twitchClaimedCount }}</div>
      </div>
      <div class="flex-center">
      <div style="margin: 10px">YouTube !wheel: {{ youtubeCount }}</div>
      <div style="margin: 10px">YouTube !here: {{ youtubeClaimedCount }}</div>
      </div>  
    </div>
    <button @click="resetWheelRequests" class="resetCount">Reset Count</button>
    <br />
    <br />

    <!-- Add Button with two input fields one for name and the other for chances the add button will add the name and chances to the wheelofname users -->
    <input
      style="margin: 15px"
      v-model="newUser"
      placeholder="Enter the name"
    />
    <input
      style="margin: 15px"
      v-model="newChances"
      placeholder="Enter the chances"
      @input="newChances = newChances.replace(/\D/g, '')"
    />
    <button
      :class="{
        addViewer: newUser && newChances,
        disabled: !newUser || !newChances,
      }"
      style="margin: 15px"
      @click="addUser"
    >
      Add Viewer
    </button>

    <div style="display: flex; align-items: center">
      <input
        class="search"
        v-model="filterText"
        placeholder="Filter users by name"
      />
      <button class="clear" @click="filterText = ''">✖</button>
    </div>
    <br />
    <br />
    <!-- <input v-on:blur="updateChannel" v-model="channel" placeholder="Enter the channel to join" /> -->
    <!-- map over the wheelUsers object to display in a grid pattern with buttons to remove from the object -->
    <div class="grid">
      <div v-for="user in filteredUsers" :key="user.text">
        <div
          class="userList"
          v-if="(user && user.weight > 0) || filterText"
          :class="{ new: !user.claimedHere, here: user.claimedHere }"
        >
          <button class="subbtn" @click="decrementChances(user)">➖</button>
          <div class="name" @click="contextData.removeWheelUser(user.text)">
            {{ user.text }}
            <div>{{ user.weight }}</div>
          </div>
          <button class="addbtn" @click="incrementChances(user)">➕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* class="flex-center" style="position: absolute; top: 0; right: 0; background-color: red; color: white; border: none; cursor: pointer; padding: 5px 12px; margin: 10px; font-size: 14px;" */
.resetClaimed {
  position: absolute;
  top: 0;
  right: 0;
  background-color: red;
  color: white;
  border: none;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none; /* Prevent text selection */
}

.resetCount {
  /* position: absolute;
  top: 0;
  right: 100; */
  background-color: blue;
  color: white;
  border: none;
  cursor: pointer;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none; /* Prevent text selection */
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
  user-select: none; /* Prevent text selection */
}

.check-mark {
  margin-left: 0.2em;
  color: green;
}

.youtube-button {
  background-color: #ff0000; /* YouTube red */
  opacity: 0.8;
  border: 1px solid white;
  color: white;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  margin-left: auto;
  margin-right: auto;
  height: 2em;
  text-align: center;
  justify-content: center;
  user-select: none; /* Prevent text selection */
}

.youtube-button-searching {
  animation: pulse 2s infinite;
}

.youtube-button:hover {
  background-color: #cc0000; /* Darker red on hover */
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
  user-select: none; /* Prevent text selection */
}

.disabled {
  background-color: #ccc;
  color: #666;
  opacity: 0.5;
  cursor: not-allowed;
  padding: 5px 12px;
  margin: 10px;
  font-size: 14px;
  user-select: none; /* Prevent text selection */
}

.container {
  margin-top: 0;
  user-select: none; /* Prevent text selection */
}

.channel-name {
  position: absolute;
  top: 0px;
  left: 0;
  color: white;
  margin: 5px;
  font-size: 16px;
  opacity: 0.5;
  user-select: none; /* Prevent text selection */
  text-align: left;
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
