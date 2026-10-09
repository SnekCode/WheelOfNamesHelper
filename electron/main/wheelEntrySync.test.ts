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
  it('stops pending delivery when loading starts, then sends the latest snapshot after readiness', async () => {
    const sync = new WheelEntrySync();
    const wheel = target();
    sync.attach(wheel);
    sync.update([entry('before reload')]);
    sync.attach(null);
    await jest.advanceTimersByTimeAsync(25);
    expect(wheel.executeJavaScript).not.toHaveBeenCalled();
    sync.update([entry('during reload')]);
    sync.attach(wheel);
    await jest.advanceTimersByTimeAsync(25);
    const postMessage = jest.fn();
    new Function('window', wheel.executeJavaScript.mock.calls[0][0])({ postMessage });
    expect(postMessage).toHaveBeenCalledWith({ name: 'setEntries', entries: [entry('during reload')] }, 'https://wheelofnames.com');
  });

  it('sends retained entries only to the replacement window after closing and reopening', async () => {
    const sync = new WheelEntrySync();
    const oldWindow = target();
    const newWindow = target();
    sync.attach(oldWindow);
    sync.update([entry('retained')]);
    await jest.advanceTimersByTimeAsync(25);
    sync.attach(null);
    sync.update([entry('while closed')]);
    await jest.advanceTimersByTimeAsync(25);
    sync.attach(newWindow);
    await jest.advanceTimersByTimeAsync(25);
    expect(oldWindow.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(newWindow.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(newWindow.executeJavaScript.mock.calls[0][0]).toContain('while closed');
  });

  it('never sends to a destroyed window and recovers when a new window attaches', async () => {
    const sync = new WheelEntrySync();
    const destroyed = { ...target(), isDestroyed: () => true };
    sync.update([entry('retained')]);
    sync.attach(destroyed);
    await jest.advanceTimersByTimeAsync(25);
    expect(destroyed.executeJavaScript).not.toHaveBeenCalled();
    const replacement = target();
    sync.attach(replacement);
    await jest.advanceTimersByTimeAsync(25);
    expect(replacement.executeJavaScript.mock.calls[0][0]).toContain('retained');
  });

  it('retains a failed delivery for reattachment without repeatedly retrying the broken context', async () => {
    const sync = new WheelEntrySync();
    const wheel = target();
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      wheel.executeJavaScript.mockRejectedValueOnce(new Error('Context destroyed'));
      sync.attach(wheel);
      sync.update([entry('retry me')]);
      await jest.advanceTimersByTimeAsync(100);
      expect(wheel.executeJavaScript).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
      sync.attach(wheel);
      await jest.advanceTimersByTimeAsync(25);
      expect(wheel.executeJavaScript).toHaveBeenCalledTimes(2);
      expect(wheel.executeJavaScript.mock.calls[1][0]).toContain('retry me');
    } finally { log.mockRestore(); }
  });

  it('does not lose a replacement window attached before an old delivery rejects', async () => {
    const sync = new WheelEntrySync();
    const oldWindow = target();
    const newWindow = target();
    let fail: (error: Error) => void = () => undefined;
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      oldWindow.executeJavaScript.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
      sync.attach(oldWindow);
      sync.update([entry('old')]);
      await jest.advanceTimersByTimeAsync(25);
      sync.attach(null);
      sync.update([entry('latest')]);
      sync.attach(newWindow);
      fail(new Error('Old context destroyed'));
      await jest.advanceTimersByTimeAsync(25);
      expect(newWindow.executeJavaScript).toHaveBeenCalledTimes(1);
      expect(newWindow.executeJavaScript.mock.calls[0][0]).toContain('latest');
    } finally { log.mockRestore(); }
  });

  it('takes a snapshot so later caller mutations cannot alter the transferred data', async () => {
    const sync = new WheelEntrySync();
    const wheel = target();
    const entries = [entry('original')];
    sync.attach(wheel);
    sync.update(entries);
    entries[0].text = 'mutated';
    entries.push(entry('unexpected'));
    await jest.advanceTimersByTimeAsync(25);
    const postMessage = jest.fn();
    new Function('window', wheel.executeJavaScript.mock.calls[0][0])({ postMessage });
    expect(postMessage).toHaveBeenCalledWith({ name: 'setEntries', entries: [entry('original')] }, 'https://wheelofnames.com');
  });});
