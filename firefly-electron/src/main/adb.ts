// src/main/adb.ts
import { spawn } from "node:child_process";

export type RunResult = { code: number; out: string; err: string };

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

export const adb  = (...args: string[]) => runAsync("adb", args);
export const adbs = (serial: string, ...args: string[]) => runAsync("adb", ["-s", serial, ...args]);

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
