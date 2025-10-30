// src/main/ipc-firefly.ts
import { ipcMain, BrowserWindow, dialog, shell, app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { loadConfig, saveConfig } from "./config";
import { autoUpdater } from "electron-updater";
import { adb, adbs, parseDevices } from "./adb";

export function registerFireflyIpc() {
  // --- Config ---
  ipcMain.handle("firefly:get-config", async () => loadConfig());
  ipcMain.handle("firefly:set-config", async (_e, patch) => { await saveConfig(patch); return true; });

  // --- File helpers ---
  ipcMain.handle("firefly:list-xml", async (_e, dir: string) => {
    if (!dir) return [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const result: Array<{ name: string; path: string; type: 'folder' | 'file' }> = [];
      
      // Add folders first
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          result.push({
            name: entry.name,
            path: path.join(dir, entry.name),
            type: 'folder'
          });
        }
      }
      
      // Add XML files
      for (const entry of entries) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
          result.push({
            name: entry.name,
            path: path.join(dir, entry.name),
            type: 'file'
          });
        }
      }
      
      return result;
    } catch (error) {
      console.error(`[firefly] Error listing directory ${dir}:`, error);
      return [];
    }
  });

  ipcMain.handle("firefly:reveal", async (_e, p: string) => { 
    try {
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        // If it's a directory, open it directly
        await shell.openPath(p);
      } else {
        // If it's a file, show it in its parent folder
        shell.showItemInFolder(p);
      }
    } catch (error) {
      console.error(`[firefly] Error opening path ${p}:`, error);
      // Fallback to showItemInFolder
      shell.showItemInFolder(p);
    }
  });
  ipcMain.handle("firefly:open-default", async (_e, p: string) => { await shell.openPath(p); });
  ipcMain.handle("firefly:open-with", async (_e, _p: string) => {
    await dialog.showOpenDialog({ properties: ["openFile"] }); // implement chooser logic if needed
    return true;
  });

  ipcMain.handle("firefly:pick-directory", async (_e, initialPath?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      defaultPath: initialPath,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // --- Devices ---
  ipcMain.handle("firefly:list-devices", async () => {
    console.log(`[firefly] Listing devices...`);
    const { code, out, err } = await adb("devices", "-l");
    console.log(`[firefly] Devices result: code=${code}, out="${out}", err="${err}"`);
    if (code !== 0) throw new Error(`ADB devices command failed: ${err || "Unknown error"}`);
    const devices = parseDevices(out);
    console.log(`[firefly] Parsed ${devices.length} devices:`, devices);
    return devices;
  });

  ipcMain.handle("firefly:get-device-props", async (_e, serial: string) => {
    const r1 = await adbs(serial, "shell", "getprop", "ro.product.model");
    const r2 = await adbs(serial, "shell", "getprop", "ro.product.manufacturer");
    if (r1.code !== 0) throw new Error(r1.err || "getprop model failed");
    if (r2.code !== 0) throw new Error(r2.err || "getprop manufacturer failed");
    return { model: r1.out.trim(), manufacturer: r2.out.trim() };
  });

  // --- Push/replace flow (fully async, with timeouts) ---
  ipcMain.handle("firefly:delete-old", async (_e, { pkg, serial }: { pkg: string; serial: string }) => {
    console.log(`[firefly] Deleting ONLY specific old cache files for ${pkg} on device ${serial}`);
    
    // EXTREMELY SPECIFIC: Only delete these 2 cache files, nothing else
    const baseDir = `files/appconfig/cccterminal/3cixml`;
    const file1 = `${baseDir}/cccterminal-3cixml-default.obj.gz`;
    const file2 = `${baseDir}/cccterminal-3cixml-default.md5`;
    
    // Delete file 1 (obj.gz) - ignore if doesn't exist
    let result = await adbs(serial, "shell", "run-as", pkg, "rm", "-f", file1);
    console.log(`[firefly] Delete ${file1}: code=${result.code}, out="${result.out}", err="${result.err}"`);
    
    // Delete file 2 (md5) - ignore if doesn't exist
    result = await adbs(serial, "shell", "run-as", pkg, "rm", "-f", file2);
    console.log(`[firefly] Delete ${file2}: code=${result.code}, out="${result.out}", err="${result.err}"`);
    
    console.log(`[firefly] Specific cache file deletion completed`);
    return true;
  });

  ipcMain.handle("firefly:push-replace", async (_e, args: {
    localPath: string; pkg: string; relTarget: string; sdcardTemp: string; serial: string;
  }) => {
    const { localPath, pkg, relTarget, sdcardTemp, serial } = args;
    console.log(`[firefly] Push/replace: ${localPath} -> ${serial}:${sdcardTemp} -> /data/data/${pkg}/${relTarget}`);

    // SAFETY: Verify we're only targeting the expected XML file
    const expectedTarget = "files/appconfig/cccterminal/3cixml/cccterminal-3cixml-default.xml";
    const relativeTarget = relTarget.startsWith('/') ? relTarget.substring(1) : relTarget;
    
    if (relativeTarget !== expectedTarget) {
      throw new Error(`SAFETY CHECK FAILED: Target path "${relativeTarget}" does not match expected "${expectedTarget}"`);
    }

    // Step 1: Push file to sdcard temp location
    let r = await adbs(serial, "push", localPath, sdcardTemp);
    console.log(`[firefly] Push result: code=${r.code}, out="${r.out}", err="${r.err}"`);
    if (r.code !== 0) throw new Error(`ADB push failed: ${r.err || "Unknown error"}`);

    // Step 2: Verify target directory exists (DO NOT CREATE)
    // Use ls instead of test command since test doesn't work with run-as on some devices
    r = await adbs(serial, "shell", "run-as", pkg, "ls", "files/appconfig/cccterminal/3cixml/");
    console.log(`[firefly] Directory check result: code=${r.code}, out="${r.out}", err="${r.err}"`);
    if (r.code !== 0) {
      await adbs(serial, "shell", "rm", sdcardTemp); // cleanup temp file
      throw new Error(`Target directory does not exist: files/appconfig/cccterminal/3cixml. Will not create new directories.`);
    }
    
    // Step 3: Copy file to replace existing XML (DO NOT CREATE NEW DIRS)
    r = await adbs(serial, "shell", "run-as", pkg, "cp", sdcardTemp, relativeTarget);
    console.log(`[firefly] Copy with run-as result: code=${r.code}, out="${r.out}", err="${r.err}"`);
    
    if (r.code !== 0) {
      await adbs(serial, "shell", "rm", sdcardTemp); // cleanup temp file
      throw new Error(`Failed to copy XML file: ${r.err || "Unknown error"}. Target path may not be accessible.`);
    }

    // Step 4: Set proper permissions on the XML file
    await adbs(serial, "shell", "run-as", pkg, "chmod", "644", relativeTarget);

    // Step 5: Clean up temp file
    await adbs(serial, "shell", "rm", sdcardTemp);

    return { how: "replaced" };
  });

  ipcMain.handle("firefly:restart", async (_e, pkg: string) => {
    console.log(`[firefly] Restarting app: ${pkg}`);
    
    // Force stop the app
    let r = await adb("shell", "am", "force-stop", pkg);
    console.log(`[firefly] Force-stop result: code=${r.code}, out="${r.out}", err="${r.err}"`);
    
    // Start the app again
    r = await adb("shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1");
    console.log(`[firefly] Start app result: code=${r.code}, out="${r.out}", err="${r.err}"`);
    
    if (r.code !== 0) {
      console.warn(`[firefly] App restart had non-zero exit, but continuing...`);
    }
    
    return true;
  });

  ipcMain.handle("firefly:launch-scrcpy", async (_e, { serial }: { serial: string }) => {
    // Prefer launching scrcpy outside Electron or via a detached child; non-blocking stub here.
    await adbs(serial, "wait-for-device");
    return true;
  });

  // --- Window Controls ---
  ipcMain.handle("firefly:window-minimize", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle("firefly:window-maximize", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle("firefly:window-close", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle("firefly:window-is-maximized", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() || false;
  });

  // --- Auto-Updater ---
  ipcMain.handle("firefly:check-for-updates", async () => {
    if (app.isPackaged) {
      const result = await autoUpdater.checkForUpdates();
      return {
        available: !!result?.updateInfo,
        version: result?.updateInfo?.version || null
      };
    }
    return { available: false, version: null };
  });

  ipcMain.handle("firefly:get-app-version", async () => {
    return app.getVersion();
  });

  ipcMain.handle("firefly:install-update", async () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall();
    }
  });
}
