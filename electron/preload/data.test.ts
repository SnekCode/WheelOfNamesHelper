import { ipcRenderer } from 'electron';
import { Service } from '~/Shared/enums';

jest.mock('electron', () => ({ ipcRenderer: { on: jest.fn(), invoke: jest.fn() } }));

describe('Wheel winner dialog', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it.each([
        { service: Service.Discord, mobile: true, result: 'winner-1', name: 'Viewer', expectedId: 'winner-1' },
        { service: Service.Discord, mobile: false, result: 'winner-1', name: 'Viewer', expectedId: 'winner-1' },
        { service: Service.Discord, mobile: undefined, result: 'winner-1', name: 'Viewer', expectedId: 'winner-1' },
        { service: Service.Twitch, result: undefined, name: 'Bob25U', expectedId: 'Bob25U' },
        { service: Service.YouTube, result: 'wheel-generated-id', name: 'Charlie726T', expectedId: 'Charlie726T' },
    ])('records $name on $service with result $result', async ({ service, mobile, result, name, expectedId }) => {
        jest.resetModules();
        jest.mocked(ipcRenderer.invoke).mockClear();
        jest.mocked(ipcRenderer.on).mockClear();
        jest.useFakeTimers();
        let onSpin: () => void = () => undefined;
        const messageBox = result === undefined ? null : { textContent: result };
        const winner = {
            id: 'wheel-generated-id', text: name, service,
            ...(service === Service.Discord ? { channelId: 'winner-1', timestamp: Date.now(), mobile } : {}),
        };
        const closeButton = { textContent: 'Close', querySelector: jest.fn(), addEventListener: jest.fn() };
        const removeButton = { textContent: 'Remove', querySelector: jest.fn(), addEventListener: jest.fn() };
        const dialog = {
            querySelectorAll: () => [closeButton, removeButton],
            querySelector: (selector: string) => selector === '.text-h6' ? messageBox : { textContent: name },
            addEventListener: jest.fn(),
        };
        Object.defineProperty(globalThis, 'window', {
            configurable: true, value: { addEventListener: jest.fn(), location: { href: 'test' } },
        });
        Object.defineProperty(globalThis, 'document', {
            configurable: true, value: {
                querySelector: jest.fn((selector) => selector === 'canvas'
                    ? { addEventListener: (_event: string, handler: () => void) => { onSpin = handler; } }
                    : selector === '[role="dialog"]' ? dialog : null),
                querySelectorAll: jest.fn().mockReturnValue([]),
            },
        });
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true, value: { getItem: () => JSON.stringify({
                wheelConfigs: [{ entries: [winner], spinTime: 1 }],
            }) },
        });
        const { ipcRenderer: renderer } = require('electron') as typeof import('electron');
        jest.mocked(renderer.invoke).mockResolvedValue(true);
        require('./data');
        const init = jest.mocked(renderer.on).mock.calls.find((call: any) => call[0] === 'initListeners')![1] as any;
        await init({}, undefined);
        onSpin();
        onSpin();
        jest.advanceTimersByTime(1100);
        expect(closeButton.textContent).toBe('Cancel');
        expect(removeButton.textContent).toBe('Winner');
        expect(renderer.invoke).not.toHaveBeenCalledWith('recordWinner', expectedId);
        if (service === Service.Discord) {
            expect(renderer.invoke).not.toHaveBeenCalledWith('discord_winner', winner);
        }
        removeButton.addEventListener.mock.calls[0][1]();
        await Promise.resolve();
        expect(jest.mocked(renderer.invoke).mock.calls.filter(([channel]) => channel === 'recordWinner'))
            .toEqual([['recordWinner', expectedId]]);
        if (service === Service.Discord) {
            expect(renderer.invoke).toHaveBeenCalledWith('discord_winner', winner);
            expect(messageBox?.textContent).not.toMatch(/Desktop|Mobile/);
        } else if (messageBox) {
            expect(messageBox.textContent).toBe('Last Seen: Unknown');
        }
    });
});
