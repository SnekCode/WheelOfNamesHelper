import router from "@/router"

window.ipcRenderer.on('main-process-message', (_event, ...args) => {
  console.log('[Receive Main-process message]:', ...args)
})

window.ipcRenderer.on('message', (_event, ...args) => {
  console.log('[Receive Message]:', ...args)
})

window.ipcRenderer.on('navigate', (_event, data) => {
  console.log('[Receive Navigate]:', data)
  router.push(data)
})