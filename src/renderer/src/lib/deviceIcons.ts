// Normalization helpers (mirror your Python)
function normKey(s: string) {
  const t = (s || "").toLowerCase().trim().replace(/-/g, " ").replace(/[^a-z0-9 ]+/g, " ");
  return t.split(/\s+/).filter(Boolean).join(" ");
}
function toSlug(s: string) {
  return normKey(s).replace(/ +/g, "_");
}

// 1) Import images (add/remove as you like)
import pax_a30 from "../assets/terminals/pax_a30.png";
import pax_a920pro from "../assets/terminals/pax_a920pro.png";
import pax_a920 from "../assets/terminals/pax_a920.png";
import pax_a35 from "../assets/terminals/pax_a35.png";
import pax_a77 from "../assets/terminals/pax_a77.png";
import pax_im30 from "../assets/terminals/pax_im30.png";
import pax_im25 from "../assets/terminals/pax_im25.png";
import pax_a6650 from "../assets/terminals/pax_a6650.png";

// 2) Explicit overrides like in Python (keys normalized!)
const MODEL_ICON_MAP: Record<string, string> = {
  "pax a30": pax_a30,
  "pax a920pro": pax_a920pro,
  "pax a920 pro": pax_a920pro,
  "pax a920": pax_a920,
  "pax a35": pax_a35,
  "pax a77": pax_a77,
  "pax im30": pax_im30,
  "pax im25": pax_im25,
  "pax a6650": pax_a6650,
};

// 3) A “virtual file system” map for heuristic filename guesses
const FILES: Record<string, string> = {
  "pax_a30.png": pax_a30,
  "pax_a920pro.png": pax_a920pro,
  "pax_a920.png": pax_a920,
  "pax_a35.png": pax_a35,
  "pax_a77.png": pax_a77,
  "pax_im30.png": pax_im30,
  "pax_im25.png": pax_im25,
  "pax_a6650.png": pax_a6650,
};

export function resolveDeviceIconByModelManu(modelRaw?: string, manuRaw?: string): string | null {
  const model = modelRaw || "";
  const manu = manuRaw || "";
  const m = normKey(model);
  const mn = normKey(manu);

  // explicit overrides
  const candidatesKeys: string[] = [];
  if (mn && m) candidatesKeys.push(`${mn} ${m}`);
  if (m) {
    candidatesKeys.push(m);
    candidatesKeys.push(`pax ${m}`);
  }
  for (const k of candidatesKeys) {
    const hit = MODEL_ICON_MAP[k];
    if (hit) return hit;
  }

  // heuristic filenames (mirror Python)
  const candidatesFiles: string[] = [];
  if (model) {
    const slug = toSlug(model);
    candidatesFiles.push(`${slug}.png`, `pax_${slug}.png`);
    if (manu) candidatesFiles.push(`${toSlug(manu)}_${slug}.png`);
  }
  if (model && manu) {
    candidatesFiles.push(`${toSlug(manu)}_${toSlug(model)}.png`);
  }
  for (const f of candidatesFiles) {
    const hit = FILES[f];
    if (hit) return hit;
  }
  return null;
}
