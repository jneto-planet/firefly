// src/main/config.ts
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

export type FireflyConfig = {
  dir_3cxml: string;
  scrcpy_dir: string;
  auto_open_scrcpy: boolean;
  device_display_mode?: "NAME" | "ID" | "NAME + ID";
};

const DEFAULTS: FireflyConfig = {
  dir_3cxml: "",
  scrcpy_dir: "",
  auto_open_scrcpy: false,
  device_display_mode: "NAME + ID",
};

const CONFIG_PATH = path.join(app.getPath("userData"), "firefly-config.json");

export async function loadConfig(): Promise<FireflyConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveConfig(patch: Partial<FireflyConfig>) {
  const cur = await loadConfig();
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ ...cur, ...patch }, null, 2));
}
