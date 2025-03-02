import { Entry } from "../../Shared/types";
import { DataManager } from "./data";
import { Service } from "~/Shared/enums";
import { store } from "../main/store";
import { IpcMainInvokeEvent } from "electron";
import { wheelWindow } from "../main/wheelOfNames";

// mock electron
jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn()
    },
    webContents: {
        send: jest.fn()
    }
  }));


// mock electron/main/wheelOfNames.ts
jest.mock('../main/wheelOfNames', () => ({
    wheelWindow: {
        webContents: {
            send: jest.fn(),
            executeJavaScript: jest.fn()
        }
    }
    }));

// mock main/mian.ts
jest.mock('../main/main', () => ({
    win: {
        webContents: {
            send: jest.fn()
        }
    }
  }));

jest.mock('../main/store')

describe('data tests', () => {

    it('should add user to store', () => {
        //(alias) handleAddWheelUser(_: Electron.CrossProcessExports.IpcMainInvokeEvent, entry: Entry, override?: boolean): boolean
        // mock out Date.now() to return a fixed value
        jest.spyOn(Date, 'now').mockReturnValue(1234);
        
        const event = {} as IpcMainInvokeEvent
        const entry: Entry = {
            text: 'test',
            weight: 1,
            claimedHere: false,
            channelId: '123',
            service: Service.Twitch
         };
        const dataManager = new DataManager();
        const override = false;
        dataManager.handleAddUpdateWheelUser(event, entry, override);

        const storeData = store.get('entries', []);
        expect(storeData.length).toBe(1);
        const storeEntry = storeData[0];
        expect(storeEntry.timestamp).toEqual(1234);
    });

    it('should update user to store', () => {
        //(alias) handleAddWheelUser(_: Electron.CrossProcessExports.IpcMainInvokeEvent, entry: Entry, override?: boolean): boolean
        // mock out Date.now() to return a fixed value
        jest.spyOn(Date, 'now').mockReturnValue(1234);
        
        const event = {} as IpcMainInvokeEvent
        const entry: Entry = {
            text: 'test',
            weight: 2,
            claimedHere: false,
            channelId: '123',
            service: Service.Twitch,
            enabled: false,
         };

        // add entry to store
        store.set('entries', [entry]);

        const dataManager = new DataManager();
        const override = false;
        dataManager.handleAddUpdateWheelUser(event, entry, override);

        const storeData = store.get('entries', []);
        expect(storeData.length).toBe(1);
        const storeEntry = storeData[0];
        expect(storeEntry.timestamp).toEqual(1234);
    });

    it('should remove user from store', () => {
        const event = {} as IpcMainInvokeEvent
        const entry: Entry = {
            text: 'test',
            weight: 1,
            claimedHere: false,
            channelId: '123',
            service: Service.Twitch
         };
         store.set('entries', [entry]);
        const dataManager = new DataManager();
        dataManager.handleRemoveWheelUser(event, entry.text);

        const storeData = store.get('entries', []);
        expect(storeData.length).toBe(0);
    });

    it('test add que', () => {
        // given a dataManager
        // when pause is true
        // all entries should be added to the que
        // then when pause is false
        // all entries should be added to the store

        // return empty json array when wheelWindow.webContents.executeJavaScript is called
        // @ts-expect-error mock
        jest.spyOn(wheelWindow?.webContents, 'executeJavaScript').mockResolvedValue('[]');

        const event = {} as IpcMainInvokeEvent
        const entry1: Entry = {
            text: 'test1',
            weight: 1,
            claimedHere: false,
            channelId: '123',
            service: Service.Twitch
         };
        const entry2: Entry = {
            text: 'test2',
            weight: 1,
            claimedHere: false,
            channelId: '321',
            service: Service.Twitch
        };
        const dataManager = new DataManager();
        dataManager.pause = true;
        dataManager.handleAddUpdateWheelUser(event, entry1);
        dataManager.handleAddUpdateWheelUser(event, entry2);
        const storeData = store.get('entries', []);
        expect(storeData.length).toBe(0);
        expect(dataManager.addQueue.length).toBe(2);
        dataManager.setPause(event, false);
        const storeData2 = store.get('entries', []);
        expect(storeData2.length).toBe(2);
    })

});
