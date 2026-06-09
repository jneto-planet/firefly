// src/main/index.ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import { registerFireflyIpc } from "./ipc-firefly";
import { AppUpdater } from "./updater";

const isDev = !app.isPackaged;

/** macOS 26+ (Tahoe) / optional ENV kill-switch for GPU quirks */
function applyMacWorkarounds() {
  try {
    const isMac = process.platform === "darwin";
    const major = parseInt((process.getSystemVersion?.() || "0").split(".")[0] || "0", 10);

    // Manual toggle: FIREFLY_DISABLE_GPU=1 npm run dev
    const disableByEnv = process.env.FIREFLY_DISABLE_GPU === "1";

    if ((isMac && major >= 26) || disableByEnv) {
      app.disableHardwareAcceleration();
      app.commandLine.appendSwitch("disable-gpu-compositing");
      // If you still hit issues later, you can also try:
      // app.commandLine.appendSwitch("in-process-gpu");
    }
  } catch {
    // ignore; never crash on version parsing
  }
}

applyMacWorkarounds();

// Set app name early, before app is ready
app.setName("Firefly");
console.log(`[main] App name set to: "${app.getName()}"`);

// ---------- Preload path (dev vs prod) ----------
const preloadPath = isDev
  ? path.join(process.cwd(), "out/preload/index.js")
  : path.join(__dirname, "../preload/index.js");

// ---------- electron-vite globals (types) ----------
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// ---------- Create the main window ----------
function createWindow() {
  // Set up icon path - use absolute path from project root
  const iconPath = isDev 
    ? path.join(process.cwd(), "src/renderer/src/assets/icons/firefly.png")
    : path.join(__dirname, "../renderer/assets/icons/firefly.png");
    
  console.log(`[main] Icon path: ${iconPath}`);
  console.log(`[main] Icon exists: ${fs.existsSync(iconPath)}`);
  
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Firefly",
    icon: iconPath,
    backgroundColor: "#08121A", // solid bg: safer on new macOS
    frame: false, // Remove the default title bar
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', // macOS specific styling
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // IMPORTANT: allow Node in preload while keeping renderer isolated
      sandbox: false,
      preload: preloadPath,
    },
  });

  // Load renderer (electron-vite)
  if (isDev) {
    // In development, use the Vite dev server
    const devServerUrl = 'http://localhost:5173';
    win.loadURL(devServerUrl);
    // During debugging, detached DevTools tends to be more stable:
    // win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Fallback for production or when running without dev server
    const rendererPath = isDev 
      ? path.join(process.cwd(), "out/renderer/index.html")
      : path.join(__dirname, `../renderer/${typeof MAIN_WINDOW_VITE_NAME !== 'undefined' ? MAIN_WINDOW_VITE_NAME : 'index'}/index.html`);
    
    win.loadFile(rendererPath).catch(err => {
      console.error('Failed to load renderer:', err);
      // If that fails, try a simple fallback
      win.loadFile(path.join(__dirname, "../renderer/index.html")).catch(fallbackErr => {
        console.error('Fallback renderer load also failed:', fallbackErr);
      });
    });
  }
}

// ---------- App lifecycle ----------
app.whenReady().then(() => {
  // Set app name for dock/taskbar
  app.setName("Firefly");
  
  // Set dock icon explicitly on macOS
  if (process.platform === 'darwin') {
    const dockIconPath = isDev 
      ? path.join(process.cwd(), "src/renderer/src/assets/icons/firefly.png")
      : path.join(__dirname, "../renderer/assets/icons/firefly.png");
    
    if (fs.existsSync(dockIconPath)) {
      app.dock?.setIcon(dockIconPath);
      console.log(`[main] Dock icon set to: ${dockIconPath}`);
    }
    
    // Try to force update the dock label
    app.dock?.show();
  }
  
  // Register IPC handlers
  registerFireflyIpc();
  
  // Initialize auto-updater (only in production)
  if (!isDev) {
    new AppUpdater();
    console.log('[main] Auto-updater initialized');
  } else {
    console.log('[main] Auto-updater disabled in development mode');
  }
  
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Main-thread block detector (logs if event loop stalls >200ms)
  // Disabled for now as it seems to be causing performance issues itself
  /*
  try {
    const h = monitorEventLoopDelay({ resolution: 20 });
    h.enable();
    setInterval(() => {
      const p95 = Number(h.percentile(95).toFixed(0));
      if (p95 > 200) {
        console.warn(`[main] event loop delay p95=${p95}ms — something is blocking the main thread`);
      }
      h.reset();
    }, 2000);
  } catch {
    // perf_hooks may not be available in some environments; ignore
  }
  */
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------- Crash/async logging ----------
process.on("uncaughtException", (e) => {
  console.error("[uncaughtException]", e);
});
process.on("unhandledRejection", (e) => {
  console.error("[unhandledRejection]", e);
});
