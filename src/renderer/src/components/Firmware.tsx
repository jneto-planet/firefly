import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardDriveDownload,
  UploadCloud,
  FileArchive,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Power,
  Play,
} from "lucide-react";
import DowngradeDialog, { type DowngradeInfo } from "./DowngradeDialog";

const ACCENT = "#FFD86A";
const REBOOT_TIMEOUT_MS = 60_000;

interface FirmwareProps {
  currentSerial: () => string | null;
}

interface Bundle {
  filename: string;
  order: number;
  md5: string | null;
  reboot: boolean;
  apkPath: string;
}

interface FirmwarePlan {
  label: string;
  tempDir: string;
  bundles: Bundle[];
}

type BundleState =
  | "pending"
  | "verifying"
  | "installing"
  | "rebooting"
  | "done"
  | "failed"
  | "skipped";

interface BundleStatus {
  state: BundleState;
  message?: string;
}

export default function Firmware({ currentSerial }: FirmwareProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<FirmwarePlan | null>(null);
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [running, setRunning] = React.useState(false);
  const [statuses, setStatuses] = React.useState<Record<string, BundleStatus>>({});
  const [finished, setFinished] = React.useState<{ success: boolean; message: string } | null>(null);
  const [downgrade, setDowngrade] = React.useState<DowngradeInfo | null>(null);

  const serial = currentSerial();
  const downgradeResolver = React.useRef<((decision: "update" | "skip") => void) | null>(null);

  const reset = () => {
    setError(null);
    setPlan(null);
    setExcluded(new Set());
    setRunning(false);
    setStatuses({});
    setFinished(null);
    setDowngrade(null);
  };

  const validateZip = async (zipPath: string) => {
    if (!zipPath.toLowerCase().endsWith(".zip")) {
      setError("Only .zip firmware packages are accepted.");
      return;
    }
    setValidating(true);
    setError(null);
    setPlan(null);
    setStatuses({});
    setFinished(null);
    try {
      const result = await window.firefly.validateFirmware({ zipPath });
      if (!result.success || !result.bundles || !result.label || !result.tempDir) {
        setError(result.error || "Invalid firmware package.");
        return;
      }
      setPlan({ label: result.label, tempDir: result.tempDir, bundles: result.bundles });
      setExcluded(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (validating || running) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const filePath = window.firefly.getPathForFile(file);
    if (!filePath) {
      setError("Could not read the dropped file path.");
      return;
    }
    await validateZip(filePath);
  };

  const handleBrowse = async () => {
    if (validating || running) return;
    const picked = await window.firefly.pickFile({ title: "Select firmware .zip", fileType: "zip" });
    if (picked) await validateZip(picked);
  };

  const toggleExclude = (filename: string) => {
    if (running) return;
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const setStatus = (filename: string, state: BundleState, message?: string) =>
    setStatuses((prev) => ({ ...prev, [filename]: { state, message } }));

  const askDowngrade = (info: DowngradeInfo): Promise<"update" | "skip"> =>
    new Promise((resolve) => {
      downgradeResolver.current = resolve;
      setDowngrade(info);
    });

  const resolveDowngrade = (decision: "update" | "skip") => {
    setDowngrade(null);
    const resolver = downgradeResolver.current;
    downgradeResolver.current = null;
    resolver?.(decision);
  };

  const includedBundles = React.useMemo(
    () => (plan ? plan.bundles.filter((b) => !excluded.has(b.filename)) : []),
    [plan, excluded]
  );

  const startUpdate = async () => {
    if (!plan) return;
    const s = currentSerial();
    if (!s) return;
    const included = plan.bundles.filter((b) => !excluded.has(b.filename));
    if (included.length === 0) return;

    setRunning(true);
    setFinished(null);
    // Reset statuses: included -> pending, excluded -> skipped
    const initial: Record<string, BundleStatus> = {};
    for (const b of plan.bundles) {
      initial[b.filename] = excluded.has(b.filename) ? { state: "skipped" } : { state: "pending" };
    }
    setStatuses(initial);

    try {
      for (const bundle of included) {
        // 1. MD5 verification
        setStatus(bundle.filename, "verifying");
        const md5res = await window.firefly.verifyFirmwareMd5({
          apkPath: bundle.apkPath,
          expectedMd5: bundle.md5 ?? undefined,
        });
        if (!md5res.success || !md5res.match) {
          setStatus(bundle.filename, "failed", "MD5 mismatch");
          setFinished({ success: false, message: `MD5 verification failed for ${bundle.filename}.` });
          return;
        }

        // 2. Version check (downgrade detection)
        const ver = await window.firefly.checkApkVersion({ serial: s, apkPath: bundle.apkPath });
        let allowDowngrade = false;
        if (ver.success && ver.isDowngrade && ver.package) {
          const decision = await askDowngrade({
            package: ver.package,
            displayName: bundle.filename,
            installedVersionName: ver.installedVersionName,
            installedVersionCode: ver.installedVersionCode,
            apkVersionName: ver.apkVersionName,
            apkVersionCode: ver.apkVersionCode,
          });
          if (decision === "skip") {
            setStatus(bundle.filename, "skipped", "Skipped (older version)");
            continue;
          }
          allowDowngrade = true;
        }

        // 3. Install
        setStatus(bundle.filename, "installing");
        const installRes = await window.firefly.installApp({
          serial: s,
          apkPath: bundle.apkPath,
          allowDowngrade,
          packageName: ver.success ? ver.package : undefined,
        });
        // A reboot bundle can reboot the device while the APK is still being
        // applied, which drops the adb connection and makes `adb install` report
        // an error even though the install actually succeeded. For those bundles,
        // defer the failure decision until the device is back and we can verify
        // the installed version.
        if (!installRes.success && !bundle.reboot) {
          setStatus(bundle.filename, "failed", installRes.message);
          setFinished({ success: false, message: `Install failed for ${bundle.filename}: ${installRes.message}` });
          return;
        }

        // 4. Reboot if required
        if (bundle.reboot) {
          setStatus(bundle.filename, "rebooting");
          const rb = await window.firefly.firmwareRebootWait({ serial: s, timeoutMs: REBOOT_TIMEOUT_MS });
          if (!rb.success) {
            setStatus(bundle.filename, "failed", rb.error);
            setFinished({ success: false, message: `Reboot failed after ${bundle.filename}: ${rb.error}` });
            return;
          }

          // If the install command reported a failure, the device most likely
          // rebooted mid-install. Now that it's back online, verify the APK
          // actually installed at the expected version before declaring failure.
          if (!installRes.success && ver.success && ver.package) {
            const recheck = await window.firefly.checkApkVersion({ serial: s, apkPath: bundle.apkPath });
            const verified =
              recheck.success &&
              recheck.installed === true &&
              (recheck.apkVersionCode == null ||
                recheck.installedVersionCode == null ||
                recheck.installedVersionCode >= recheck.apkVersionCode);
            if (!verified) {
              setStatus(bundle.filename, "failed", installRes.message);
              setFinished({ success: false, message: `Install failed for ${bundle.filename}: ${installRes.message}` });
              return;
            }
          }
        }

        setStatus(bundle.filename, "done");
      }

      setFinished({ success: true, message: "Firmware update completed successfully." });
    } catch (e) {
      setFinished({ success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
      if (plan.tempDir) window.firefly.firmwareCleanup({ tempDir: plan.tempDir });
    }
  };

  const allExcluded = plan != null && includedBundles.length === 0;

  return (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <HardDriveDownload className="h-5 w-5" color="#fff" />
          <span className="text-base font-semibold text-white">Firmware</span>
          {plan && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-mono truncate max-w-[280px]"
              style={{ background: "rgba(255,216,106,0.12)", color: ACCENT }}
              title={plan.label}
            >
              {plan.label}
            </span>
          )}
        </div>
        {plan && !running && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 transition hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Start over
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {!plan ? (
          <DropZone
            dragOver={dragOver}
            validating={validating}
            error={error}
            onDragOver={(e) => {
              e.preventDefault();
              if (!validating) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onBrowse={handleBrowse}
          />
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Device warning — hidden while an update is running (e.g. during a reboot) */}
            {!serial && !running && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Connect a device to start the firmware update.
              </div>
            )}

            {/* Bundle list */}
            <div className="space-y-2">
              {plan.bundles.map((bundle) => (
                <BundleRow
                  key={bundle.filename}
                  bundle={bundle}
                  excluded={excluded.has(bundle.filename)}
                  status={statuses[bundle.filename]}
                  running={running}
                  onToggle={() => toggleExclude(bundle.filename)}
                />
              ))}
            </div>

            {/* Footer / actions */}
            {finished ? (
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: finished.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${finished.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}
              >
                {finished.success ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" color="#4ade80" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0" color="#f87171" />
                )}
                <span className="text-sm" style={{ color: finished.success ? "#86efac" : "#fca5a5" }}>
                  {finished.message}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-white/40">
                  {includedBundles.length} of {plan.bundles.length} bundle
                  {plan.bundles.length === 1 ? "" : "s"} selected
                </span>
                <button
                  onClick={startUpdate}
                  disabled={running || !serial || allExcluded}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: ACCENT, color: "#18181b" }}
                  title={allExcluded ? "Select at least one bundle" : undefined}
                >
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {running ? "Updating…" : "Start firmware update"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Downgrade prompt */}
      <AnimatePresence>
        {downgrade && (
          <DowngradeDialog
            info={downgrade}
            onUpdateAnyway={() => resolveDowngrade("update")}
            onSkip={() => resolveDowngrade("skip")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DropZone({
  dragOver,
  validating,
  error,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
}: {
  dragOver: boolean;
  validating: boolean;
  error: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <button
        type="button"
        onClick={onBrowse}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={validating}
        className="w-full flex flex-col items-center justify-center gap-4 rounded-2xl py-20 px-6 transition"
        style={{
          background: dragOver ? "rgba(255,216,106,0.08)" : "rgba(255,255,255,0.03)",
          border: `2px dashed ${dragOver ? ACCENT : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,216,106,0.1)" }}
        >
          {validating ? (
            <Loader2 className="h-8 w-8 animate-spin" color={ACCENT} />
          ) : (
            <UploadCloud className="h-8 w-8" color={ACCENT} />
          )}
        </div>
        <div className="text-center">
          <div className="text-base font-medium text-white">
            {validating ? "Validating package…" : "Drop a firmware .zip here"}
          </div>
          <div className="text-sm text-white/40 mt-1">
            {validating ? "Reading manifest.xml" : "or click to choose a file"}
          </div>
        </div>
      </button>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 mt-4 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function BundleRow({
  bundle,
  excluded,
  status,
  running,
  onToggle,
}: {
  bundle: Bundle;
  excluded: boolean;
  status?: BundleStatus;
  running: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: excluded ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.05)",
        opacity: excluded ? 0.5 : 1,
      }}
    >
      {/* Order badge */}
      <div
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-xs font-mono font-semibold"
        style={{ background: "rgba(255,216,106,0.12)", color: ACCENT }}
      >
        {bundle.order}
      </div>

      {/* Icon */}
      <FileArchive className="h-4 w-4 shrink-0" color="rgba(255,255,255,0.4)" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${excluded ? "text-white/50 line-through" : "text-white"}`}
          >
            {bundle.filename}
          </span>
          {bundle.reboot && (
            <span
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: "rgba(96,165,250,0.15)", color: "#93c5fd" }}
            >
              <Power className="h-2.5 w-2.5" />
              reboot
            </span>
          )}
        </div>
        {status?.message && (
          <div className="text-[11px] text-white/40 mt-0.5 truncate">{status.message}</div>
        )}
      </div>

      {/* Status / toggle */}
      <div className="shrink-0">
        {status && status.state !== "pending" ? (
          <StatusBadge status={status} />
        ) : (
          <button
            onClick={onToggle}
            disabled={running}
            className="relative h-5 w-9 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: excluded ? "rgba(255,255,255,0.12)" : ACCENT }}
            title={excluded ? "Include bundle" : "Ignore bundle"}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
              style={{ left: excluded ? "2px" : "18px" }}
            />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: BundleStatus }) {
  switch (status.state) {
    case "verifying":
      return <Spinner label="Verifying" />;
    case "installing":
      return <Spinner label="Installing" />;
    case "rebooting":
      return <Spinner label="Rebooting" icon={<RefreshCw className="h-3.5 w-3.5 animate-spin" color="#93c5fd" />} color="#93c5fd" />;
    case "done":
      return (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#86efac" }}>
          <CheckCircle2 className="h-4 w-4" />
          Done
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#f87171" }}>
          <XCircle className="h-4 w-4" />
          Failed
        </span>
      );
    case "skipped":
      return <span className="text-xs text-white/40">Skipped</span>;
    default:
      return null;
  }
}

function Spinner({ label, icon, color = ACCENT }: { label: string; icon?: React.ReactNode; color?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
      {icon ?? <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </span>
  );
}
