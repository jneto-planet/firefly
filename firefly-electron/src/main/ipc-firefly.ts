// src/main/ipc-firefly.ts
import { ipcMain, BrowserWindow, dialog, shell, app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { loadConfig, saveConfig } from "./config";
import { buildLoggerClientArgs } from "./logger-client";
import { autoUpdater } from "electron-updater";
import { adb, adbs, parseDevices, testAdb, testScrcpy, setCustomAdbPath, detectScrcpyPath, launchScrcpy, getAdbPath, restartApp } from "./adb";
import { spawn, ChildProcess } from "node:child_process";

// Track active screen recordings
const activeRecordings = new Map<string, ChildProcess>();

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
  ipcMain.handle("firefly:open-default", async (_e, p: string) => { 
    const config = await loadConfig();
    const customEditor = config.xml_editor_path;
    
    // If custom editor is set and the file is XML, use custom editor
    if (customEditor && p.toLowerCase().endsWith('.xml')) {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Open with custom editor
        const platform = process.platform;
        if (platform === 'darwin') {
          await execAsync(`open -a "${customEditor}" "${p}"`);
        } else if (platform === 'win32') {
          await execAsync(`"${customEditor}" "${p}"`);
        } else {
          await execAsync(`"${customEditor}" "${p}"`);
        }
        return;
      } catch (error) {
        console.error('[firefly] Failed to open with custom editor:', error);
        // Fall back to default
      }
    }
    
    // Use system default
    await shell.openPath(p); 
  });
  
  ipcMain.handle("firefly:get-default-xml-editor", async () => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const platform = process.platform;
      
      if (platform === 'darwin') {
        // macOS: Try to get the default app using duti or LSLaunchServices
        try {
          // Try using mdls on a temporary XML file
          const tmpFile = path.join(app.getPath('temp'), 'test.xml');
          await fs.writeFile(tmpFile, '<?xml version="1.0"?><root/>', 'utf-8');
          
          const { stdout: _stdout } = await execAsync(`mdls -name kMDItemContentType -name kMDItemKind "${tmpFile}"`);
          
          // Try to get default app using open -Ra
          const { stdout: _appInfo } = await execAsync(`/usr/bin/osascript -e 'tell application "System Events" to get name of application file id (get id of application processes whose visible is true)'`).catch(() => ({ stdout: '' }));
          
          // Cleanup temp file
          await fs.unlink(tmpFile).catch(() => {});
          
          // Simple fallback: just return a generic message
          return "System default (typically TextEdit or Xcode)";
        } catch (e) {
          return "System default (typically TextEdit or Xcode)";
        }
      } else if (platform === 'win32') {
        // Windows: Query file association
        try {
          const { stdout } = await execAsync('assoc .xml');
          const fileType = stdout.trim().split('=')[1];
          if (fileType) {
            const { stdout: appPath } = await execAsync(`ftype ${fileType}`);
            const match = appPath.match(/"([^"]+)"/);
            if (match && match[1]) {
              return path.basename(match[1]);
            }
          }
        } catch (e) {
          // Fallback
        }
        return "System default (typically Notepad)";
      } else {
        // Linux: Try xdg-mime
        try {
          const { stdout } = await execAsync('xdg-mime query default text/xml');
          const result = stdout.trim();
          return result || "System default";
        } catch (e) {
          return "System default";
        }
      }
    } catch (error) {
      console.error('[firefly] Failed to detect default XML editor:', error);
      return "System default";
    }
  });
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
      // Check if battery is present (devices without battery report "present: false")
      const batteryPresent = /present:\s*true/i.test(rBattery.out);
      
      if (batteryPresent) {
        const levelMatch = rBattery.out.match(/level:\s*(\d+)/);
        if (levelMatch) {
          batteryLevel = parseInt(levelMatch[1]);
        }
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
    
    // Step 3: Copy file to replace existing XML
    // Use cat + redirect instead of cp to work around Android 12+ SELinux restrictions
    // that prevent run-as from copying files from world-readable locations like /sdcard
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execPromise = promisify(exec);
    const adbPath = getAdbPath();
    
    // Use shell command: cat temp_file | run-as pkg sh -c 'cat > target_file'
    const copyCommand = `"${adbPath}" -s ${serial} shell "cat ${sdcardTemp} | run-as ${pkg} sh -c 'cat > ${relativeTarget}'"`;
    console.log(`[firefly] Executing copy command for Android 12+ compatibility`);
    
    try {
      await execPromise(copyCommand);
      console.log(`[firefly] File copied successfully using cat redirect method`);
    } catch (error: any) {
      await adbs(serial, "shell", "rm", sdcardTemp); // cleanup temp file
      throw new Error(`Failed to copy XML file: ${error.message || "Unknown error"}. Target path may not be accessible.`);
    }

    // Step 4: Set proper permissions on the XML file
    await adbs(serial, "shell", "run-as", pkg, "chmod", "644", relativeTarget);

    // Step 5: Clean up temp file
    await adbs(serial, "shell", "rm", sdcardTemp);

    return { how: "replaced" };
  });

  ipcMain.handle("firefly:restart", async (_e, { pkg, serial }: { pkg: string; serial: string }) => {
    return restartApp(serial, pkg);
  });

  // --- Pull XML from Device ---
  ipcMain.handle("firefly:pull-xml-from-device", async (_e, args: {
    pkg: string; relTarget: string; serial: string; defaultSavePath: string;
  }) => {
    const { pkg, relTarget, serial, defaultSavePath } = args;
    console.log(`[firefly] Pulling XML from device ${serial}: ${relTarget}`);

    try {
      // Step 1: Read the XML file from device
      const relativeTarget = relTarget.startsWith('/') ? relTarget.substring(1) : relTarget;
      let r = await adbs(serial, "shell", "run-as", pkg, "cat", relativeTarget);
      console.log(`[firefly] Read XML file result: code=${r.code}`);
      
      if (r.code !== 0) {
        throw new Error(`Failed to read XML file from device: ${r.err || "File may not exist"}`);
      }

      const xmlContent = r.out;
      if (!xmlContent || xmlContent.trim().length === 0) {
        throw new Error("XML file is empty or could not be read");
      }

      // Step 2: Show save dialog
      const result = await dialog.showSaveDialog({
        title: "Save Configuration XML",
        defaultPath: defaultSavePath,
        filters: [
          { name: "XML Files", extensions: ["xml"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      // Step 3: Save the file
      await fs.writeFile(result.filePath, xmlContent, 'utf-8');
      console.log(`[firefly] XML file saved to: ${result.filePath}`);

      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error(`[firefly] Failed to pull XML:`, error);
      throw error;
    }
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

  ipcMain.handle("firefly:open-butterfly", async () => {
    try {
      const config = await loadConfig();
      const scriptPath = config.butterfly_path?.trim();

      if (!scriptPath) {
        console.error("[firefly] Butterfly path not configured");
        dialog.showErrorBox(
          "Butterfly Not Configured",
          "No Butterfly path has been set. Please configure it in Settings."
        );
        return false;
      }

      console.log(`[firefly] Launching Butterfly from: ${scriptPath}`);
      
      const platform = process.platform;
      const workingDir = path.dirname(scriptPath);
      
      let childProcess;
      
      if (platform === "win32") {
        // Windows: Execute the .bat file
        childProcess = spawn("cmd.exe", ["/c", scriptPath], {
          cwd: workingDir,
          detached: true,
          stdio: "ignore"
        });
      } else {
        // macOS/Linux: Execute the .sh file
        childProcess = spawn("sh", [scriptPath], {
          cwd: workingDir,
          detached: true,
          stdio: "ignore"
        });
      }
      
      childProcess.unref();
      
      console.log("[firefly] Butterfly launched successfully");
      return true;
    } catch (error) {
      console.error("[firefly] Failed to open Butterfly:", error);
      dialog.showErrorBox(
        "Failed to Launch Butterfly",
        `An error occurred while launching Butterfly: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  });

  // --- Open Logger Client ---
  ipcMain.handle("firefly:open-logger-client", async (_e, args?: { ip?: string; port?: string; pattern?: string }) => {
    const config = await loadConfig();
    const execPath = config.logger_client_path?.trim();
    if (!execPath) {
      dialog.showErrorBox(
        "Logger Client Not Configured",
        "No Logger Client executable path has been set. Please configure the path in Settings."
      );
      return false;
    }
    try {
      const spawnArgs = buildLoggerClientArgs(args);
      const workingDir = path.dirname(execPath);
      const childProcess = spawn(execPath, spawnArgs, { cwd: workingDir, detached: true, stdio: "ignore" });
      childProcess.unref();
      return true;
    } catch (error) {
      console.error("[firefly] Failed to open Logger Client:", error);
      dialog.showErrorBox(
        "Failed to Launch Logger Client",
        `An error occurred while launching Logger Client: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  });

  // --- Clear TID from DataStore ---
  ipcMain.handle("firefly:clear-tid-from-datastore", async (_e, args: {
    pkg: string; serial: string;
  }) => {
    const { pkg, serial } = args;
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execPromise = promisify(exec);
    const adbPath = getAdbPath();
    
    console.log(`[firefly] Clearing TID from DataStore and Firmware for ${serial}`);

    const filesToProcess = [
      {
        path: "files/store/integrator/DataStoreIntegrator.properties",
        tempFile: "/sdcard/DataStoreIntegrator.properties.tmp",
        name: "DataStore"
      },
      {
        path: "files/store/firmware/firmware.config.properties",
        tempFile: "/sdcard/firmware.config.properties.tmp",
        name: "Firmware"
      }
    ];

    const results: string[] = [];
    let anyModified = false;

    for (const file of filesToProcess) {
      try {
        console.log(`[firefly] Processing ${file.name} file: ${file.path}`);
        
        // Step 1: Read the file
        let r = await adbs(serial, "shell", "run-as", pkg, "cat", file.path);
        console.log(`[firefly] Read ${file.name} file result: code=${r.code}`);
        
        if (r.code !== 0) {
          console.warn(`[firefly] Could not read ${file.name} file (may not exist yet): ${r.err}`);
          results.push(`${file.name}: file not found (may be new installation)`);
          continue;
        }

        // Step 2: Filter out the INSTANCE_TERMINAL_IDENTIFICATION line
        const originalContent = r.out;
        const lines = originalContent.split('\n');
        const filteredLines = lines.filter(line => !line.trim().startsWith('INSTANCE_TERMINAL_IDENTIFICATION'));
        
        // Check if any line was actually removed
        if (lines.length === filteredLines.length) {
          console.log(`[firefly] No INSTANCE_TERMINAL_IDENTIFICATION found in ${file.name}, nothing to remove`);
          results.push(`${file.name}: TID not found`);
          continue;
        }
        
        const newContent = filteredLines.join('\n');
        const removedCount = lines.length - filteredLines.length;
        console.log(`[firefly] Removed ${removedCount} line(s) containing TID from ${file.name}`);

        // Step 3: Write filtered content to temp file on sdcard
        const escapedContent = newContent.replace(/'/g, "'\\''"); // Escape single quotes for shell
        await execPromise(`"${adbPath}" -s ${serial} shell "echo '${escapedContent}' > ${file.tempFile}"`);
        
        // Step 4: Copy temp file to target location
        // Use cat + redirect instead of cp to work around Android 12+ SELinux restrictions
        const copyCommand = `"${adbPath}" -s ${serial} shell "cat ${file.tempFile} | run-as ${pkg} sh -c 'cat > ${file.path}'"`;
        console.log(`[firefly] Copying filtered ${file.name} file using cat redirect for Android 12+ compatibility`);
        
        try {
          await execPromise(copyCommand);
          console.log(`[firefly] Copy filtered ${file.name} file succeeded`);
        } catch (error: any) {
          await adbs(serial, "shell", "rm", file.tempFile); // cleanup
          console.error(`[firefly] Failed to copy filtered ${file.name} file: ${error.message}`);
          results.push(`${file.name}: failed to update`);
          continue;
        }

        // Step 5: Set proper permissions
        await adbs(serial, "shell", "run-as", pkg, "chmod", "644", file.path);

        // Step 6: Clean up temp file
        await adbs(serial, "shell", "rm", file.tempFile);

        console.log(`[firefly] Successfully cleared TID from ${file.name}`);
        results.push(`${file.name}: cleared successfully`);
        anyModified = true;
      } catch (error) {
        console.error(`[firefly] Error processing ${file.name}:`, error);
        results.push(`${file.name}: error - ${error}`);
      }
    }

    const message = results.join("; ");
    console.log(`[firefly] Clear TID summary: ${message}`);
    return { success: true, modified: anyModified, message };
  });

  // --- Screenshot ---
  ipcMain.handle("firefly:take-screenshot", async (_e, { serial }: { serial: string }) => {
    try {
      console.log(`[firefly] Taking screenshot for device ${serial}`);
      
      // Use exec to get raw binary data
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execPromise = promisify(exec);
      
      const adbPath = getAdbPath();
      const command = `"${adbPath}" -s ${serial} exec-out screencap -p`;
      
      const { stdout, stderr } = await execPromise(command, { 
        encoding: 'buffer',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large screenshots
      });
      
      if (stderr && stderr.length > 0) {
        console.error(`[firefly] Screenshot stderr: ${stderr.toString()}`);
      }
      
      // Convert buffer to base64
      const base64Image = stdout.toString('base64');
      console.log(`[firefly] Screenshot captured successfully (${stdout.length} bytes, ${base64Image.length} base64 chars)`);
      return base64Image;
    } catch (error) {
      console.error("Failed to take screenshot:", error);
      throw error;
    }
  });

  ipcMain.handle("firefly:save-screenshot", async (_e, { base64Data, deviceName }: { base64Data: string; deviceName: string }) => {
    try {
      // Generate filename with timestamp (HH-mm-ss format)
      const now = new Date();
      const timestamp = now.getHours().toString().padStart(2, '0') + '-' +
                       now.getMinutes().toString().padStart(2, '0') + '-' +
                       now.getSeconds().toString().padStart(2, '0');
      const defaultName = `screenshot_${deviceName}_${timestamp}.png`;
      
      const result = await dialog.showSaveDialog({
        title: "Save Screenshot",
        defaultPath: defaultName,
        filters: [
          { name: "PNG Images", extensions: ["png"] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        return null;
      }
      
      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(result.filePath, buffer);
      
      console.log(`[firefly] Screenshot saved to ${result.filePath}`);
      return result.filePath;
    } catch (error) {
      console.error("Failed to save screenshot:", error);
      throw error;
    }
  });

  // --- Screen Recording ---
  ipcMain.handle("firefly:start-screen-recording", async (_e, { serial, bitRate, resolution, showTaps }: { 
    serial: string; 
    bitRate: number; 
    resolution: number; 
    showTaps: boolean 
  }) => {
    try {
      console.log(`[firefly] Starting screen recording for device ${serial}`);
      console.log(`[firefly] Options - bitRate: ${bitRate}Mbps, resolution: ${resolution}%, showTaps: ${showTaps}`);
      
      // Check if already recording
      if (activeRecordings.has(serial)) {
        console.warn(`[firefly] Recording already in progress for device ${serial}`);
        return { success: false, message: "Recording already in progress" };
      }
      
      const adbPath = getAdbPath();
      const recordingPath = `/sdcard/firefly_recording_${Date.now()}.mp4`;
      
      // Get Android version to determine screenrecord parameters
      console.log(`[firefly] Checking Android version for device ${serial}`);
      const versionResult = await adbs(serial, "shell", "getprop", "ro.build.version.sdk");
      const sdkVersion = parseInt(versionResult.out.trim());
      console.log(`[firefly] Device SDK version: ${sdkVersion}`);
      
      // Enable show touches system setting if requested (like Android Studio does)
      if (showTaps) {
        console.log(`[firefly] Enabling show_touches system setting...`);
        try {
          await adbs(serial, "shell", "settings", "put", "system", "show_touches", "1");
          console.log(`[firefly] Show touches enabled via system settings`);
        } catch (e) {
          console.warn(`[firefly] Failed to enable show_touches:`, e);
        }
      }
      
      // Build screenrecord command args
      const recordArgs = ["-s", serial, "shell", "screenrecord"];
      
      // Add bit rate parameter (format: 4000000 for 4Mbps)
      // Limit bit rate on older Android versions for better compatibility
      const maxBitRate = sdkVersion < 28 ? 8 : bitRate; // Max 8Mbps for Android < 9
      const bitRateValue = Math.floor(Math.min(bitRate, maxBitRate) * 1000000);
      recordArgs.push("--bit-rate", bitRateValue.toString());
      console.log(`[firefly] Bit rate: ${bitRateValue} (${Math.min(bitRate, maxBitRate)}Mbps)`);
      
      // Add size parameter for resolution scaling
      // Get device screen size first
      if (resolution !== 100) {
        try {
          const sizeResult = await adbs(serial, "shell", "wm", "size");
          const sizeMatch = sizeResult.out.match(/Physical size: (\d+)x(\d+)/);
          if (sizeMatch) {
            const width = parseInt(sizeMatch[1]);
            const height = parseInt(sizeMatch[2]);
            const scaledWidth = Math.floor(width * (resolution / 100));
            const scaledHeight = Math.floor(height * (resolution / 100));
            // Make dimensions even for video encoding
            const evenWidth = scaledWidth - (scaledWidth % 2);
            const evenHeight = scaledHeight - (scaledHeight % 2);
            recordArgs.push("--size", `${evenWidth}x${evenHeight}`);
            console.log(`[firefly] Resolution: ${evenWidth}x${evenHeight} (${resolution}% of ${width}x${height})`);
          }
        } catch (e) {
          console.warn(`[firefly] Failed to get device screen size, using default resolution:`, e);
        }
      }
      
      // Android's screenrecord enforces a hard 180s max on --time-limit for Android 4.4-13 (SDK 19-33).
      // Passing a value > 180 causes screenrecord to exit immediately with code 2 on those versions.
      // Android 14+ (SDK 34) removed the 180s cap, allowing extended recording times.
      if (sdkVersion >= 34) {
        // Android 14+ - use extended time limit (30 minutes)
        console.log(`[firefly] Using extended time limit (1800s) for Android 14+ (SDK ${sdkVersion})`);
        recordArgs.push("--time-limit", "1800");
      } else if (sdkVersion >= 19) {
        // Android 4.4-13 - don't add --time-limit to use the system default (180s)
        console.log(`[firefly] Using default time limit (180s) for Android SDK ${sdkVersion}`);
      } else {
        console.warn(`[firefly] Android version ${sdkVersion} may not support screenrecord`);
      }
      
      recordArgs.push(recordingPath);
      
      console.log(`[firefly] Executing screenrecord with args:`, recordArgs);
      
      // Start screenrecord process
      const recordProcess = spawn(adbPath, recordArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Capture stderr to log any errors from screenrecord
      let stderrOutput = '';
      if (recordProcess.stderr) {
        recordProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderrOutput += output;
          console.error(`[firefly] screenrecord stderr:`, output);
        });
      }
      
      // Capture stdout as well
      if (recordProcess.stdout) {
        recordProcess.stdout.on('data', (data) => {
          console.log(`[firefly] screenrecord stdout:`, data.toString());
        });
      }
      
      activeRecordings.set(serial, recordProcess);
      
      recordProcess.on('error', (error) => {
        console.error(`[firefly] Screen recording process error:`, error);
        activeRecordings.delete(serial);
      });
      
      recordProcess.on('exit', (code, signal) => {
        console.log(`[firefly] Screen recording process exited with code ${code}, signal ${signal}`);
        if (code !== 0 && code !== null) {
          console.error(`[firefly] screenrecord failed with exit code ${code}`);
          if (stderrOutput) {
            console.error(`[firefly] Error output: ${stderrOutput}`);
          }
        }
        activeRecordings.delete(serial);
      });
      
      // Wait a moment to check if the process started successfully
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!recordProcess.pid || recordProcess.exitCode !== null) {
        const errorMsg = stderrOutput || 'Process failed to start or exited immediately';
        console.error(`[firefly] Failed to start recording:`, errorMsg);
        activeRecordings.delete(serial);
        return { 
          success: false, 
          message: `Failed to start recording: ${errorMsg}. Try disabling "Show Taps" if the issue persists.`
        };
      }
      
      console.log(`[firefly] Screen recording started successfully: ${recordingPath} (PID: ${recordProcess.pid})`);
      
      // Return info including time limit for user awareness
      const timeLimitInfo = sdkVersion >= 34 
        ? "Up to 30 minutes" 
        : "Up to 3 minutes (Android limitation)";
      console.log(`[firefly] Time limit: ${timeLimitInfo}`);
      
      return { 
        success: true, 
        recordingPath,
        sdkVersion,
        timeLimitInfo
      };
    } catch (error) {
      console.error("Failed to start screen recording:", error);
      throw error;
    }
  });

  ipcMain.handle("firefly:stop-screen-recording", async (_e, { serial, recordingPath }: { serial: string; recordingPath: string }) => {
    try {
      console.log(`[firefly] ========== STOP RECORDING START ==========`);
      console.log(`[firefly] Device serial: ${serial}`);
      console.log(`[firefly] Recording path: ${recordingPath}`);
      console.log(`[firefly] Platform: ${process.platform}`);
      console.log(`[firefly] App packaged: ${app.isPackaged}`);
      
      // Disable show touches system setting
      console.log(`[firefly] Disabling show_touches system setting...`);
      try {
        await adbs(serial, "shell", "settings", "put", "system", "show_touches", "0");
        console.log(`[firefly] Show touches disabled`);
      } catch (e) {
        console.warn(`[firefly] Failed to disable show_touches:`, e);
      }
      
      const recordProcess = activeRecordings.get(serial);
      if (!recordProcess) {
        console.warn(`[firefly] No active recording found for device ${serial}`);
        return { success: false, message: "No active recording found" };
      }
      
      console.log(`[firefly] Found active recording process (PID: ${recordProcess.pid})`);
      
      // Stop the recording by killing the process
      console.log(`[firefly] Sending SIGINT to recording process...`);
      recordProcess.kill('SIGINT');
      
      // Wait a bit for the file to be finalized
      console.log(`[firefly] Waiting 1.5s for file finalization...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Remove from active recordings
      activeRecordings.delete(serial);
      console.log(`[firefly] Removed from active recordings map`);
      
      // Verify the recording file exists on device before showing dialog
      console.log(`[firefly] Checking if recording file exists on device...`);
      const checkFile = await adbs(serial, "shell", "ls", "-l", recordingPath);
      if (checkFile.code !== 0) {
        console.error(`[firefly] Recording file not found on device: ${checkFile.err}`);
        return { success: false, message: `Recording file not found on device: ${checkFile.err}` };
      }
      console.log(`[firefly] Recording file exists on device: ${checkFile.out.trim()}`);
      
      // Get save path from config or use Desktop as default
      const config = await loadConfig();
      let savePath = config.recording_save_path;
      
      // If no save path configured, use Desktop
      if (!savePath || savePath.trim() === "") {
        savePath = app.getPath('desktop');
        console.log(`[firefly] No save path configured, using Desktop: ${savePath}`);
      } else {
        console.log(`[firefly] Using configured save path: ${savePath}`);
      }
      
      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.getHours().toString().padStart(2, '0') + '-' +
                       now.getMinutes().toString().padStart(2, '0') + '-' +
                       now.getSeconds().toString().padStart(2, '0');
      const fileName = `screen_recording_${timestamp}.mp4`;
      const fullPath = path.join(savePath, fileName);
      console.log(`[firefly] Auto-saving to: ${fullPath}`);
      
      // Pull the recording from the device
      console.log(`[firefly] Pulling recording from device: ${recordingPath} -> ${fullPath}`);
      const pullResult = await adbs(serial, "pull", recordingPath, fullPath);
      console.log(`[firefly] Pull result - code: ${pullResult.code}, err: ${pullResult.err}, out: ${pullResult.out}`);
      
      if (pullResult.code !== 0) {
        console.error(`[firefly] Failed to pull recording: ${pullResult.err}`);
        throw new Error(`Failed to pull recording: ${pullResult.err}`);
      }
      
      // Clean up the recording file on device
      console.log(`[firefly] Cleaning up recording file on device...`);
      await adbs(serial, "shell", "rm", recordingPath);
      
      console.log(`[firefly] Screen recording saved to ${fullPath}`);
      console.log(`[firefly] ========== STOP RECORDING SUCCESS ==========`);
      return { success: true, filePath: fullPath };
    } catch (error) {
      console.error(`[firefly] ========== STOP RECORDING ERROR ==========`);
      console.error(`[firefly] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`[firefly] Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[firefly] Error stack:`, error instanceof Error ? error.stack : 'N/A');
      console.error("Failed to stop screen recording:", error);
      // Try to clean up
      activeRecordings.delete(serial);
      if (recordingPath) {
        try {
          await adbs(serial, "shell", "rm", recordingPath);
        } catch (e) {
          console.error("Failed to clean up recording file:", e);
        }
      }
      throw error;
    }
  });

  ipcMain.handle("firefly:is-recording", async (_e, { serial }: { serial: string }) => {
    return activeRecordings.has(serial);
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

  // --- Accessibility Converter ---
  ipcMain.handle("firefly:pick-accessibility-images", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Images for Accessibility Conversion",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "webp"] }
      ]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("firefly:read-image-as-data-url", async (_e, filePath: string) => {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      bmp: "image/bmp", gif: "image/gif", webp: "image/webp",
    };
    const mime = mimeMap[ext] || "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  });

  ipcMain.handle("firefly:pick-accessibility-output-dir", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Output Folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("firefly:save-accessibility-image", async (_e, args: {
    originalPath: string;
    base64Data: string;
    suffix: string;
    outputDir: string;
  }) => {
    const { originalPath, base64Data, suffix, outputDir } = args;
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    const outputPath = path.join(outputDir, `${baseName}_${suffix}.png`);

    const buffer = Buffer.from(base64Data, "base64");
    await fs.writeFile(outputPath, buffer);

    return { success: true, outputPath };
  });
}
