// src/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("firefly", {
  getConfig: () => ipcRenderer.invoke("firefly:get-config"),
  setConfig: (cfg: any) => ipcRenderer.invoke("firefly:set-config", cfg),

    pickDirectory: (initialPath?: string) => ipcRenderer.invoke("firefly:pick-directory", initialPath),
    pickFile: (options?: { title?: string; defaultPath?: string; fileType?: 'executable' | 'any' }) => ipcRenderer.invoke("firefly:pick-file", options),
  listXml: (dir: string) => ipcRenderer.invoke("firefly:list-xml", dir),
  revealInFileManager: (p: string) => ipcRenderer.invoke("firefly:reveal", p),
  openDefault: (p: string) => ipcRenderer.invoke("firefly:open-default", p),
  openWith: (p: string) => ipcRenderer.invoke("firefly:open-with", p),

  listDevices: () => ipcRenderer.invoke("firefly:list-devices"),
  getDeviceProps: (serial: string) => ipcRenderer.invoke("firefly:get-device-props", serial),

  deleteOldCccFiles: (args: any) => ipcRenderer.invoke("firefly:delete-old", args),
  pushAndReplace: (args: any) => ipcRenderer.invoke("firefly:push-replace", args),
  restartApp: (pkg: string) => ipcRenderer.invoke("firefly:restart", pkg),
  launchScrcpy: (args: any) => ipcRenderer.invoke("firefly:launch-scrcpy", args),

    windowMinimize: () => ipcRenderer.invoke("firefly:window-minimize"),
    windowMaximize: () => ipcRenderer.invoke("firefly:window-maximize"),
    windowClose: () => ipcRenderer.invoke("firefly:window-close"),
    windowIsMaximized: () => ipcRenderer.invoke("firefly:window-is-maximized"),
    
    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke("firefly:check-for-updates"),
    getAppVersion: () => ipcRenderer.invoke("firefly:get-app-version"),
    installUpdate: () => ipcRenderer.invoke("firefly:install-update"),
    
    // ADB Diagnostics
    testAdb: () => ipcRenderer.invoke("firefly:test-adb"),
    
    // Scrcpy Diagnostics
    testScrcpy: (scrcpyPath: string) => ipcRenderer.invoke("firefly:test-scrcpy", scrcpyPath),
    detectScrcpy: () => ipcRenderer.invoke("firefly:detect-scrcpy"),
    
    // Custom Tool Paths
    setCustomAdbPath: (adbPath: string) => ipcRenderer.invoke("firefly:set-custom-adb-path", adbPath),
    setCustomScrcpyPath: (scrcpyPath: string) => ipcRenderer.invoke("firefly:set-custom-scrcpy-path", scrcpyPath),
    
    // Logcat
    startLogcat: (args: { serial: string; packageName?: string }) => ipcRenderer.invoke("firefly:start-logcat", args),
    clearLogcat: (args: { serial: string }) => ipcRenderer.invoke("firefly:clear-logcat", args),
    getLogcatSnapshot: (args: { serial: string; packageName?: string; maxLines?: number }) => ipcRenderer.invoke("firefly:get-logcat-snapshot", args),
});

contextBridge.exposeInMainWorld("electron", {
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chromium: process.versions.chrome,
    v8: process.versions.v8,
  },
});
