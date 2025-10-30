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
      }>;
      setConfig: (cfg: Partial<{
        dir_3cxml: string;
        scrcpy_dir: string;
        auto_open_scrcpy: boolean;
        device_display_mode?: "NAME" | "ID" | "NAME + ID";
      }>) => Promise<boolean>;

      // --- Files / XML ---
      listXml: (dir: string) => Promise<{ name: string; path: string }[]>;
      revealInFileManager: (p: string) => Promise<void>;
      openDefault: (p: string) => Promise<void>;
      openWith: (p: string) => Promise<void>;

      // --- Devices / ADB ---
      listDevices: () => Promise<{ serial: string; name: string; online: boolean }[]>;
      getDeviceProps: (
        serial: string
      ) => Promise<{ model?: string; manufacturer?: string }>;
      deleteOldCccFiles: (args: any) => Promise<any>;
      pushAndReplace: (args: any) => Promise<{ how: string }>;
      restartApp: (pkg: string) => Promise<boolean>;
      launchScrcpy: (args: any) => Promise<boolean>;
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
