import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, RefreshCcw, Trash2, Package, AlertTriangle, X, Download } from "lucide-react";
import { appsCache, appsCacheKey, type AppEntry } from "../lib/appsCache";

const ACCENT = "#FFD86A";

interface AppsProps {
  currentSerial: () => string | null;
}

type Scope = "all" | "third-party";

export default function Apps({ currentSerial }: AppsProps) {
  const [apps, setApps] = React.useState<AppEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<Scope>("third-party");
  const [search, setSearch] = React.useState("");
  const [confirmUninstall, setConfirmUninstall] = React.useState<AppEntry | null>(null);
  const [uninstalling, setUninstalling] = React.useState<string | null>(null);
  const [uninstallResult, setUninstallResult] = React.useState<{ pkg: string; success: boolean; message: string } | null>(null);
  const [showInstallDialog, setShowInstallDialog] = React.useState(false);
  const [installResult, setInstallResult] = React.useState<{ success: boolean; message: string } | null>(null);

  const serial = currentSerial();

  const cacheKey = (s: string, sc: Scope) => appsCacheKey(s, sc === "third-party");

  const loadApps = React.useCallback(async (targetScope: Scope, forceRefresh = false) => {
    const s = currentSerial();
    if (!s) return;

    const key = cacheKey(s, targetScope);
    if (!forceRefresh && appsCache.has(key)) {
      setApps(appsCache.get(key)!);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setApps([]);
    try {
      const result = await window.firefly.listApps({
        serial: s,
        thirdPartyOnly: targetScope === "third-party",
      });
      if (!result.success) {
        setError(result.error ?? "Failed to load apps");
      } else {
        appsCache.set(key, result.apps);
        setApps(result.apps);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [currentSerial]);

  // Load on mount and when scope/serial changes (uses cache when available)
  React.useEffect(() => {
    if (serial) loadApps(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, scope]);

  const handleScopeChange = (newScope: Scope) => {
    if (newScope === scope || loading) return;
    setScope(newScope);
    // loadApps is triggered by the effect above
  };

  const handleUninstall = async () => {
    if (!confirmUninstall || !serial) return;
    const pkg = confirmUninstall.package;
    setConfirmUninstall(null);
    setUninstalling(pkg);
    setUninstallResult(null);
    try {
      const result = await window.firefly.uninstallApp({ serial, packageName: pkg });
      setUninstallResult({ pkg, success: result.success, message: result.message });
      if (result.success) {
        const updated = apps.filter((a) => a.package !== pkg);
        setApps(updated);
        // Keep cache in sync
        if (serial) appsCache.set(cacheKey(serial, scope), updated);
      }
    } catch (e) {
      setUninstallResult({ pkg, success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setUninstalling(null);
      setTimeout(() => setUninstallResult(null), 4000);
    }
  };

  const handleInstallDone = (result: { success: boolean; message: string }) => {
    setShowInstallDialog(false);
    setInstallResult(result);
    if (result.success && serial) {
      // Invalidate cache so the new app appears on next load
      appsCache.delete(cacheKey(serial, scope));
    }
    setTimeout(() => setInstallResult(null), 4000);
  };

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.package.toLowerCase().includes(q) ||
        a.version.toLowerCase().includes(q)
    );
  }, [apps, search]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5" color={ACCENT} />
          <span className="text-base font-semibold text-white">Apps</span>
          {!loading && apps.length > 0 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: "rgba(255,216,106,0.12)", color: ACCENT }}
            >
              {filtered.length}{filtered.length !== apps.length ? `/${apps.length}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Scope toggle */}
          <div
            className="flex items-center rounded-lg p-0.5 gap-0.5"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            {(["third-party", "all"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => handleScopeChange(s)}
                disabled={loading}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                style={
                  scope === s
                    ? { background: ACCENT, color: "#18181b" }
                    : { color: "rgba(255,255,255,0.6)" }
                }
              >
                {s === "third-party" ? "Third-party" : "All"}
              </button>
            ))}
          </div>

          {/* Install */}
          <button
            onClick={() => setShowInstallDialog(true)}
            disabled={!serial}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(255,216,106,0.12)", color: ACCENT, border: "1px solid rgba(255,216,106,0.2)" }}
          >
            <Download className="h-3.5 w-3.5" />
            Install APK
          </button>

          {/* Refresh */}
          <button
            onClick={() => loadApps(scope, true)}
            disabled={loading || !serial}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCcw className="h-4 w-4" color="rgba(255,255,255,0.7)" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" color="rgba(255,255,255,0.3)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or package…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder:text-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5" color="rgba(255,255,255,0.4)" />
            </button>
          )}
        </div>
      </div>

      {/* Toast — install result */}
      <AnimatePresence>
        {installResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
            style={{
              background: installResult.success ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${installResult.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: installResult.success ? "#86efac" : "#fca5a5",
            }}
          >
            {installResult.success ? "✓" : "✗"} {installResult.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast — uninstall result */}
      <AnimatePresence>
        {uninstallResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
            style={{
              background: uninstallResult.success
                ? "rgba(34,197,94,0.15)"
                : "rgba(239,68,68,0.15)",
              border: `1px solid ${uninstallResult.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: uninstallResult.success ? "#86efac" : "#fca5a5",
            }}
          >
            {uninstallResult.success ? "✓" : "✗"} {uninstallResult.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {!serial ? (
          <EmptyState message="No device connected" />
        ) : loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadApps(scope, true)} />
        ) : filtered.length === 0 ? (
          <EmptyState message={apps.length === 0 ? "No apps found" : "No apps match your search"} />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((app) => (
              <AppRow
                key={app.package}
                app={app}
                uninstalling={uninstalling === app.package}
                onUninstall={() => setConfirmUninstall(app)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm uninstall dialog */}
      <AnimatePresence>
        {confirmUninstall && (
          <ConfirmDialog
            app={confirmUninstall}
            onConfirm={handleUninstall}
            onCancel={() => setConfirmUninstall(null)}
          />
        )}
      </AnimatePresence>

      {/* Install APK dialog */}
      <AnimatePresence>
        {showInstallDialog && serial && (
          <InstallDialog
            serial={serial}
            onDone={handleInstallDone}
            onClose={() => setShowInstallDialog(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AppRow({
  app,
  uninstalling,
  onUninstall,
}: {
  app: AppEntry;
  uninstalling: boolean;
  onUninstall: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl group"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Icon */}
      <div
        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        {app.iconDataUrl ? (
          <img src={app.iconDataUrl} className="h-9 w-9 object-contain rounded-lg" alt="" />
        ) : (
          <Package className="h-5 w-5" color="rgba(255,255,255,0.3)" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white truncate">{app.displayName}</span>
          <span
            className="text-[10px] font-mono shrink-0"
            style={{ color: "rgba(255,216,106,0.7)" }}
          >
            v{app.version}
          </span>
        </div>
        <div className="text-[11px] font-mono text-white/40 truncate mt-0.5">{app.package}</div>
      </div>

      {/* Uninstall */}
      <button
        onClick={onUninstall}
        disabled={uninstalling}
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Uninstall"
      >
        {uninstalling ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCcw className="h-3.5 w-3.5" color="rgba(255,255,255,0.5)" />
          </motion.div>
        ) : (
          <Trash2 className="h-3.5 w-3.5" color="#f87171" />
        )}
      </button>
    </motion.div>
  );
}

function ConfirmDialog({
  app,
  onConfirm,
  onCancel,
}: {
  app: AppEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-80 rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "#27272a", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.15)" }}
          >
            <AlertTriangle className="h-4 w-4" color="#f87171" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Uninstall App</div>
            <div className="text-[13px] text-white/60 mt-1">
              Are you sure you want to uninstall{" "}
              <span className="text-white font-medium">{app.displayName}</span>?
            </div>
            <div className="text-[11px] font-mono text-white/30 mt-1">{app.package}</div>
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm text-white/70 transition hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition"
            style={{ background: "#ef4444" }}
          >
            Uninstall
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <div className="h-10 w-10 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded-full w-1/3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-2.5 rounded-full w-1/2" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        </div>
      ))}
      <div className="text-center text-xs text-white/30 mt-6 pb-2">
        Pulling APKs from device… this may take a moment
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <Package className="h-8 w-8" color="rgba(255,255,255,0.15)" />
      <span className="text-sm text-white/40">{message}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <AlertTriangle className="h-7 w-7" color="#f87171" />
      <span className="text-sm text-white/60 text-center max-w-xs">{message}</span>
      <button
        onClick={onRetry}
        className="mt-1 px-4 py-1.5 rounded-lg text-xs font-medium text-white transition hover:bg-white/10"
        style={{ border: "1px solid rgba(255,255,255,0.15)" }}
      >
        Retry
      </button>
    </div>
  );
}

function InstallDialog({
  serial,
  onDone,
  onClose,
}: {
  serial: string;
  onDone: (result: { success: boolean; message: string }) => void;
  onClose: () => void;
}) {
  const [apkPath, setApkPath] = React.useState("");
  const [installing, setInstalling] = React.useState(false);

  const handleBrowse = async () => {
    const picked = await window.firefly.pickFile({ title: "Select APK", fileType: "any" });
    if (picked) setApkPath(picked);
  };

  const handleInstall = async () => {
    if (!apkPath.trim()) return;
    setInstalling(true);
    try {
      const result = await window.firefly.installApp({ serial, apkPath: apkPath.trim() });
      onDone(result);
    } catch (e) {
      onDone({ success: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Install APK</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" color="#fff" />
          </button>
        </div>

        {/* Path row */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">APK Path</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={apkPath}
              onChange={(e) => setApkPath(e.target.value)}
              placeholder="/path/to/app.apk"
              className="flex-1 px-3 py-2 rounded-lg text-white text-sm font-mono placeholder:text-white/30 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
            <button
              onClick={handleBrowse}
              disabled={installing}
              className="px-3 py-2 rounded-lg text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-40 shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={installing}
            className="px-4 py-2 text-sm rounded-lg hover:bg-white/5 transition disabled:opacity-50"
            style={{ color: "#fff" }}
          >
            Cancel
          </button>
          <button
            onClick={handleInstall}
            disabled={installing || !apkPath.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#FFD86A", color: "#000" }}
          >
            {installing && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </motion.div>
            )}
            {installing ? "Installing…" : "Install"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
