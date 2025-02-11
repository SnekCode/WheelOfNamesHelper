// Intent of this service is to provide a centralized service for chat related operations
// Youtube and Twitch Chat Services utilize this service to determine what chat commands are available

import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { handleAddWheelUser, handleRemoveWheelUser, handleUpdateActivity, handleUpdateWheelUser } from '../data/data';
import { Entry } from 'Shared/types';
import { win } from '../main/main';
import { store } from '../main/store';
import { EChatCommand, Service } from 'Shared/enums';


const updateCounts = (service: Service, type: "add" | "remove", resource: "count" | "here" | "wheel") => {
    win?.webContents.send(`${service}-${type}-${resource}`);
};


export const handleIPCMainChatCommand = async (
    _: IpcMainInvokeEvent,
    message: string,
    displayname: string,
    channelId: string,
    service: Service
) => {
    console.log('handleIPCMainChatCommand', message, displayname, channelId, service);
    const chatCallBackFn = (message: string) => {
        setTimeout(() => {
        console.log('chatCallBackFn', message);
        }, 500);
    };
        
    handleChatCommand(message, displayname, channelId, service, chatCallBackFn);
    return true;
};

ipcMain.handle("chatService", handleIPCMainChatCommand);


export const handleChatCommand = async (
    message: string,
    displayname: string,
    channelId: string,
    service: Service,
    chatCallBackFn: (message: string) => void
) => {
    let entry: Entry | undefined;
    const entries = store.get('entries', []);
    switch (message.toLowerCase()) {
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // ~        WHEEL CASE        ~
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

        case EChatCommand.WHEEL:
            entry = {
                text: displayname,
                channelId,
                claimedHere: true,
                weight: 1,
                enabled: true,
                message: channelId,
                service
            };
            const success = handleAddWheelUser({} as IpcMainInvokeEvent, entry, false);
            if (success) updateCounts(service, 'add', 'wheel');
            break;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // ~        HERE CASE         ~
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

        case EChatCommand.HERE:
            if (entries.length === 0) {
                return;
            }

            entry = entries.find((entry: Entry) => {
                if (entry.channelId) {
                    return entry.channelId === channelId;
                } else {
                    return entry.text === displayname;
                }
            });

            if (entry && !entry.claimedHere) {
                entry.claimedHere = true;
                entry.weight = entry.weight * 2;
                entry['service'] = service;
                entry.enabled = true;
                handleUpdateWheelUser({} as IpcMainEvent, entry);
                updateCounts(service, "add", "here");
            } else {
                handleUpdateActivity({} as IpcMainEvent, displayname, channelId, service);
            }
            break;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // ~        REMOVE CASE       ~
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

        case EChatCommand.REMOVE:
            // TODO update remove function to take channel ID
            handleRemoveWheelUser({} as IpcMainEvent, displayname);
            break;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // ~        ODDS CASE         ~
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

        case EChatCommand.ODDS:
            const weightTotal = entries.reduce((acc: number, entry: Entry) => {
                return acc + entry.weight;
            }, 0);

            const userEntry = entries.find((entry: Entry) => {
                return entry.channelId === channelId || entry.text === displayname;
            });

            if (!userEntry) {
                chatCallBackFn(`@${displayname} you have not entered the wheel yet with !wheel`);
                return;
            }

            const odds = (userEntry.weight / weightTotal) * 100;
            const pluralizeY = userEntry.weight > 1 ? 'ies' : 'y';
            let oddsMessage = `@${displayname} your odds of winning are ${odds.toFixed(2)}% and you have ${userEntry.weight} entr${pluralizeY}`;

            // check for user claimed here
            if (!userEntry.claimedHere) {
                oddsMessage += ` you can double your odds by typing !here`;
            }

            chatCallBackFn(oddsMessage);
            handleUpdateActivity({} as IpcMainEvent, displayname, channelId, service);
            break;
            default:
                handleUpdateActivity({} as IpcMainEvent, displayname, channelId, service);
                break;
    }
};
