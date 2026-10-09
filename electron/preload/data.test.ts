import { ipcRenderer } from 'electron';
import { Service } from '~/Shared/enums';

jest.mock('electron', () => ({ ipcRenderer: { on: jest.fn(), invoke: jest.fn() } }));

describe('Wheel winner dialog Discord movement', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it.each([true, false, undefined])('requests movement for a winner with mobile status %s', async (mobile) => {
        jest.resetModules();
        jest.mocked(ipcRenderer.invoke).mockClear();
        jest.mocked(ipcRenderer.on).mockClear();
        jest.useFakeTimers();
        let onSpin: () => void = () => undefined;
        const messageBox = { textContent: 'winner-1' };
        const winner = {
            id: 'winner-1', channelId: 'winner-1', text: 'Viewer',
            timestamp: Date.now(), service: Service.Discord, mobile,
        };
        Object.defineProperty(globalThis, 'window', {
            configurable: true, value: { addEventListener: jest.fn(), location: { href: 'test' } },
        });
        Object.defineProperty(globalThis, 'document', {
            configurable: true, value: {
                querySelector: jest.fn((selector) => selector === 'canvas'
                    ? { addEventListener: (_event: string, handler: () => void) => { onSpin = handler; } }
                    : selector === '.text-h6' ? messageBox : null),
                querySelectorAll: jest.fn().mockReturnValue([]),
            },
        });
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true, value: { getItem: () => JSON.stringify({
                wheelConfigs: [{ entries: [winner], spinTime: 1 }],
            }) },
        });
        const { ipcRenderer: renderer } = require('electron');
        require('./data');
        const init = jest.mocked(renderer.on).mock.calls.find((call: any) => call[0] === 'initListeners')![1] as any;
        await init({}, undefined);
        onSpin();
        jest.advanceTimersByTime(1100);
        expect(renderer.invoke).toHaveBeenCalledWith('discord_winner', winner);
        expect(messageBox.textContent).not.toMatch(/Desktop|Mobile/);
    });
});
