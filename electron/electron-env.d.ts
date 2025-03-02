/// <reference types="vite-plugin-electron/electron-env" />

import { WheelUser } from '~/Shared/types'

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true'
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬ dist-electron
     * │ ├─┬ main
     * │ │ └── index.js    > Electron-Main
     * │ └─┬ preload
     * │   └── index.mjs   > Preload-Scripts
     * ├─┬ dist
     * │ └── index.html    > Electron-Renderer
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

export interface IWinStore {
  getStore: <K extends IStoreKeys>(name: K) => IStore[K];
  setStore: <K extends IStoreKeys>(name: K, data: IStore[K]) => void;
  on: <K extends IStoreKeys>(
    listener: (event: Electron.IpcRendererEvent, name: IStore[K], data) => void
  ) => void;
}

export interface IElectronAPI {
  openWheelWindow: () => void;
  setLocalStorage: (key: string, value: any) => void;
  getLocalStorage: (key: string) => any;

}

export interface IContextDataAPI {
    setDefaults: () => void;
    resetClaims: () => void;
    removeNotClaimed: () => void;
    addUpdateWheelUser: (user: Entry, override: boolean) => void;
    removeWheelUser: (name: string) => void;
    forceUpdate: () => void;
    updateActivity: (displayName: string, channelId: string) => void;
}

export interface IDataAPI {
  setPause: (bool:boolean) => void;
  syncWithWheel: () => void;
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import("electron").IpcRenderer;
  store: IWinStore;
  electronAPI: IElectronAPI;
  contextData: IContextDataAPI
  data: IDataAPI
}