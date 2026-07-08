import { Entry } from "../../Shared/types";
import { DataManager } from "./data";
import { Service } from "~/Shared/enums";
import { store } from "../main/store";
import { IpcMainInvokeEvent } from "electron";
import { wheelWindow } from "../main/wheelOfNames";
import { StoreKeys } from "~/Shared/store";

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
    const event = {} as IpcMainInvokeEvent;

    const buildEntry = (overrides: Partial<Entry> = {}): Entry => ({
        text: 'test',
        weight: 1,
        claimedHere: false,
        channelId: '123',
        service: Service.Twitch,
        ...overrides,
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        store.clear();

        // Default wheel mock supports saveConfig's new LastWheelGroup/wheelConfigs format.
        // @ts-expect-error mocked method
        jest.spyOn(wheelWindow?.webContents, 'executeJavaScript').mockImplementation(async (script: string) => {
            if (script.includes("localStorage.getItem('LastWheelGroup')")) {
                return JSON.stringify({ wheelConfigs: [{ spinTime: 10, entries: [] }] });
            }
            return undefined;
        });
    });

    it('should add user to store', () => {
        jest.spyOn(Date, 'now').mockReturnValue(1234);

        const entry = buildEntry();
        const dataManager = new DataManager();
        dataManager.handleAddUpdateWheelUser(event, entry, false);

        const storeData = store.get(StoreKeys.data, []);
        expect(storeData.length).toBe(1);
        const storeEntry = storeData[0];
        expect(storeEntry.timestamp).toEqual(1234);
    });

    it('should update user to store', () => {
        jest.spyOn(Date, 'now').mockReturnValue(1234);

        const entry = buildEntry({ weight: 2, enabled: false });

        store.set(StoreKeys.data, [entry]);

        const dataManager = new DataManager();
        dataManager.handleAddUpdateWheelUser(event, entry, false);

        const storeData = store.get(StoreKeys.data, []);
        expect(storeData.length).toBe(1);
        const storeEntry = storeData[0];
        expect(storeEntry.timestamp).toEqual(1234);
    });

    it('should remove user from store', () => {
        const entry: Entry = {
            id: '123',
            text: 'test',
            weight: 1,
            claimedHere: false,
            channelId: '123',
            service: Service.Twitch
        };
        store.set(StoreKeys.data, [entry]);

        const dataManager = new DataManager();
        dataManager.handleRemoveWheelUser(event, entry.id!);

        const storeData = store.get(StoreKeys.data, []);
        expect(storeData.length).toBe(0);
    });

    it('should flush queued entries when pause is disabled', () => {
        const entry1 = buildEntry({ text: 'test1', channelId: '123' });
        const entry2 = buildEntry({ text: 'test2', channelId: '321' });

        const dataManager = new DataManager();
        dataManager.pause = true;

        dataManager.handleAddUpdateWheelUser(event, entry1);
        dataManager.handleAddUpdateWheelUser(event, entry2);

        const storeData = store.get(StoreKeys.data, []);
        expect(storeData.length).toBe(0);
        expect(dataManager.addQueue.length).toBe(2);

        dataManager.setPause(event, false);

        const storeData2 = store.get(StoreKeys.data, []);
        expect(storeData2.length).toBe(2);
    });

});
