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

interface UpdateProgress {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

const { ipcRenderer } = window


const updateAvailable = ref(false)
const newVersion = ref('unknown')
const downloadProgress = ref(0)
const bytesPerSecond = ref("0")
const timeRemaining = ref<TimeRemaining>({
  hours: 0,
  minutes: 0,
  seconds: 0
})


function calculateTimeRemaining(data: UpdateProgress): TimeRemaining {
  const total = data.total;
  const delta = data.delta;

  // Calculate remaining data to be transferred
  const remaining = total - delta;

  // Assuming bytesPerSecond is provided in the data object
  const bytesPerSecond = data.bytesPerSecond;

  // Calculate time remaining in seconds
  const timeRemainingSeconds = remaining / bytesPerSecond;

  // Convert time to a more readable format (hours, minutes, seconds)
  const hours = Math.floor(timeRemainingSeconds / 3600);
  const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
  const seconds = Math.floor(timeRemainingSeconds % 60);

  return {
    hours: hours,
    minutes: minutes,
    seconds: seconds
  };
}

ipcRenderer.on(EChannels.updateAvailable, (_, bool) => {
  updateAvailable.value = bool
})

ipcRenderer.on(EChannels.updateInfo, (_, version) => {
  newVersion.value = version
})

ipcRenderer.on(EChannels.updateDownloadProgress, (_, progress: UpdateProgress) => {
  downloadProgress.value = progress.percent
  bytesPerSecond.value = (progress.bytesPerSecond / (1024 * 1024)).toFixed(2); // Convert to MB/s
  timeRemaining.value = calculateTimeRemaining(progress)
})

const updateNow = () => {
  ipcRenderer.send('update', true)
}

const updateLater = () => {
  updateAvailable.value = false
  ipcRenderer.send('update', false)
}

const skip = () => {
  updateAvailable.value = false
}

</script>

<template>
  <div v-if="updateAvailable" class="updater">
    <div v-if="downloadProgress === 0" class="updater__content">
      <!-- current version -->
      <p class="updater__content__text">Version <b>{{ newVersion }}</b> is available. You are currently on Version <b>{{
          version }}</b>. </p>
      <p class="updater__content__text">Do you want to update now?</p>
      <div class="updater__content__buttons">
        <button @click="updateNow" class="updater__content__buttons__update">Update now</button>
        <button @click="updateLater" class="updater__content__buttons__later">Update Later</button>
        <button @click="skip" class="updater__content__buttons__skip">Skip for Now</button>
      </div>
    </div>
    <div v-else class="updater__content__progress">
      <p class="updater__content__text">Download Speed: {{ bytesPerSecond }} MB/s</p>
      <p class="updater__content__text">
        Time Remaining: 
        <span v-if="timeRemaining.hours !== 0">{{ timeRemaining.hours }} hours </span>
        <span v-if="timeRemaining.minutes !== 0">{{ timeRemaining.minutes }} minutes </span>
        <span>{{ timeRemaining.seconds }} seconds</span>
      </p>
      <div class="progress-bar">
        <div class="progress-bar__fill" :style="{ width: downloadProgress + '%' }">
          <span class="progress-bar__text">{{ downloadProgress.toFixed(2) }}%</span>
        </div>
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
  /* padding: 10px; */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
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
  padding: 10px;
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
  margin-right: 10px;
}

.updater__content__buttons__skip {
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  margin-right: 10px;
}

.updater__content__progress {
  width: 100%;
  text-align: center;
}

.progress-bar {
  margin-left: 20px;
  margin-right: 20px;
  margin-bottom: 10px;
  height: 30px;
  background-color: #e9ecef;
  border-radius: 5px;
  overflow: hidden;
  position: relative;
}

.progress-bar__fill {
  height: 100%;
  background-color: #007bff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  transition: width 0.4s ease;
}

.progress-bar__text {
  position: absolute;
  width: 100%;
  text-align: center;
  color: white;
}

</style>