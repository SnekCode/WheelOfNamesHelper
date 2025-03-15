import { createApp } from 'vue'
import App from './App.vue'
import Discord from './pages/Discord.vue';
import packageJson from "../package.json";

import './style.css'

import './demos/ipc'
import router from './router';
import Route from './Route.vue';

const { ipcRenderer } = window;

// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

const app = createApp(Discord)
app.use(router)
app.mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })

  // Update the window title
document.title = `Wheel Of Names Helper - v${packageJson.version}`;