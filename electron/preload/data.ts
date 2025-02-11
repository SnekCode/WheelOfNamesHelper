import { log } from "console";
import { ipcRenderer } from "electron";
import { Entry } from "~/Shared/types";

console.log("data.ts loaded");

// data context to extend handles from data.ts
window.data = {
  setPause(value: boolean) {
    return ipcRenderer.invoke("setPause", value);
  },
  saveConfig() {
    return ipcRenderer.invoke("saveConfig");
    },
  hideSelected(id: string) {
    return ipcRenderer.invoke("hideSelected", id);
  },
  removeSelected(id: string) {
    return ipcRenderer.invoke("removeSelected", id);
  }
};

// set up a ipc on the renderer side to listen for a message and execute a function on recieve
ipcRenderer.on("initListeners", async (event, value) => {
  console.log("initListeners");
  // const wheel = document.querySelector("#parentDiv");
  const wheel = document.querySelector(
    "canvas"
  );
  console.log(wheel);
  
  window.addEventListener("blur", (e) => {
        window.data.saveConfig();
  });

  wheel?.addEventListener("click", () => {
    
    window.data.setPause(true);
    // grab from the local storage key LastWheelConfig and grab the value for spin time
    const lastWheelConfig = localStorage.getItem("LastWheelConfig");
    const spinTime = lastWheelConfig
      ? JSON.parse(lastWheelConfig).spinTime
      : 10;
    
    setTimeout(() => {
        // // get element with class "text-h6"
        const messageBox = document.querySelector('.text-h6');
        let id = '';
        if (messageBox) {
            // // get text and convert to date time
            const currentTime = Date.now();
            // get the entry from the local storage the messagebox text is the entries channelId
            id = messageBox.textContent ?? 'NO ID';
            console.log(id);

            const lastWheelConfig = localStorage.getItem('LastWheelConfig');
            const entries = lastWheelConfig ? JSON.parse(lastWheelConfig).entries : [];
            const entry: Entry = entries.find((entry: Entry) => entry.channelId === id);

            const milliseconds = entry.timestamp ?? 0;

            const differenceMilliseconds = currentTime - milliseconds;
            const differenceInSeconds = differenceMilliseconds / 1000;
            const minutes = Math.floor(differenceInSeconds / 60); // Get the minutes
            const seconds = parseInt((differenceInSeconds % 60).toFixed(0)); // Get the remaining seconds

            // if NAN set to 0
            if (isNaN(minutes) || isNaN(seconds)) {
                messageBox.textContent = `Not sure if they are here...`;
            } else {
                messageBox.textContent = `Last Seen: ${minutes} Minutes and ${seconds}s ago ${
                    entry.service ? `on ${entry.service}` : ''
                }`;
            }
        }

        // find button with text "Remove"
        const removeButton = Array.from(document.querySelectorAll('button')).find(
            (btn) => btn.textContent?.trim() === 'Remove'
        );
        const hideButton = Array.from(document.querySelectorAll('button')).find(
            (btn) => btn.textContent?.trim() === 'Hide'
        );
        const closeButton = Array.from(document.querySelectorAll('button')).find(
            (btn) => btn.textContent?.trim() === 'Hide'
        );

        hideButton?.addEventListener('click', () => {
            console.log('Hide Button Clicked');
            window.data.hideSelected(id);
            window.data.setPause(false);
            window.data.forceUpdate();
        });

        removeButton?.addEventListener('click', () => {
            console.log('Remove Button Clicked');
            window.data.removeSelected(id);
            window.data.setPause(false);
            window.data.forceUpdate();
        });

        closeButton?.addEventListener('click', () => {
            console.log('Close Button Clicked');
            window.data.setPause(false);
            window.data.forceUpdate();

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
      isAdvanced: true,
      entries
    }));

    window.data.saveConfig()
  })