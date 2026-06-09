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
        proxy_tool_path?: string;
        opi_simulator_path?: string;
        logger_client_path?: string;
        logger_client_send_params?: boolean;
        recording_bit_rate?: number;
        recording_resolution?: number;
        recording_show_taps?: boolean;
        recording_save_path?: string;
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
        proxy_tool_path?: string;
        opi_simulator_path?: string;
        logger_client_path?: string;
        logger_client_send_params?: boolean;
        recording_bit_rate?: number;
        recording_resolution?: number;
        recording_show_taps?: boolean;
        recording_save_path?: string;
      }>) => Promise<boolean>;

      // --- Files / XML ---
      pickDirectory: (initialPath?: string) => Promise<string | null>;
      pickFile: (options?: { title?: string; defaultPath?: string; fileType?: 'executable' | 'zip' | 'any' }) => Promise<string | null>;
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
      restartApp: (args: { pkg: string; serial: string }) => Promise<boolean>;
      pullXmlFromDevice: (args: { pkg: string; relTarget: string; serial: string; defaultSavePath: string }) => Promise<{ success: boolean; message: string; savePath?: string; filePath?: string; canceled?: boolean }>;
      clearTidFromDataStore: (args: { pkg: string; serial: string }) => Promise<{ success: boolean; message: string }>;
      launchScrcpy: (args: any) => Promise<boolean>;
      openButterfly: () => Promise<boolean>;
      openProxyTool: () => Promise<boolean>;
      openOpiSimulator: () => Promise<boolean>;
      openLoggerClient: (args?: { ip?: string; port?: string; pattern?: string }) => Promise<boolean>;
      takeScreenshot: (args: { serial: string }) => Promise<string>;
      saveScreenshot: (args: { base64Data: string; deviceName: string }) => Promise<string | null>;
      startScreenRecording: (args: { serial: string; bitRate: number; resolution: number; showTaps: boolean }) => Promise<{ success: boolean; recordingPath?: string; sdkVersion?: number; timeLimitInfo?: string; message?: string }>;
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

      // --- Accessibility Converter ---
      pickAccessibilityImages: () => Promise<string[]>;
      pickAccessibilityOutputDir: () => Promise<string | null>;
      readImageAsDataUrl: (filePath: string) => Promise<string>;
      saveAccessibilityImage: (args: { originalPath: string; base64Data: string; suffix: string; outputDir: string }) => Promise<{ success: boolean; outputPath: string }>;

      // --- Apps ---
      listApps: (args: { serial: string; thirdPartyOnly: boolean }) => Promise<{
        success: boolean;
        apps: Array<{ package: string; version: string; displayName: string; iconDataUrl: string | null }>;
        error?: string;
      }>;
      uninstallApp: (args: { serial: string; packageName: string }) => Promise<{ success: boolean; message: string }>;
      installApp: (args: { serial: string; apkPath: string; allowDowngrade?: boolean; packageName?: string }) => Promise<{ success: boolean; message: string }>;
      checkApkVersion: (args: { serial: string; apkPath: string }) => Promise<{
        success: boolean;
        error?: string;
        package?: string;
        apkVersionCode?: number | null;
        apkVersionName?: string | null;
        installed?: boolean;
        installedVersionCode?: number | null;
        installedVersionName?: string | null;
        isDowngrade?: boolean;
      }>;

      // --- Firmware ---
      validateFirmware: (args: { zipPath: string }) => Promise<{
        success: boolean;
        error?: string;
        label?: string;
        tempDir?: string;
        bundles?: Array<{ filename: string; order: number; md5: string | null; reboot: boolean; apkPath: string }>;
      }>;
      verifyFirmwareMd5: (args: { apkPath: string; expectedMd5?: string }) => Promise<{ success: boolean; match: boolean; actual: string; error?: string }>;
      firmwareRebootWait: (args: { serial: string; timeoutMs?: number }) => Promise<{ success: boolean; error?: string }>;
      firmwareCleanup: (args: { tempDir: string }) => Promise<{ success: boolean }>;
      getPathForFile: (file: File) => string;

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
