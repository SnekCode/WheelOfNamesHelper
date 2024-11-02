<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { getDeviceCode, pollForToken } from './TwitchService';
import { connectToTwitchChat, wheelUsers, WheelUsers, resetAllClaimedHere } from './TwitchChatService';
import Updater from './components/Updater.vue';

const channel = ref('snekcode'); // Add a ref for the channel
const count = ref(0); // Add a ref for the count
const users = ref<WheelUsers>(wheelUsers); // Add a ref for the users
const filterText = ref(''); // Add a ref for the filter text
console.log(Object.keys(users));

const copyToClipboard = () => {
  const userList = Object.keys(users.value)
    .flatMap(name => Array(users.value[name].chances).fill(name))
    .join('\n');
  navigator.clipboard.writeText(userList).then(() => {
    console.log('Copied to clipboard', userList);
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
};

const filteredUsers = computed<WheelUsers>(() => {
  const filter = filterText.value.toLowerCase();
  return Object.keys(users.value)
    .filter(name => name.toLowerCase().includes(filter))
    .sort((a, b) => users.value[b].chances - users.value[a].chances)
    .reduce((result: WheelUsers, name: string) => {
      result[name] = users.value[name];
      return result;
    }, {});
});

const incrementChances = (user: WheelUsers[keyof WheelUsers]) => {
  user.chances = (user.chances || 0) + 1;
  // user.claimedHere = true;
};

const decrementChances = (user: WheelUsers[keyof WheelUsers]) => {
  // floor to prevent negative values
  user.chances = Math.max((user.chances || 0) - 1, 0);
  // user.claimedHere = true;
};

connectToTwitchChat(channel.value, users, count );
// UC2wKfjlioOCLP4xQMOWNcgg
// connectToYouTubeChat("UC2wKfjlioOCLP4xQMOWNcgg", users, count );

</script>

<template>
  <!-- Update component -->
   <Updater />
  <!-- button top right of screen with red background for reset -->
  <button @click="resetAllClaimedHere(users)" class="reset" >New Stream</button>
  <div>Wheel Requests: {{ count }}</div>
  <button @click="copyToClipboard">Copy to Clipboard</button>
  <br />
  <br />

  <div style="display: flex; align-items: center;">
    <input class="search" v-model="filterText" placeholder="Filter users by name" />
    <button class="clear" @click="filterText = ''">✖</button>
  </div>
  <br />
  <br />
  <input v-model="channel" placeholder="Enter the channel to join" />
  <!-- map over the wheelUsers object to display in a grid pattern with buttons to remove from the object -->
  <div class="grid">
    <div v-for="(user, name) in filteredUsers" :key="name">
      <div class="userList" v-if="user && user.chances > 0 || filterText"
        :class = "{'new': !user.claimedHere, 'here': user.claimedHere }"
        >
        <button class="subbtn" @click="decrementChances(user)"> - </button>
        <div class="name" @click="user.chances = 0">
          {{ name }}
          <div>{{ user.chances }}</div>
        </div>
        <button class="addbtn" @click="incrementChances(user)"> + </button>
      </div>
    </div>
  </div>
</template>

<style>
/* class="flex-center" style="position: absolute; top: 0; right: 0; background-color: red; color: white; border: none; cursor: pointer; padding: 5px 12px; margin: 10px; font-size: 14px;" */
.reset {
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
  color: rgb(0, 0, 0);
  border: none;
  cursor: pointer;
  padding: 3px 9px;
  margin-right: 10px;
  font-size: 20px;
}

.subbtn {
  background-color: #bd332ae8;
  color: rgb(0, 0, 0);
  border: none;
  cursor: pointer;
  padding: 3px 9px;
  margin-left: 10px;
  font-size: 20px;
}

.logo.electron:hover {
  filter: drop-shadow(0 0 2em #9FEAF9);
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
