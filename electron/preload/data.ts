import { contextBridge, ipcRenderer } from "electron";
import { Entry } from "~/Shared/types";

console.log("data.ts loaded");

// data context to extend handles from data.ts
window.data = {
    setPause(value: boolean) {
        return ipcRenderer.invoke("setPause", value);
    },
    syncWithWheel() {
    return ipcRenderer.invoke("syncWithWheel");
  },
};

// set up a ipc on the renderer side to listen for a message and execute a function on recieve
ipcRenderer.on("initListeners", async (event, value) => {
    console.log("initListeners");
    const wheel = document.querySelector("#parentDiv");
    
    wheel?.addEventListener("click", () => {
      window.data.setPause(true);
      // grab from the local storage key LastWheelConfig and grab the value for spin time
        const lastWheelConfig = localStorage.getItem("LastWheelConfig");
        const spinTime = lastWheelConfig ? JSON.parse(lastWheelConfig).spinTime : 10;

        
            setTimeout(() => {
                const regex = /^q-portal--dialog--\d+$/;
                const elements = document.querySelectorAll("[id]");
    
                const targetElement = Array.from(elements).find(element => regex.test(element.id));
                targetElement?.addEventListener("click", () => {                    
                    window.data.setPause(false);
                });
            }, spinTime * 1000 + 100);
        });
    });

    ipcRenderer.on("reload", () => {
        location.reload();
    });

    ipcRenderer.on("setDefaults", async () => {
    
        const data = JSON.parse(localStorage.getItem("LastWheelConfig") || "{}");
        const entries = await ipcRenderer.invoke("getStore", "entries");

        localStorage.setItem("LastWheelConfig", JSON.stringify({
            ...data,
            entries
        }));

})