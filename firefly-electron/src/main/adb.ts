// src/main/adb.ts
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type RunResult = { code: number; out: string; err: string };

// Try to find ADB in common locations
function findAdbPath(): string {
  const commonPaths = [
    // Standard PATH lookup
    "adb",
    // Android SDK locations
    "/usr/local/bin/adb",
    "/opt/homebrew/bin/adb",
    "~/Library/Android/sdk/platform-tools/adb",
    "~/Android/Sdk/platform-tools/adb",
    // Expanded home directory
    path.join(process.env.HOME || "", "Library/Android/sdk/platform-tools/adb"),
    path.join(process.env.HOME || "", "Android/Sdk/platform-tools/adb"),
  ];

  // First try which/where command
  try {
    const whichResult = execSync(process.platform === 'win32' ? 'where adb' : 'which adb', 
      { encoding: 'utf8', timeout: 5000 }).trim();
    if (whichResult && fs.existsSync(whichResult.split('\n')[0])) {
      console.log(`[adb] Found ADB via which/where: ${whichResult.split('\n')[0]}`);
      return whichResult.split('\n')[0];
    }
  } catch (e) {
    console.log('[adb] which/where command failed, trying common paths...');
  }

  // Try common paths
  for (const adbPath of commonPaths) {
    try {
      const expanded = adbPath.startsWith('~') 
        ? path.join(process.env.HOME || "", adbPath.slice(2))
        : adbPath;
      
      if (expanded !== 'adb' && fs.existsSync(expanded)) {
        console.log(`[adb] Found ADB at: ${expanded}`);
        return expanded;
      }
    } catch (e) {
      // Continue to next path
    }
  }

  console.log('[adb] Using default "adb" command (may fail if not in PATH)');
  return "adb";
}

let cachedAdbPath: string | null = null;
let customAdbPath: string | null = null;

export function setCustomAdbPath(path: string | null) {
  customAdbPath = path;
  cachedAdbPath = null; // Clear cache to force re-detection
}

function getAdbPath(): string {
  if (customAdbPath) {
    return customAdbPath;
  }
  if (!cachedAdbPath) {
    cachedAdbPath = findAdbPath();
  }
  return cachedAdbPath;
}

export function runAsync(
  cmd: string,
  args: string[],
  { timeoutMs = 60_000, cwd }: { timeoutMs?: number; cwd?: string } = {}
): Promise<RunResult> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });

    let out = "";
    let err = "";
    let done = false;

    const finish = (code: number) => {
      if (done) return;
      done = true;
      resolve({ code, out: out.trim(), err: err.trim() });
    };

    const to = setTimeout(() => {
      try { p.kill("SIGKILL"); } catch {}
      finish(124);
    }, timeoutMs);

    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", () => { clearTimeout(to); finish(1); });
    p.on("close", (code) => { clearTimeout(to); finish(code ?? 1); });
  });
}

export const adb  = (...args: string[]) => runAsync(getAdbPath(), args);
export const adbs = (serial: string, ...args: string[]) => runAsync(getAdbPath(), ["-s", serial, ...args]);

// Test if ADB is working
export async function testAdb(): Promise<{ working: boolean; path: string; error?: string }> {
  const adbPath = getAdbPath();
  try {
    const result = await runAsync(adbPath, ["version"], { timeoutMs: 10000 });
    if (result.code === 0) {
      console.log(`[adb] ADB is working: ${result.out.split('\n')[0]}`);
      return { working: true, path: adbPath };
    } else {
      console.error(`[adb] ADB version check failed: ${result.err}`);
      return { working: false, path: adbPath, error: result.err || `Exit code: ${result.code}` };
    }
  } catch (error) {
    console.error(`[adb] ADB test failed:`, error);
    return { working: false, path: adbPath, error: `Error: ${error}` };
  }
}

// Try to find Scrcpy in common locations
function findScrcpyPath(): string | null {
  const commonPaths = [
    // Standard PATH lookup
    "scrcpy",
    // Common installation locations
    "/usr/local/bin/scrcpy",
    "/opt/homebrew/bin/scrcpy",
    // Windows common paths
    "C:\\Program Files\\scrcpy\\scrcpy.exe",
    "C:\\Program Files (x86)\\scrcpy\\scrcpy.exe",
    // Expanded home directory
    path.join(process.env.HOME || "", "scrcpy", "scrcpy"),
  ];

  // First try which/where command
  try {
    const whichResult = execSync(process.platform === 'win32' ? 'where scrcpy' : 'which scrcpy', 
      { encoding: 'utf8', timeout: 5000 }).trim();
    if (whichResult && fs.existsSync(whichResult.split('\n')[0])) {
      console.log(`[scrcpy] Found Scrcpy via which/where: ${whichResult.split('\n')[0]}`);
      return whichResult.split('\n')[0];
    }
  } catch (e) {
    console.log('[scrcpy] which/where command failed, trying common paths...');
  }

  // Try common paths
  for (const scrcpyPath of commonPaths) {
    try {
      const expanded = scrcpyPath.startsWith('~') 
        ? path.join(process.env.HOME || "", scrcpyPath.slice(2))
        : scrcpyPath;
      
      if (expanded !== 'scrcpy' && fs.existsSync(expanded)) {
        console.log(`[scrcpy] Found Scrcpy at: ${expanded}`);
        return expanded;
      }
    } catch (e) {
      // Continue to next path
    }
  }

  console.log('[scrcpy] Scrcpy not found in common locations');
  return null;
}

// Auto-detect Scrcpy path
export async function detectScrcpyPath(): Promise<{ working: boolean; path: string; error?: string }> {
  const scrcpyPath = findScrcpyPath();
  if (!scrcpyPath) {
    return { working: false, path: '', error: 'Scrcpy not found in common locations. Please use Choose... to select manually.' };
  }
  
  return await testScrcpy(scrcpyPath);
}

// Test if Scrcpy is working
export async function testScrcpy(scrcpyPath: string): Promise<{ working: boolean; path: string; error?: string }> {
  if (!scrcpyPath) {
    return { working: false, path: '', error: 'No scrcpy path provided' };
  }

  try {
    const result = await runAsync(scrcpyPath, ["--version"], { timeoutMs: 10000 });
    if (result.code === 0) {
      console.log(`[scrcpy] Scrcpy is working: ${result.out.split('\n')[0]}`);
      return { working: true, path: scrcpyPath };
    } else {
      console.error(`[scrcpy] Scrcpy version check failed: ${result.err}`);
      return { working: false, path: scrcpyPath, error: result.err || `Exit code: ${result.code}` };
    }
  } catch (error) {
    console.error(`[scrcpy] Scrcpy test failed:`, error);
    return { working: false, path: scrcpyPath, error: `Error: ${error}` };
  }
}

export function parseDevices(out: string) {
  const lines = out.split("\n").slice(1).map(s => s.trim()).filter(Boolean);
  return lines.map((l) => {
    const parts = l.split(/\s+/);
    const serial = parts[0] ?? "";
    const state  = parts[1] ?? "";
    
    // Try to extract model name, preferring model: over device: over product:
    let name = serial; // fallback to serial
    
    const modelMatch = l.match(/model:([^\s]+)/i);
    if (modelMatch) {
      name = modelMatch[1];
    } else {
      const productMatch = l.match(/product:([^\s]+)/i);
      if (productMatch) {
        name = productMatch[1];
      } else {
        const deviceMatch = l.match(/device:([^\s]+)/i);
        if (deviceMatch) {
          name = deviceMatch[1];
        }
      }
    }
    
    return {
      serial,
      name: name.trim(),
      online: state === "device",
    };
  });
}
