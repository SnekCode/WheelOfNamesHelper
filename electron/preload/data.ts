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
    recordWinner(id: string) {
        return ipcRenderer.invoke('recordWinner', id);
    },
    handleDiscordWinner(entry: Entry) {
        return ipcRenderer.invoke('discord_winner', entry);
    }
};

let initializedWheel: Element | null = null;
let spinPending = false;

// set up a ipc on the renderer side to listen for a message and execute a function on recieve
ipcRenderer.on('initListeners', async (event, value) => {
    console.log('initListeners');
    // const wheel = document.querySelector("#parentDiv");
    const wheel = document.querySelector('canvas');
    if (!wheel || wheel === initializedWheel) return;
    initializedWheel = wheel;
    console.log(wheel);

    // remove unwanted elements from the page
    document.querySelector('#q-app > div > div.q-page-container > div:nth-child(2) > div')?.remove();

    window.addEventListener('blur', (e) => {
        window.data.saveConfig();
    });

    wheel.addEventListener('click', () => {
        if (spinPending) return;
        spinPending = true;
        window.data.setPause(true);
        // grab from the local storage key LastWheelConfig and grab the value for spin time
        const lastWheelConfig = localStorage.getItem('LastWheelGroup');
        const config = lastWheelConfig ? JSON.parse(lastWheelConfig).wheelConfigs[0] : undefined;
        const spinTime = config?.spinTime ?? 10;

        setTimeout(() => {
            spinPending = false;
            const dialog = document.querySelector('[role="dialog"]');
            const buttons = Array.from(dialog?.querySelectorAll('button') ?? []);
            const findButton = (label: string) => buttons.find(button => button.textContent?.trim() === label);
            const closeButton = findButton('Close');
            const removeButton = findButton('Remove');
            const hideButton = findButton('Hide');
            if (closeButton) (closeButton.querySelector('.q-btn__content .block') ?? closeButton).textContent = 'Cancel';
            if (removeButton) (removeButton.querySelector('.q-btn__content .block') ?? removeButton).textContent = 'Winner';

            const messageBox = dialog?.querySelector('.text-h6');
            const entries: Entry[] = config?.entries ?? [];
            const result = messageBox?.textContent?.trim();
            const name = dialog?.querySelector('.text-h5, .text-h4, h2, h3')?.textContent?.trim();
            const entry = entries.find(entry => result && result === (entry.channelId ?? entry.id))
                ?? entries.find(entry => !entry.channelId && (entry.text === name || entry.text === result));

            if (entry) {
                const id = entry.channelId ?? entry.text;
                const elapsed = entry.timestamp ? Math.max(0, Math.floor((Date.now() - entry.timestamp) / 1000)) : undefined;

                if (messageBox) {
                    messageBox.textContent = elapsed === undefined
                        ? 'Last Seen: Unknown'
                        : `Last Seen: ${Math.floor(elapsed / 60)} Minutes and ${elapsed % 60}s ago${entry.service ? ` on ${entry.service}` : ''}`;
                }

                dialog?.addEventListener('click', () => {
                    window.data.setPause(false);
                }, { once: true });

                hideButton?.addEventListener('click', () => {
                    window.data.hideSelected(id);
                }, { once: true });

                removeButton?.addEventListener('click', () => {
                    void window.data.recordWinner(id)
                        .then((confirmed: boolean | undefined) => {
                            if (confirmed && entry.service === Service.Discord) {
                                return window.data.handleDiscordWinner(entry);
                            }
                        })
                        .catch((error: unknown) => console.error('Unable to confirm wheel winner', error));
                }, { once: true });
            } else {
                window.data.setPause(false);
            }
        }, spinTime * 1000 + 100);
    });
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
    div.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    div.style.borderRadius = '10px';
    div.style.padding = '10px';
    div.style.margin = '10px';
    div.style.fontFamily = 'Arial, sans-serif';
    div.style.userSelect = 'none';
    div.style.pointerEvents = 'none';
    div.style.backdropFilter = 'blur(5px)';

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
