<!-- 
 
A pop up banner that is shown when a update is available via the IPC. Exposes buttons to update now or later 
using Vue3 composition API. 
-->

<script setup lang="ts">
import { ref } from 'vue'
import { EChannels } from '../../Shared/channels';
import {version} from '../../package.json'
// import { ipcRenderer } from 'electron'
// use window to avoid errors in the browser

const { ipcRenderer } = window


const updateAvailable = ref(false)
const newVersion = ref('unknown')

ipcRenderer.on(EChannels.updateAvailable, (_, bool) => {
  updateAvailable.value = bool
})

ipcRenderer.on(EChannels.updateInfo, (_, version) => {
  newVersion.value = version
})

const updateNow = () => {
  ipcRenderer.send('update', true)
}

const updateLater = () => {
  updateAvailable.value = false
  ipcRenderer.send('update', false)
}

</script>

<template>
  <div v-if="updateAvailable" class="updater">
    <div class="updater__content">
        <!-- current version -->
      <p class="updater__content__text">Version <b>{{ newVersion }}</b> is available. You are currently on Version <b>{{ version }}</b>. </p> 
      <p class="updater__content__text">Do you want to update now?</p>
      <div class="updater__content__buttons">
        <button @click="updateNow" class="updater__content__buttons__update">Update now</button>
        <button @click="updateLater" class="updater__content__buttons__later">Later</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.updater {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #f8f9fa;
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.updater__content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.updater__content__text {
  font-size: 1.2rem;
  margin-bottom: 10px;
  color: black
}

.updater__content__buttons {
  display: flex;
}

.updater__content__buttons__update {
  background-color: #007bff;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  margin-right: 10px;
}

.updater__content__buttons__later {
  background-color: #6c757d;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
}


</style>