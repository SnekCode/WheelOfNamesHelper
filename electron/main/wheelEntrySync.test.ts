import { WheelEntrySync } from './wheelEntrySync';
import type { Entry } from '../../Shared/types';

const entry = (text: string): Entry => ({ text, weight: 2, claimedHere: true, channelId: text });

describe('live wheel entry synchronization', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const target = () => ({
    isDestroyed: () => false,
    getURL: () => 'https://wheelofnames.com/',
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
  });

  it('sends only the latest burst with an explicit origin and intact entry metadata', async () => {
    const sync = new WheelEntrySync();
    const wheel = target();
    sync.attach(wheel);
    sync.update([entry('old')]);
    const latest = [entry("O'Reilly ${name}\n雪")];
    sync.update(latest);
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript).toHaveBeenCalledTimes(1);
    const postMessage = jest.fn();
    new Function('window', wheel.executeJavaScript.mock.calls[0][0])({ postMessage });
    expect(postMessage).toHaveBeenCalledWith({ name: 'setEntries', entries: latest }, 'https://wheelofnames.com');
  });

  it('retains updates until the page is ready and sends an empty list to clear it', async () => {
    const sync = new WheelEntrySync();
    const wheel = target();
    sync.update([entry('waiting')]);
    await jest.advanceTimersByTimeAsync(50);
    expect(wheel.executeJavaScript).not.toHaveBeenCalled();
    sync.update([]);
    sync.attach(wheel);
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript.mock.calls[0][0]).toContain('"entries":[]');
  });

  it('holds changes during a spin and flushes the latest snapshot on resume', async () => {
    const sync = new WheelEntrySync();
    const wheel = target();
    sync.attach(wheel);
    sync.setPaused(true);
    sync.update([entry('during spin')]);
    await jest.advanceTimersByTimeAsync(50);
    expect(wheel.executeJavaScript).not.toHaveBeenCalled();
    sync.update([entry('latest')]);
    sync.setPaused(false);
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(wheel.executeJavaScript.mock.calls[0][0]).toContain('latest');
  });

  it('does not send entries to a page outside Wheel of Names', async () => {
    const sync = new WheelEntrySync();
    const wheel = { ...target(), getURL: () => 'https://example.com/' };
    sync.update([entry('private')]);
    sync.attach(wheel);
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript).not.toHaveBeenCalled();
  });

  it('serializes updates and sends changes received while a delivery is pending', async () => {
    const sync = new WheelEntrySync();
    let finish: () => void = () => undefined;
    const wheel = target();
    wheel.executeJavaScript.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    sync.attach(wheel);
    sync.update([entry('first')]);
    await jest.advanceTimersByTimeAsync(25);
    sync.update([entry('second')]);
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript).toHaveBeenCalledTimes(1);
    finish();
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript).toHaveBeenCalledTimes(2);
    expect(wheel.executeJavaScript.mock.calls[1][0]).toContain('second');
  });
});
