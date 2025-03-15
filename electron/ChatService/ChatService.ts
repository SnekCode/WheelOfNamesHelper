// Intent of this service is to provide a centralized service for chat related operations
// Youtube and Twitch Chat Services utilize this service to determine what chat commands are available

import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { Entry } from 'Shared/types';
import { win, dataManager } from '../main/main';
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
            entry = entries.find((entry: Entry) => {
                if (entry.channelId) {
                    return entry.channelId === channelId;
                }
            });
            const here = entry ? true : false;

            if (entry && !entry.claimedHere) {
                entry = {
                    text: displayname,
                    channelId,
                    claimedHere: true,
                    weight: entry.weight * 2,
                    enabled: true,
                    message: channelId,
                    service
                };
                dataManager.handleAddUpdateWheelUser({} as IpcMainEvent, entry);
            }else {
                entry = {
                    text: displayname,
                    channelId,
                    claimedHere: true,
                    weight: entry ? entry.weight : 1,
                    enabled: true,
                    message: channelId,
                    service
                };
                dataManager.handleAddUpdateWheelUser({} as IpcMainInvokeEvent, entry);
            }
            updateCounts(service, 'add', here ? 'here' : 'wheel');
            break;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // ~        HERE CASE         ~
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

        case EChatCommand.HERE:
            handleChatCommand(EChatCommand.WHEEL, displayname, channelId, service, chatCallBackFn);
            break;

        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // ~        REMOVE CASE       ~
        // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

        case EChatCommand.REMOVE:
            // remove command should hide user from wheel
            entry = entries.find((entry: Entry) => {
                if (entry.channelId) {
                    return entry.channelId === channelId;
                }
            });
            if(entry) {
                entry.enabled = false
                dataManager.handleAddUpdateWheelUser({} as IpcMainEvent, entry);
            }
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

            if (!userEntry || !userEntry.enabled) {
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
            dataManager.handleAddUpdateWheelUser({} as IpcMainEvent, userEntry, false);
            break;
            default:
                break;
    }
};
