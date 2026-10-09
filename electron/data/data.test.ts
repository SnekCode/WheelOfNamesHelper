import { Entry } from "../../Shared/types";
import { DataManager, setStore } from "./data";
import { wheelEntrySync } from "../main/wheelEntrySync";
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

    it('publishes bulk edits and winner changes through the shared live API path', async () => {
        const update = jest.spyOn(wheelEntrySync, 'update');
        const entries = [buildEntry({ enabled: true }), buildEntry({ channelId: '456' })];
        setStore(StoreKeys.data, entries);
        expect(update).toHaveBeenLastCalledWith(entries);
        const manager = new DataManager();
        await manager.hideSelected(event, '123');
        expect(update.mock.calls.at(-1)?.[0][0].enabled).toBe(false);
        await manager.removeSelected(event, '123');
        expect(update).toHaveBeenLastCalledWith([entries[1]]);
        manager.handleResetClaims();
        expect(update.mock.calls.at(-1)?.[0][0]).toMatchObject({ claimedHere: false, enabled: false });
        manager.handleNotClaimed();
        expect(update).toHaveBeenLastCalledWith([]);
    });

    it('keeps the newest update when the same viewer joins repeatedly during a spin', async () => {
        const manager = new DataManager();
        await manager.setPause(event, true);
        await manager.handleAddUpdateWheelUser(event, buildEntry({ weight: 1 }));
        await manager.handleAddUpdateWheelUser(event, buildEntry({ weight: 4 }));
        await manager.setPause(event, false);
        expect(store.get(StoreKeys.data)).toHaveLength(1);
        expect(store.get(StoreKeys.data)[0].weight).toBe(4);
    });
});
