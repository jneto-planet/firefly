// src/preload/index.ts
import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("firefly", {
  getConfig: () => ipcRenderer.invoke("firefly:get-config"),
  setConfig: (cfg: any) => ipcRenderer.invoke("firefly:set-config", cfg),

    pickDirectory: (initialPath?: string) => ipcRenderer.invoke("firefly:pick-directory", initialPath),
    pickFile: (options?: { title?: string; defaultPath?: string; fileType?: 'executable' | 'zip' | 'any' }) => ipcRenderer.invoke("firefly:pick-file", options),
  listXml: (dir: string) => ipcRenderer.invoke("firefly:list-xml", dir),
  revealInFileManager: (p: string) => ipcRenderer.invoke("firefly:reveal", p),
  openDefault: (p: string) => ipcRenderer.invoke("firefly:open-default", p),
  openWith: (p: string) => ipcRenderer.invoke("firefly:open-with", p),
  getDefaultXmlEditor: () => ipcRenderer.invoke("firefly:get-default-xml-editor"),

  listDevices: () => ipcRenderer.invoke("firefly:list-devices"),
  getDeviceProps: (serial: string) => ipcRenderer.invoke("firefly:get-device-props", serial),

  deleteOldCccFiles: (args: any) => ipcRenderer.invoke("firefly:delete-old", args),
  pushAndReplace: (args: any) => ipcRenderer.invoke("firefly:push-replace", args),
  restartApp: (args: { pkg: string; serial: string }) => ipcRenderer.invoke("firefly:restart", args),
  pullXmlFromDevice: (args: { pkg: string; relTarget: string; serial: string; defaultSavePath: string }) => ipcRenderer.invoke("firefly:pull-xml-from-device", args),
  clearTidFromDataStore: (args: { pkg: string; serial: string }) => ipcRenderer.invoke("firefly:clear-tid-from-datastore", args),
  launchScrcpy: (args: any) => ipcRenderer.invoke("firefly:launch-scrcpy", args),
  openButterfly: () => ipcRenderer.invoke("firefly:open-butterfly"),
  openProxyTool: () => ipcRenderer.invoke("firefly:open-proxy-tool"),
  openOpiSimulator: () => ipcRenderer.invoke("firefly:open-opi-simulator"),
  openLoggerClient: (args?: { ip?: string; port?: string; pattern?: string }) => ipcRenderer.invoke("firefly:open-logger-client", args),
  takeScreenshot: (args: { serial: string }) => ipcRenderer.invoke("firefly:take-screenshot", args),
  saveScreenshot: (args: { base64Data: string; deviceName: string }) => ipcRenderer.invoke("firefly:save-screenshot", args),
  startScreenRecording: (args: { serial: string }) => ipcRenderer.invoke("firefly:start-screen-recording", args),
  stopScreenRecording: (args: { serial: string; recordingPath: string }) => ipcRenderer.invoke("firefly:stop-screen-recording", args),
  isRecording: (args: { serial: string }) => ipcRenderer.invoke("firefly:is-recording", args),

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
    
    // Video Generator
    pickImages: () => ipcRenderer.invoke("firefly:pick-images"),
    pickSaveLocation: (defaultName: string) => ipcRenderer.invoke("firefly:pick-save-location", defaultName),
    generateVideo: (options: {
      images: string[];
      delay: number;
      terminal: "PAX" | "VIPA";
      width: number;
      height: number;
      outputPath: string;
    }) => ipcRenderer.invoke("firefly:generate-video", options),
    
    // Accessibility Converter
    pickAccessibilityImages: () => ipcRenderer.invoke("firefly:pick-accessibility-images"),
    pickAccessibilityOutputDir: () => ipcRenderer.invoke("firefly:pick-accessibility-output-dir"),
    readImageAsDataUrl: (filePath: string) => ipcRenderer.invoke("firefly:read-image-as-data-url", filePath),
    saveAccessibilityImage: (args: { originalPath: string; base64Data: string; suffix: string; outputDir: string }) => ipcRenderer.invoke("firefly:save-accessibility-image", args),

    // Apps
    listApps: (args: { serial: string; thirdPartyOnly: boolean }) => ipcRenderer.invoke("firefly:list-apps", args),
    uninstallApp: (args: { serial: string; packageName: string }) => ipcRenderer.invoke("firefly:uninstall-app", args),
    installApp: (args: { serial: string; apkPath: string; allowDowngrade?: boolean; packageName?: string }) => ipcRenderer.invoke("firefly:install-app", args),
    checkApkVersion: (args: { serial: string; apkPath: string }) => ipcRenderer.invoke("firefly:check-apk-version", args),

    // Firmware
    validateFirmware: (args: { zipPath: string }) => ipcRenderer.invoke("firefly:firmware-validate", args),
    verifyFirmwareMd5: (args: { apkPath: string; expectedMd5?: string }) => ipcRenderer.invoke("firefly:firmware-verify-md5", args),
    firmwareRebootWait: (args: { serial: string; timeoutMs?: number }) => ipcRenderer.invoke("firefly:firmware-reboot-wait", args),
    firmwareCleanup: (args: { tempDir: string }) => ipcRenderer.invoke("firefly:firmware-cleanup", args),
    // Resolve an absolute filesystem path from a dropped File (Electron webUtils)
    getPathForFile: (file: File) => webUtils.getPathForFile(file),

    // Event listeners
    onScrcpyClosed: (callback: (data: { serial: string }) => void) => {
      const listener = (_event: any, data: { serial: string }) => callback(data);
      ipcRenderer.on("firefly:scrcpy-closed", listener);
      return () => ipcRenderer.removeListener("firefly:scrcpy-closed", listener);
    },
});

contextBridge.exposeInMainWorld("electron", {
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chromium: process.versions.chrome,
    v8: process.versions.v8,
  },
});
