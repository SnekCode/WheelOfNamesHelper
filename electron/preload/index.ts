import { ipcRenderer, contextBridge } from 'electron'
import { EChannels } from '~/Shared/channels';
import { IStore, IStoreKeys } from '~/Shared/store'
import { Entry } from '~/Shared/types';

import "./data";

console.log('preload loaded');


// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    console.log("on", args);

    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    console.log("off", args);

    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    console.log("send", args);

    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    console.log("invoke", args);

    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});

contextBridge.exposeInMainWorld("store", {
  getStore<K extends IStoreKeys>(name: K) {
    return ipcRenderer.invoke('getStore', name) as Promise<IStore[K]>
  },
  setStore<K extends IStoreKeys>(name: K, data: IStore[K]) {
    return ipcRenderer.invoke('setStore', name, data)
  },
  on<K extends IStoreKeys>(listener: (event: Electron.IpcRendererEvent, name: K, data: IStore[K]) => void) {
    return ipcRenderer.on(EChannels.storeUpdate, listener)
  }
});

contextBridge.exposeInMainWorld("contextData", {
  resetClaims() {
    return ipcRenderer.invoke("resetClaims");
  },
  updateWheelUser(user: Entry) {
    return ipcRenderer.invoke("updateWheelUser", user);
  },
  addWheelUser(user: Entry, override: boolean) {
    return ipcRenderer.invoke("addWheelUser", user, override);
  },
  removeWheelUser(name: string) {
    return ipcRenderer.invoke("removeWheelUser", name);
  },
  syncWithWheel() {
    return ipcRenderer.invoke("syncWithWheel");
  },
  forceUpdate() {
    return ipcRenderer.invoke("forceUpdate");
  },
  saveConfig() {
    return ipcRenderer.invoke("saveConfig");
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  openWheelWindow: () => ipcRenderer.invoke("open-wheel-window"),
  setLocalStorage: (key: string, value: string) =>
    ipcRenderer.invoke("set-local-storage", key, value),
  getLocalStorage: (key: string) => ipcRenderer.invoke("get-local-storage", key),
  setDefaults: () => ipcRenderer.invoke("setDefaults"),
});

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
  .ad-declaration{
    display: none !important;
    color: red;
    }
    `;
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)
