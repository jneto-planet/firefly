// src/renderer/src/types/index.d.ts
export {};

declare global {
  interface Window {
    firefly: {
      // --- Config ---
      getConfig: () => Promise<{
        dir_3cxml: string;
        scrcpy_dir: string;
        auto_open_scrcpy: boolean;
        device_display_mode?: "NAME" | "ID" | "NAME + ID";
        xml_editor_path?: string;
        clear_tid_from_datastore?: boolean;
        polling_enabled?: boolean;
        polling_interval?: number;
        butterfly_path?: string;
      }>;
      setConfig: (cfg: Partial<{
        dir_3cxml: string;
        scrcpy_dir: string;
        auto_open_scrcpy: boolean;
        device_display_mode?: "NAME" | "ID" | "NAME + ID";
        xml_editor_path?: string;
        clear_tid_from_datastore?: boolean;
        polling_enabled?: boolean;
        polling_interval?: number;
        butterfly_path?: string;
      }>) => Promise<boolean>;

      // --- Files / XML ---
      pickDirectory: (initialPath?: string) => Promise<string | null>;
      pickFile: (options?: { title?: string; defaultPath?: string; fileType?: 'executable' | 'any' }) => Promise<string | null>;
      listXml: (dir: string) => Promise<{ name: string; path: string; type: 'file' | 'folder' }[]>;
      revealInFileManager: (p: string) => Promise<void>;
      openDefault: (p: string) => Promise<void>;
      openWith: (p: string) => Promise<void>;
      getDefaultXmlEditor: () => Promise<string>;

      // --- Devices / ADB ---
      listDevices: () => Promise<{ serial: string; name: string; online: boolean }[]>;
      getDeviceProps: (
        serial: string
      ) => Promise<{ 
        model?: string; 
        manufacturer?: string;
        ipAddress?: string | null;
        batteryLevel?: number | null;
        isCharging?: boolean;
        androidVersion?: string | null;
      }>;
      deleteOldCccFiles: (args: any) => Promise<any>;
      pushAndReplace: (args: any) => Promise<{ how: string }>;
      restartApp: (pkg: string) => Promise<boolean>;
      pullXmlFromDevice: (args: { pkg: string; relTarget: string; serial: string; defaultSavePath: string }) => Promise<{ success: boolean; message: string; savePath?: string; filePath?: string; canceled?: boolean }>;
      clearTidFromDataStore: (args: { pkg: string; serial: string }) => Promise<{ success: boolean; message: string }>;
      launchScrcpy: (args: any) => Promise<boolean>;
      openButterfly: () => Promise<boolean>;
      takeScreenshot: (args: { serial: string }) => Promise<string>;
      saveScreenshot: (args: { base64Data: string; deviceName: string }) => Promise<string | null>;
      startScreenRecording: (args: { serial: string }) => Promise<{ success: boolean; recordingPath?: string; message?: string }>;
      stopScreenRecording: (args: { serial: string; recordingPath: string }) => Promise<{ success: boolean; filePath?: string; message?: string; canceled?: boolean }>;
      isRecording: (args: { serial: string }) => Promise<boolean>;

      // --- Window Controls ---
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;

      // --- Auto-updater ---
      checkForUpdates: () => Promise<any>;
      getAppVersion: () => Promise<string>;
      installUpdate: () => Promise<void>;

      // --- ADB Diagnostics ---
      testAdb: () => Promise<any>;

      // --- Scrcpy Diagnostics ---
      testScrcpy: (scrcpyPath: string) => Promise<any>;
      detectScrcpy: () => Promise<any>;

      // --- Custom Tool Paths ---
      setCustomAdbPath: (adbPath: string) => Promise<void>;
      setCustomScrcpyPath: (scrcpyPath: string) => Promise<void>;

      // --- Logcat ---
      startLogcat: (args: { serial: string; packageName?: string }) => Promise<any>;
      clearLogcat: (args: { serial: string }) => Promise<void>;
      getLogcatSnapshot: (args: { serial: string; packageName?: string; maxLines?: number }) => Promise<any>;

      // --- Video Generator ---
      pickImages: () => Promise<string[]>;
      pickSaveLocation: (defaultName: string) => Promise<string | null>;
      generateVideo: (options: {
        images: string[];
        delay: number;
        terminal: "PAX" | "VIPA";
        width: number;
        height: number;
        outputPath: string;
      }) => Promise<any>;

      // --- Event listeners ---
      onScrcpyClosed: (callback: (data: { serial: string }) => void) => () => void;
    };

    electron: {
      versions: {
        electron: string;
        node: string;
        chromium: string;
        v8: string;
      };
    };
  }
}
