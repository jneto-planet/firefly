// src/main/config.ts
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

export type FireflyConfig = {
  dir_3cxml: string;
  scrcpy_dir: string;
  auto_open_scrcpy: boolean;
  device_display_mode?: "NAME" | "ID" | "NAME + ID";
  custom_adb_path?: string;
  custom_scrcpy_path?: string;
  polling_enabled?: boolean;
  polling_interval?: number;
  xml_editor_path?: string;
  butterfly_path?: string;
  proxy_tool_path?: string;
  opi_simulator_path?: string;
  logger_client_path?: string;
  logger_client_send_params?: boolean;
  recording_bit_rate?: number;
  recording_resolution?: number;
  recording_show_taps?: boolean;
  recording_save_path?: string;
};

const DEFAULTS: FireflyConfig = {
  dir_3cxml: "",
  scrcpy_dir: "",
  auto_open_scrcpy: false,
  device_display_mode: "NAME + ID",
  custom_adb_path: "",
  custom_scrcpy_path: "",
  polling_enabled: true,
  polling_interval: 2000,
  xml_editor_path: "",
  butterfly_path: "",
  proxy_tool_path: "",
  opi_simulator_path: "",
  logger_client_path: "",
  logger_client_send_params: true,
  recording_bit_rate: 4,
  recording_resolution: 100,
  recording_show_taps: true,
  recording_save_path: "",
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
