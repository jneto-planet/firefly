// src/main/updater.ts
import { autoUpdater } from "electron-updater";
import { BrowserWindow, app } from "electron";

export type UpdateState = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";

export interface UpdateStatus {
  state: UpdateState;
  version: string | null;
  percent: number;
  message?: string;
}

const CHECK_DELAY_MS = 8_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let status: UpdateStatus = { state: "idle", version: null, percent: 0 };
let installWhenDownloaded = false;
let initialized = false;

function setStatus(patch: Partial<UpdateStatus>) {
  status = { ...status, ...patch };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("firefly:update-status", status);
  }
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

export function initAutoUpdater() {
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  console.log("[updater] Feed URL:", autoUpdater.getFeedURL());

  autoUpdater.on("checking-for-update", () => setStatus({ state: "checking" }));

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] Update available:", info.version);
    setStatus({ state: "available", version: info.version, percent: 0, message: undefined });
  });

  autoUpdater.on("update-not-available", () => {
    setStatus({ state: "idle", version: null, percent: 0, message: undefined });
  });

  autoUpdater.on("download-progress", (p) => {
    setStatus({ state: "downloading", percent: Math.round(p.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] Update downloaded:", info.version);
    setStatus({ state: "downloaded", version: info.version, percent: 100 });
    if (installWhenDownloaded) {
      installWhenDownloaded = false;
      // Let the status event reach the renderer before the app quits.
      setTimeout(() => autoUpdater.quitAndInstall(), 500);
    }
  });

  autoUpdater.on("error", (error) => {
    console.error("[updater] Error:", error);
    installWhenDownloaded = false;
    setStatus({ state: "error", percent: 0, message: error?.message ?? String(error) });
  });

  setTimeout(() => void checkForUpdates(), CHECK_DELAY_MS);
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) return status;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // Surfaced through the "error" event listener.
  }
  return status;
}

/** Downloads the pending update and restarts into it once ready. */
export function downloadAndInstall() {
  if (!app.isPackaged) return;

  if (status.state === "downloaded") {
    autoUpdater.quitAndInstall();
    return;
  }
  if (status.state === "downloading") return;

  installWhenDownloaded = true;
  setStatus({ state: "downloading", percent: 0, message: undefined });
  autoUpdater.downloadUpdate().catch((e) => {
    installWhenDownloaded = false;
    setStatus({ state: "error", percent: 0, message: e?.message ?? String(e) });
  });
}
