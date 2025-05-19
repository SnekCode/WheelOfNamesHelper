import { log } from 'console';
import { ipcRenderer } from 'electron';
import { Service } from '~/Shared/enums';
import { Entry } from '~/Shared/types';

console.log('data.ts loaded');

// data context to extend handles from data.ts
window.data = {
    setPause(value: boolean) {
        return ipcRenderer.invoke('setPause', value);
    },
    saveConfig() {
        return ipcRenderer.invoke('saveConfig');
    },
    hideSelected(id: string) {
        return ipcRenderer.invoke('hideSelected', id);
    },
    removeSelected(id: string) {
        return ipcRenderer.invoke('removeSelected', id);
    },
    handleDiscordWinner(entry: Entry) {
        return ipcRenderer.invoke('discord_winner', entry);
    },
    forceUpdate() {
        return ipcRenderer.invoke('forceUpdate');
    }
};

// set up a ipc on the renderer side to listen for a message and execute a function on recieve
ipcRenderer.on('initListeners', async (event, value) => {
    console.log('initListeners');
    // const wheel = document.querySelector("#parentDiv");
    const wheel = document.querySelector('canvas');
    console.log(wheel);

    document.querySelector('.text-h6')?.setAttribute("class", "text-h7");

    window.addEventListener('blur', (e) => {
        window.data.saveConfig();
    });

    wheel?.addEventListener('click', () => {
        window.data.setPause(true);
        // grab from the local storage key LastWheelConfig and grab the value for spin time
        const lastWheelConfig = localStorage.getItem('LastWheelConfig');
        const spinTime = lastWheelConfig ? JSON.parse(lastWheelConfig).spinTime : 10;

        setTimeout(() => {
            // // get element with class "text-h6"
            //document.querySelector("#q-portal--dialog--3 > div > div.q-dialog__inner.flex.no-pointer-events.q-dialog__inner--minimized.q-dialog__inner--standard.fixed-full.flex-center > div > div.q-card__section.q-card__section--vert.flex.gap.justify-between > div")
            
            const messageBox = document.querySelector('.text-h6');
            console.log(messageBox);

            let id = '';
            // return;
            if (messageBox) {
                // // get text and convert to date time
                const currentTime = Date.now();
                console.log({ currentTime });

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

                if (entry?.service === Service.Discord && entry?.mobile === false) {
                    console.log('Discord Winner');
                    // auto move
                    window.data.handleDiscordWinner(entry);
                }

                // if NAN set to 0
                if (isNaN(minutes) || isNaN(seconds)) {
                    messageBox.textContent = `Not sure if they are here...`;
                } else {
                    messageBox.textContent = `Last Seen: ${minutes} Minutes and ${seconds}s ago ${
                        entry.service ? `on ${entry.service}` : ''
                    }`;
                }

                if (entry.service === Service.Discord) {
                    messageBox.textContent = `${messageBox.textContent} - ${entry?.mobile ? 'Mobile' : 'Desktop'}`;
                }

                // find button with text "Remove"
                const removeButton = Array.from(document.querySelectorAll('button')).find(
                    (btn) => btn.textContent?.trim() === 'Remove'
                );
                const hideButton = Array.from(document.querySelectorAll('button')).find(
                    (btn) => btn.textContent?.trim() === 'Hide'
                );
                const closeButton = Array.from(document.querySelectorAll('button')).filter(
                    (btn) => btn.textContent?.trim() === 'Close'
                )[1];

                // get element of role "dialog"
                const dialog = document.querySelector('[role="dialog"]');

                console.log({ dialog });
                

                if (closeButton) {
                    closeButton.setAttribute('style', 'display: none');
                }

                dialog?.addEventListener('click', (e) => {
                    console.log('Dialog Clicked');
                    window.data.setPause(false);
                    window.data.forceUpdate();
                });
                    

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
            }
        }, spinTime * 1000 + 100);
    });
});

ipcRenderer.on('reload', () => {
    location.reload();
});

ipcRenderer.on('setDefaults', async () => {
    const data = JSON.parse(localStorage.getItem('LastWheelConfig') || '{}');
    const entries = await ipcRenderer.invoke('getStore', 'entries');
    localStorage.setItem(
        'LastWheelConfig',
        JSON.stringify({
            ...data,
            isAdvanced: true,
            entries,
        })
    );

    window.data.saveConfig();
});

// create a new element in the dom
// size to to fit content
// position absolute to the top left

let interval: NodeJS.Timeout;

function helperText() {
    if (!window.location.href.includes('wheelofnames')) return;

    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.top = '50px';
    div.style.left = '0px';
    div.style.zIndex = '1000';
    div.style.color = 'white';

    // add text to the div
    const containerDiv = document.createElement('div');
    // left padding
    containerDiv.style.paddingLeft = '20px';

    const header = document.createElement('div');
    header.textContent = 'Commands:';
    header.style.fontSize = '20px';
    const contentLine2 = document.createTextNode('!wheel   --  to join the wheel and double odds if first time');
    const contentLine4 = document.createTextNode('!remove  --  to remove yourself from the wheel');
    const contentLine5 = document.createTextNode('!odds    --  to see your odds of winning');

    const array = [contentLine2, contentLine4, contentLine5];

    div.appendChild(header);
    array.forEach((el) => {
        containerDiv.appendChild(el);
        containerDiv.appendChild(document.createElement('br'));
    });

    div.appendChild(containerDiv);

    interval = setInterval(() => {
        const editButton = document.querySelector(
            '#q-app > div > div.q-page-container > div.page-content > div.left-column > div > div.row.items-center.q-gutter-x-md > button'
        );
        if (!editButton) return;
        document.body.appendChild(div);
        editButton?.setAttribute('style', 'opacity: 0');
        clearInterval(interval);
    }, 50);
}

let reShowInterval: NodeJS.Timeout;
// on dom ready
window.addEventListener('DOMContentLoaded', () => {
    console.log('page loaded');

    // hiding things from the page
    // div with class name preload-toolbar
    const toHide = document.body;
    toHide?.setAttribute('style', 'opacity: 0');

    // check for preload-static-content id element to no longer exist
    reShowInterval = setInterval(() => {
        const staticContent = document.getElementById('preload-static-content');
        if (staticContent) {
            staticContent.style.opacity = '0';
            staticContent.style.display = 'none';
        } else {
            clearInterval(reShowInterval);
            toHide?.setAttribute('style', 'opacity: 1');
        }
    }, 50);
});

helperText();
