import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

const ACCENT = "#FFD86A";

/**
 * Confirmation dialog shown before rebooting the selected device.
 * Matches the visual language of the other Firefly dialogs.
 */
export default function RebootConfirmDialog({
  deviceName,
  serial,
  rebooting,
  onConfirm,
  onCancel,
}: {
  deviceName: string;
  serial: string;
  rebooting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-60"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={rebooting ? undefined : onCancel}
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
            <RotateCcw className="h-4 w-4" color={ACCENT} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Reboot device?</div>
            <div className="text-[13px] text-white/60 mt-1">
              This will reboot{" "}
              <span className="text-white font-medium">{deviceName}</span>. The
              device will disconnect and be unavailable until it finishes
              booting.
            </div>
            <div className="text-[11px] font-mono text-white/30 mt-1 truncate">{serial}</div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={rebooting}
            className="flex-1 py-2 rounded-lg text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={rebooting}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ background: ACCENT, color: "#18181b" }}
          >
            {rebooting ? "Rebooting…" : "Reboot"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
