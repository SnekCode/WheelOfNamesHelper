import type { Entry } from '../../Shared/types';

interface WheelTarget {
  isDestroyed(): boolean;
  getURL(): string;
  executeJavaScript(script: string): Promise<unknown>;
}

// Keep the latest snapshot while loading, spinning, or sending an earlier update.
export class WheelEntrySync {
  private target: WheelTarget | null = null;
  private entries: Entry[] = [];
  private paused = false;
  private dirty = false;
  private sending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  public attach(target: WheelTarget | null) {
    this.target = target;
    this.dirty = true;
    this.schedule();
  }

  public update(entries: Entry[]) {
    this.entries = entries.map(entry => ({ ...entry }));
    this.dirty = true;
    this.schedule();
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    this.schedule();
  }

  private schedule() {
    if (this.timer || this.sending || this.paused || !this.target || !this.dirty) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, 25);
  }

  private async flush() {
    const target = this.target;
    if (!target || target.isDestroyed() || this.paused || !this.dirty) return;
    if (new URL(target.getURL()).origin !== 'https://wheelofnames.com') return;
    this.sending = true;
    this.dirty = false;
    try {
      const message = JSON.stringify({ name: 'setEntries', entries: this.entries });
      await target.executeJavaScript(`window.postMessage(${message}, 'https://wheelofnames.com');`);
    } catch (error) {
      // A navigation can destroy the execution context. The next attach/update retries.
      this.dirty = true;
      console.error('Unable to update wheel entries', error);
      this.sending = false;
      return;
    }
    this.sending = false;
    this.schedule();
  }
}

export const wheelEntrySync = new WheelEntrySync();
