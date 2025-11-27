// src/main/ipc-firefly.ts
import { ipcMain, BrowserWindow, dialog, shell, app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { loadConfig, saveConfig } from "./config";
import { autoUpdater } from "electron-updater";
import { adb, adbs, parseDevices, testAdb, testScrcpy, setCustomAdbPath, detectScrcpyPath, launchScrcpy } from "./adb";

/**
 * Get the path to the bundled ffmpeg executable
 */
function getFfmpegPath(): string {
  const platform = process.platform;
  const isDev = !app.isPackaged;

  if (isDev) {
    // In development, use system ffmpeg
    return "ffmpeg";
  }

  // In production, use bundled ffmpeg
  const resourcesPath = process.resourcesPath;
  
  if (platform === "darwin") {
    return path.join(resourcesPath, "app.asar.unpacked", "resources", "ffmpeg", "ffmpeg-darwin-arm64");
  } else if (platform === "win32") {
    return path.join(resourcesPath, "app.asar.unpacked", "resources", "ffmpeg", "ffmpeg-win32-x64.exe");
  }
  
  // Fallback to system ffmpeg
  return "ffmpeg";
}

export function registerFireflyIpc() {
  // Initialize custom ADB path from config on startup
  loadConfig().then(config => {
    if (config.custom_adb_path) {
      setCustomAdbPath(config.custom_adb_path);
    }
  }).catch(console.error);

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

  ipcMain.handle("firefly:pick-file", async (_e, options?: { 
    title?: string; 
    defaultPath?: string; 
    fileType?: 'executable' | 'any';
  }) => {
    console.log('[firefly] Opening file picker with options:', options);
    
    // Set platform-appropriate filters
    let filters: Array<{ name: string; extensions: string[] }>;
    if (options?.fileType === 'executable') {
      if (process.platform === 'win32') {
        filters = [
          { name: 'Executable Files', extensions: ['exe'] },
          { name: 'All Files', extensions: ['*'] }
        ];
      } else {
        // macOS and Linux - executables don't have extensions
        filters = [{ name: 'All Files', extensions: ['*'] }];
      }
    } else {
      filters = [{ name: 'All Files', extensions: ['*'] }];
    }
    
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      title: options?.title || "Select File",
      defaultPath: options?.defaultPath,
      filters: filters,
    });
    console.log('[firefly] File picker result:', result);
    return result.canceled ? null : result.filePaths[0];
  });

  // --- Devices ---
  ipcMain.handle("firefly:list-devices", async () => {
    console.log(`[firefly] Listing devices...`);
    
    // First test if ADB is working
    const adbTest = await testAdb();
    if (!adbTest.working) {
      console.error(`[firefly] ADB not working:`, adbTest);
      throw new Error(`ADB is not working. Path: ${adbTest.path}. Error: ${adbTest.error || 'Unknown error'}. Please install Android SDK platform-tools or check ADB installation.`);
    }
    
    const { code, out, err } = await adb("devices", "-l");
    console.log(`[firefly] Devices result: code=${code}, out="${out}", err="${err}"`);
    if (code !== 0) {
      throw new Error(`ADB devices command failed: ${err || "Unknown error"}. Make sure USB debugging is enabled on your Android device.`);
    }
    const devices = parseDevices(out);
    console.log(`[firefly] Parsed ${devices.length} devices:`, devices);
    return devices;
  });

  ipcMain.handle("firefly:get-device-props", async (_e, serial: string) => {
    const r1 = await adbs(serial, "shell", "getprop", "ro.product.model");
    const r2 = await adbs(serial, "shell", "getprop", "ro.product.manufacturer");
    if (r1.code !== 0) throw new Error(r1.err || "getprop model failed");
    if (r2.code !== 0) throw new Error(r2.err || "getprop manufacturer failed");
    
    // Try multiple methods to get IP address
    let ipAddress: string | null = null;
    
    // Method 1: Try ip route command
    const r3 = await adbs(serial, "shell", "ip", "route", "get", "1.1.1.1");
    if (r3.code === 0) {
      const match = r3.out.match(/src\s+([0-9.]+)/);
      if (match) {
        ipAddress = match[1];
      }
    }
    
    // Method 2: If method 1 failed, try ifconfig wlan0
    if (!ipAddress) {
      const r4 = await adbs(serial, "shell", "ifconfig", "wlan0");
      if (r4.code === 0) {
        const match = r4.out.match(/inet addr:([0-9.]+)/);
        if (match) {
          ipAddress = match[1];
        } else {
          // Try newer format
          const match2 = r4.out.match(/inet\s+([0-9.]+)/);
          if (match2) {
            ipAddress = match2[1];
          }
        }
      }
    }
    
    // Get battery level
    let batteryLevel: number | null = null;
    let isCharging = false;
    const rBattery = await adbs(serial, "shell", "dumpsys", "battery");
    if (rBattery.code === 0) {
      const levelMatch = rBattery.out.match(/level:\s*(\d+)/);
      if (levelMatch) {
        batteryLevel = parseInt(levelMatch[1]);
      }
      // Check charging status (AC powered, USB powered, or Wireless powered)
      isCharging = /AC powered:\s*true/i.test(rBattery.out) || 
                   /USB powered:\s*true/i.test(rBattery.out) ||
                   /Wireless powered:\s*true/i.test(rBattery.out);
    }
    
    // Get Android version with build info
    let androidVersion: string | null = null;
    const rVersion = await adbs(serial, "shell", "getprop", "ro.build.version.release");
    const rBuildId = await adbs(serial, "shell", "getprop", "ro.build.id");
    const rBuildDisplay = await adbs(serial, "shell", "getprop", "ro.build.display.id");
    
    if (rVersion.code === 0) {
      let versionStr = rVersion.out.trim();
      
      // Try to get more detailed build info
      if (rBuildDisplay.code === 0 && rBuildDisplay.out.trim()) {
        // Use the full build display ID which often contains detailed version info
        androidVersion = rBuildDisplay.out.trim();
      } else if (rBuildId.code === 0 && rBuildId.out.trim()) {
        // Fallback to combining version with build ID
        androidVersion = `${versionStr}_${rBuildId.out.trim()}`;
      } else {
        // Just use the version number
        androidVersion = versionStr;
      }
    }
    
    console.log(`[firefly] Device ${serial} - IP: ${ipAddress || 'not found'}, Battery: ${batteryLevel}%, Charging: ${isCharging}, Android: ${androidVersion}`);
    
    return { 
      model: r1.out.trim(), 
      manufacturer: r2.out.trim(), 
      ipAddress,
      batteryLevel,
      isCharging,
      androidVersion
    };
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

  ipcMain.handle("firefly:launch-scrcpy", async (event, { serial }: { serial: string }) => {
    try {
      // Ensure device is ready
      await adbs(serial, "wait-for-device");
      
      // Launch scrcpy with callback to notify renderer when it closes
      const success = await launchScrcpy(serial, () => {
        // Notify renderer that scrcpy has closed
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
          win.webContents.send("firefly:scrcpy-closed", { serial });
        }
      });
      return success;
    } catch (error) {
      console.error("Failed to launch scrcpy:", error);
      return false;
    }
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
    if (!app.isPackaged) {
      console.log('[updater] Check for updates called in development mode');
      return { 
        available: false, 
        version: null, 
        message: "Update checking is only available in production builds" 
      };
    }

    try {
      console.log('[updater] Checking for updates...');
      const result = await autoUpdater.checkForUpdates();
      console.log('[updater] Check result:', result);
      return {
        available: !!result?.updateInfo,
        version: result?.updateInfo?.version || null
      };
    } catch (error) {
      console.error('[updater] Failed to check for updates:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for common issues
        if (errorMessage.includes('404')) {
          errorMessage = 'Repository not found or not accessible. The repository may be private or the URL may be incorrect.';
        } else if (errorMessage.includes('network')) {
          errorMessage = 'Network error occurred while checking for updates. Please check your internet connection.';
        } else if (errorMessage.includes('authentication')) {
          errorMessage = 'Authentication failed. The repository may be private.';
        }
      }
      
      throw new Error(`Update check failed: ${errorMessage}`);
    }
  });

  ipcMain.handle("firefly:get-app-version", async () => {
    return app.getVersion();
  });

  ipcMain.handle("firefly:install-update", async () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall();
    }
  });

  // --- ADB Diagnostics ---
  ipcMain.handle("firefly:test-adb", async () => {
    return await testAdb();
  });

  // --- Scrcpy Diagnostics ---
  ipcMain.handle("firefly:test-scrcpy", async (_e, scrcpyPath: string) => {
    return await testScrcpy(scrcpyPath);
  });

  ipcMain.handle("firefly:detect-scrcpy", async () => {
    return await detectScrcpyPath();
  });

  // --- Custom Tool Paths ---
  ipcMain.handle("firefly:set-custom-adb-path", async (_e, adbPath: string) => {
    setCustomAdbPath(adbPath);
    await saveConfig({ custom_adb_path: adbPath });
    return true;
  });

  ipcMain.handle("firefly:set-custom-scrcpy-path", async (_e, scrcpyPath: string) => {
    await saveConfig({ custom_scrcpy_path: scrcpyPath });
    return true;
  });

  // --- Logcat ---
  ipcMain.handle("firefly:start-logcat", async (_e, { serial, packageName }: { serial: string; packageName?: string }) => {
    console.log(`[firefly] Starting logcat for device ${serial}, package: ${packageName || 'all'}`);
    
    // Build logcat command
    const logcatArgs = ["logcat"];
    
    // Clear existing logs first
    await adbs(serial, "logcat", "-c");
    
    // Add package filter if specified
    if (packageName) {
      // Filter by package name using grep-like filtering
      logcatArgs.push("--pid", `$(pidof ${packageName})`);
    }
    
    // Start logcat and return immediately (streaming logs)
    const result = await adbs(serial, ...logcatArgs);
    return result;
  });

  ipcMain.handle("firefly:clear-logcat", async (_e, { serial }: { serial: string }) => {
    console.log(`[firefly] Clearing logcat for device ${serial}`);
    const result = await adbs(serial, "logcat", "-c");
    return result;
  });

  ipcMain.handle("firefly:get-logcat-snapshot", async (_e, { serial, packageName, maxLines = 2000 }: { 
    serial: string; 
    packageName?: string; 
    maxLines?: number 
  }) => {
    console.log(`[firefly] Getting logcat snapshot for device ${serial}, package: ${packageName || 'all'}`);
    
    try {
      // Get ALL logs first without filtering - let the frontend handle filtering
      // This ensures we don't miss any relevant logs due to imperfect server-side filtering
      let result;
      
      // Try different logcat formats to get the best output similar to Android Studio
      // Use threadtime format which is most similar to Android Studio
      result = await adbs(serial, "logcat", "-d", "-v", "threadtime", "-t", maxLines.toString());
      
      if (result.code !== 0) {
        // Fallback to long format if threadtime doesn't work
        result = await adbs(serial, "logcat", "-d", "-v", "long", "-t", maxLines.toString());
      }
      
      if (result.code !== 0) {
        // Final fallback to time format
        result = await adbs(serial, "logcat", "-d", "-v", "time", "-t", maxLines.toString());
      }
      
      if (result.code !== 0) {
        throw new Error(result.err || "Failed to get logcat");
      }
      
      // Return ALL logs - no server-side filtering
      // The frontend will handle package filtering more accurately
      return { success: true, logs: result.out, packageName };
    } catch (error) {
      console.error(`[firefly] Failed to get logcat:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // --- Video Generator ---
  ipcMain.handle("firefly:pick-images", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Images",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "webp"] }
      ]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("firefly:pick-save-location", async (_e, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: "Save Video As",
      defaultPath: defaultName,
      filters: [
        { name: "Video Files", extensions: ["mp4", "avi"] }
      ]
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle("firefly:generate-video", async (_e, options: {
    images: string[];
    delay: number;
    terminal: "PAX" | "VIPA";
    width: number;
    height: number;
    outputPath: string;
  }) => {
    const { spawn } = await import("node:child_process");
    const { images, delay, terminal, width, height, outputPath } = options;

    try {
      // Ensure dimensions are even
      const evenWidth = width - (width % 2);
      const evenHeight = height - (height % 2);

      // Use a reasonable base framerate (0.5 fps works well for slideshows)
      // Then duplicate frames to fill the delay duration
      const baseFps = 0.5;
      const framerate = `${baseFps}`;

      // Build ffmpeg command - CRITICAL: use -loop 1 for static images to create video streams
      const ffmpegArgs: string[] = ["-y"];
      
      const filterChains: string[] = [];
      
      // Add all images as looping inputs with framerate and duration
      // -loop 1 makes ffmpeg loop the still image
      // -framerate sets the frame rate for the looped image
      // -t sets the duration in seconds
      for (const img of images) {
        ffmpegArgs.push(
          "-loop", "1",
          "-framerate", framerate,
          "-t", delay.toString(),
          "-i", img
        );
      }
      
      // Build filter_complex: handle transparency, scale without upscaling, pad with white background
      // Key: Use scale with min to prevent upscaling - images stay at original size if smaller
      for (let i = 0; i < images.length; i++) {
        filterChains.push(
          // Blend transparent PNGs with white background first
          `color=white:s=3840x2160:r=${baseFps}:d=${delay}[white${i}];` +
          `[white${i}][${i}:v]scale2ref[bg${i}][img${i}];` +
          `[bg${i}][img${i}]overlay=format=auto,` +
          `scale='min(${evenWidth},iw)':'min(${evenHeight},ih)':force_original_aspect_ratio=decrease:flags=lanczos,` +
          `pad=${evenWidth}:${evenHeight}:(ow-iw)/2:(oh-ih)/2:color=white,` +
          `setsar=1,` +
          `scale=in_range=full:in_color_matrix=bt709:out_range=full:out_color_matrix=bt709,` +
          `format=yuv420p,` +
          `setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v${i}]`
        );
      }
      
      const concatInputs = Array.from({ length: images.length }, (_, i) => `[v${i}]`).join("");
      const filterComplex = filterChains.join(";") + `;${concatInputs}concat=n=${images.length}:v=1:a=0[vout]`;
      
      ffmpegArgs.push("-filter_complex", filterComplex, "-map", "[vout]");

      // Add encoding settings based on terminal type
      if (terminal === "PAX") {
        ffmpegArgs.push(
          "-c:v", "libx264",
          "-profile:v", "main",
          "-preset", "veryslow",
          "-x264-params", `crf=23:ref=1:level=3.1`,
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          outputPath
        );
      } else if (terminal === "VIPA") {
        // VIPA (P400) uses Main profile in AVI container - matching working reference
        ffmpegArgs.push(
          "-c:v", "libx264",
          "-profile:v", "main",
          "-preset", "veryslow",
          "-x264-params", `crf=23:ref=1:level=3.1`,
          "-pix_fmt", "yuv420p",
          outputPath
        );
      }

      console.log("[ffmpeg] Running command:", "ffmpeg", ffmpegArgs.join(" "));

      const ffmpegPath = getFfmpegPath();
      console.log("[ffmpeg] Using ffmpeg at:", ffmpegPath);

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
        let stderr = "";
        let stdout = "";

        ffmpeg.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        ffmpeg.stderr.on("data", (data) => {
          stderr += data.toString();
          console.log("[ffmpeg]", data.toString());
        });

        ffmpeg.on("close", (code) => {
          if (code === 0) {
            console.log("[ffmpeg] Success!");
            resolve({ success: true });
          } else {
            console.error("[ffmpeg] Failed with code", code);
            console.error("[ffmpeg] stderr:", stderr);
            resolve({ success: false, error: `ffmpeg exited with code ${code}\n\nLast output:\n${stderr.slice(-1000)}` });
          }
        });

        ffmpeg.on("error", (err) => {
          console.error("[ffmpeg] Error spawning:", err);
          resolve({ success: false, error: `Failed to spawn ffmpeg: ${err.message}` });
        });
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
