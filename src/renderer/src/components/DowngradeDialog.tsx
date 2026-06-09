import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

const ACCENT = "#FFD86A";

export interface DowngradeInfo {
  /** Package name of the app being installed. */
  package: string;
  /** Display name / filename shown to the user. */
  displayName: string;
  /** Version currently installed on the device. */
  installedVersionName?: string | null;
  installedVersionCode?: number | null;
  /** Version contained in the APK being installed. */
  apkVersionName?: string | null;
  apkVersionCode?: number | null;
}

/**
 * Reusable confirmation dialog shown when the APK being installed has a lower
 * version than the one currently installed on the device.
 *
 * "Update anyway" makes it explicit that the existing app will be uninstalled
 * first (required for a downgrade). "Skip" leaves the device app untouched.
 */
export default function DowngradeDialog({
  info,
  onUpdateAnyway,
  onSkip,
}: {
  info: DowngradeInfo;
  onUpdateAnyway: () => void;
  onSkip: () => void;
}) {
  const installed = formatVersion(info.installedVersionName, info.installedVersionCode);
  const incoming = formatVersion(info.apkVersionName, info.apkVersionCode);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-60"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,216,106,0.15)" }}
          >
            <AlertTriangle className="h-4 w-4" color={ACCENT} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Older version detected</div>
            <div className="text-[13px] text-white/60 mt-1">
              The version of{" "}
              <span className="text-white font-medium">{info.displayName}</span>{" "}
              you are installing is older than the one on the device.
            </div>
            <div className="text-[11px] font-mono text-white/30 mt-1 truncate">{info.package}</div>
          </div>
        </div>

        {/* Version comparison */}
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex flex-col">
            <span className="text-white/40">On device</span>
            <span className="font-mono text-white/80">{installed}</span>
          </div>
          <span className="text-white/30">→</span>
          <div className="flex flex-col text-right">
            <span className="text-white/40">Installing</span>
            <span className="font-mono" style={{ color: ACCENT }}>{incoming}</span>
          </div>
        </div>

        <div
          className="rounded-lg px-3 py-2 text-[12px]"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          Choosing “Update anyway” will <span className="font-semibold">uninstall the app on the device</span> first, then install this version.
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onSkip}
            className="flex-1 py-2 rounded-lg text-sm text-white/70 transition hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Skip this APK
          </button>
          <button
            onClick={onUpdateAnyway}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition"
            style={{ background: ACCENT, color: "#18181b" }}
          >
            Update anyway
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatVersion(name?: string | null, code?: number | null): string {
  if (name && code != null) return `${name} (${code})`;
  if (name) return name;
  if (code != null) return String(code);
  return "unknown";
}
