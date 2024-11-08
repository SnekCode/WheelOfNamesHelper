import { createApp } from 'vue'
import App from './App.vue'
import packageJson from "../package.json";

import './style.css'

import './demos/ipc'

const { ipcRenderer } = window;

// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

createApp(App)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })

  // Update the window title
document.title = `Wheel Of Names Helper - v${packageJson.version}`;