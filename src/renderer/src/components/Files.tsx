import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCcw,
  Trash2,
  AlertTriangle,
  X,
  Download,
  Upload,
  Folder,
  File as FileIcon,
  Link2,
  CornerLeftUp,
  ChevronRight,
  Plus,
} from "lucide-react";

const ACCENT = "#FFD86A";
const ROOT = "/";
const DEFAULT_PATH = ROOT;

interface Shortcut {
  label: string;
  path: string;
}

const BUILTIN_SHORTCUTS: Shortcut[] = [
  { label: "Root", path: "/" },
  { label: "IntegraTE", path: "/data/data/com.cccintegra.pax" },
];

type EntryType = "file" | "directory" | "link" | "other";

interface FileEntry {
  name: string;
  path: string;
  type: EntryType;
  size: number | null;
  modified: string | null;
  permissions: string;
  linkTarget: string | null;
}

interface FilesProps {
  currentSerial: () => string | null;
}

const parentOf = (p: string): string => {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return ROOT;
  return trimmed.slice(0, idx);
};

const formatSize = (bytes: number | null): string => {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

export default function Files({ currentSerial }: FilesProps) {
  const [path, setPath] = React.useState(DEFAULT_PATH);
  const [pathDraft, setPathDraft] = React.useState(DEFAULT_PATH);
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<FileEntry | null>(null);
  const [busyPath, setBusyPath] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [toast, setToast] = React.useState<{ success: boolean; message: string } | null>(null);
  const [customShortcuts, setCustomShortcuts] = React.useState<Shortcut[]>([]);
  const [showAddShortcut, setShowAddShortcut] = React.useState(false);

  const serial = currentSerial();
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // currentSerial is re-created on every parent render; keep it out of hook deps.
  const serialRef = React.useRef(currentSerial);
  serialRef.current = currentSerial;

  const showToast = React.useCallback((success: boolean, message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ success, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  React.useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const load = React.useCallback(async (targetPath: string) => {
    const s = serialRef.current();
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.firefly.fsList({ serial: s, path: targetPath });
      if (!result.success) {
        setEntries([]);
        setError(result.error ?? "Failed to list directory");
      } else {
        setEntries(result.entries);
      }
    } catch (e) {
      setEntries([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setPathDraft(path);
    if (serial) load(path);
    else setEntries([]);
  }, [serial, path, load]);

  React.useEffect(() => {
    window.firefly
      .getConfig()
      .then((cfg) => setCustomShortcuts(cfg.file_shortcuts ?? []))
      .catch(() => setCustomShortcuts([]));
  }, []);

  const persistShortcuts = (next: Shortcut[]) => {
    setCustomShortcuts(next);
    window.firefly.setConfig({ file_shortcuts: next }).catch(() => {
      showToast(false, "Could not save shortcut");
    });
  };

  const handleAddShortcut = (shortcut: Shortcut) => {
    setShowAddShortcut(false);
    const isBuiltin = BUILTIN_SHORTCUTS.some((s) => s.path === shortcut.path);
    if (isBuiltin || customShortcuts.some((s) => s.path === shortcut.path)) {
      showToast(false, "A shortcut for that folder already exists");
      return;
    }
    persistShortcuts([...customShortcuts, shortcut]);
  };

  const handleRemoveShortcut = (shortcut: Shortcut) => {
    persistShortcuts(customShortcuts.filter((s) => s.path !== shortcut.path));
  };

  const navigate = (target: string) => {
    setSearch("");
    setPath(target || ROOT);
  };

  const handleOpen = (entry: FileEntry) => {
    if (entry.type === "directory" || entry.type === "link") navigate(entry.path);
  };

  const handleDownload = async (entry: FileEntry) => {
    if (!serial) return;
    setBusyPath(entry.path);
    try {
      const result = await window.firefly.fsPull({
        serial,
        path: entry.path,
        isDirectory: entry.type === "directory",
      });
      if (!result.canceled) showToast(result.success, result.message);
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPath(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || !serial) return;
    const entry = confirmDelete;
    setConfirmDelete(null);
    setBusyPath(entry.path);
    try {
      const result = await window.firefly.fsDelete({
        serial,
        path: entry.path,
        isDirectory: entry.type === "directory",
      });
      showToast(result.success, result.message);
      if (result.success) setEntries((prev) => prev.filter((e) => e.path !== entry.path));
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPath(null);
    }
  };

  const handleUpload = async () => {
    if (!serial) return;
    setUploading(true);
    try {
      const result = await window.firefly.fsPush({ serial, remoteDir: path });
      if (!result.canceled) {
        showToast(result.success, result.message);
        if (result.success) load(path);
      }
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, search]);

  const segments = React.useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return parts.map((name, i) => ({ name, path: `/${parts.slice(0, i + 1).join("/")}` }));
  }, [path]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5" color="#fff" />
          <span className="text-base font-semibold text-white">Files</span>
          {!loading && entries.length > 0 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: "rgba(255,216,106,0.12)", color: ACCENT }}
            >
              {filtered.length}{filtered.length !== entries.length ? `/${entries.length}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Upload */}
          <button
            onClick={handleUpload}
            disabled={!serial || uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(255,216,106,0.12)", color: ACCENT, border: "1px solid rgba(255,216,106,0.2)" }}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload"}
          </button>

          {/* Refresh */}
          <button
            onClick={() => load(path)}
            disabled={loading || !serial}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Refresh"
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

      {/* Shortcuts */}
      <div
        className="flex items-center gap-2 px-6 py-2.5 shrink-0 overflow-x-auto"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {BUILTIN_SHORTCUTS.map((s) => (
            <button
              key={s.path}
              onClick={() => navigate(s.path)}
              disabled={loading || !serial}
              title={s.path}
              className="px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
              style={
                path === s.path
                  ? { background: ACCENT, color: "#18181b" }
                  : { color: "rgba(255,255,255,0.6)" }
              }
            >
              {s.label}
            </button>
          ))}

          {customShortcuts.map((s) => (
            <div key={s.path} className="relative group/shortcut">
              <button
                onClick={() => navigate(s.path)}
                disabled={loading || !serial}
                title={s.path}
                className="px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
                style={
                  path === s.path
                    ? { background: ACCENT, color: "#18181b" }
                    : { color: "rgba(255,255,255,0.6)" }
                }
              >
                {s.label}
              </button>
              <button
                onClick={() => handleRemoveShortcut(s)}
                title="Remove shortcut"
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full items-center justify-center hidden group-hover/shortcut:flex"
                style={{ background: "#ef4444" }}
              >
                <X className="h-2.5 w-2.5" color="#fff" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setShowAddShortcut(true)}
            title="Add shortcut"
            className="h-6 w-6 rounded-md flex items-center justify-center transition hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" color="rgba(255,255,255,0.6)" />
          </button>
        </div>
      </div>

      {/* Breadcrumb / path bar */}
      <div
        className="flex items-center gap-2 px-6 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <button
          onClick={() => navigate(parentOf(path))}
          disabled={path === ROOT || loading || !serial}
          className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Up one level"
        >
          <CornerLeftUp className="h-3.5 w-3.5" color="rgba(255,255,255,0.7)" />
        </button>

        <div
          className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto rounded-lg px-2 py-1"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <button
            onClick={() => navigate(ROOT)}
            className="px-1.5 py-0.5 rounded text-xs font-mono shrink-0 transition hover:bg-white/10"
            style={{ color: segments.length === 0 ? ACCENT : "rgba(255,255,255,0.5)" }}
          >
            /
          </button>
          {segments.map((seg, i) => (
            <React.Fragment key={seg.path}>
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" color="rgba(255,255,255,0.2)" />}
              <button
                onClick={() => navigate(seg.path)}
                className="px-1.5 py-0.5 rounded text-xs font-mono shrink-0 truncate transition hover:bg-white/10"
                style={{ color: i === segments.length - 1 ? ACCENT : "rgba(255,255,255,0.5)" }}
              >
                {seg.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <form
          className="shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(pathDraft.trim());
          }}
        >
          <input
            type="text"
            value={pathDraft}
            onChange={(e) => setPathDraft(e.target.value)}
            placeholder="/sdcard"
            spellCheck={false}
            className="w-56 px-3 py-1.5 rounded-lg text-xs font-mono text-white placeholder:text-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </form>
      </div>

      {/* Search */}
      <div className="px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" color="rgba(255,255,255,0.3)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files in this folder…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder:text-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5" color="rgba(255,255,255,0.4)" />
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm break-all"
            style={{
              background: toast.success ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${toast.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: toast.success ? "#86efac" : "#fca5a5",
            }}
          >
            {toast.success ? "✓" : "✗"} {toast.message}
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
          <ErrorState message={error} onRetry={() => load(path)} />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={entries.length === 0 ? "This folder is empty" : "No files match your search"}
          />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((entry) => (
              <FileRow
                key={entry.path}
                entry={entry}
                busy={busyPath === entry.path}
                onOpen={() => handleOpen(entry)}
                onDownload={() => handleDownload(entry)}
                onDelete={() => setConfirmDelete(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            entry={confirmDelete}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </AnimatePresence>

      {/* Add shortcut dialog */}
      <AnimatePresence>
        {showAddShortcut && (
          <AddShortcutDialog
            currentPath={path}
            onAdd={handleAddShortcut}
            onClose={() => setShowAddShortcut(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EntryIcon({ type }: { type: EntryType }) {
  if (type === "directory") return <Folder className="h-5 w-5" color={ACCENT} />;
  if (type === "link") return <Link2 className="h-5 w-5" color="rgba(255,255,255,0.45)" />;
  return <FileIcon className="h-5 w-5" color="rgba(255,255,255,0.3)" />;
}

function FileRow({
  entry,
  busy,
  onOpen,
  onDownload,
  onDelete,
}: {
  entry: FileEntry;
  busy: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const navigable = entry.type === "directory" || entry.type === "link";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={navigable ? onOpen : undefined}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl group ${navigable ? "cursor-pointer" : ""}`}
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Icon */}
      <div
        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <EntryIcon type={entry.type} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white truncate">{entry.name}</span>
          {entry.type === "file" && (
            <span className="text-[10px] font-mono shrink-0" style={{ color: "rgba(255,216,106,0.7)" }}>
              {formatSize(entry.size)}
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono text-white/40 truncate mt-0.5">
          {entry.permissions}
          {entry.modified ? ` · ${entry.modified}` : ""}
          {entry.linkTarget ? ` → ${entry.linkTarget}` : ""}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {busy ? (
          <div className="h-8 w-8 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCcw className="h-3.5 w-3.5" color="rgba(255,255,255,0.5)" />
            </motion.div>
          </div>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:bg-white/10"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" color="rgba(255,255,255,0.7)" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:bg-red-500/20"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" color="#f87171" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function ConfirmDialog({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: FileEntry;
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
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">
              Delete {entry.type === "directory" ? "Folder" : "File"}
            </div>
            <div className="text-[13px] text-white/60 mt-1">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium break-all">{entry.name}</span>?
              {entry.type === "directory" && " All of its contents will be removed."}
            </div>
            <div className="text-[11px] font-mono text-white/30 mt-1 break-all">{entry.path}</div>
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
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddShortcutDialog({
  currentPath,
  onAdd,
  onClose,
}: {
  currentPath: string;
  onAdd: (shortcut: Shortcut) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [shortcutPath, setShortcutPath] = React.useState(currentPath);

  const normalizedPath = shortcutPath.trim().replace(/\/+$/, "") || ROOT;
  const canSave = label.trim().length > 0 && shortcutPath.trim().startsWith("/");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onAdd({ label: label.trim(), path: normalizedPath });
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
      <motion.form
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Add Shortcut</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" color="#fff" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">Name</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My folder"
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-white text-sm placeholder:text-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">Device Path</label>
          <input
            type="text"
            value={shortcutPath}
            onChange={(e) => setShortcutPath(e.target.value)}
            placeholder="/sdcard/Download"
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg text-white text-sm font-mono placeholder:text-white/30 outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          <button
            type="button"
            onClick={() => setShortcutPath(currentPath)}
            className="text-[11px] font-mono transition hover:underline"
            style={{ color: ACCENT }}
          >
            Use current folder ({currentPath})
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-white/5 transition"
            style={{ color: "#fff" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="px-4 py-2 text-sm rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: ACCENT, color: "#000" }}
          >
            Add
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function LoadingSkeleton() {  return (
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
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <Folder className="h-8 w-8" color="rgba(255,255,255,0.15)" />
      <span className="text-sm text-white/40">{message}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <AlertTriangle className="h-7 w-7" color="#f87171" />
      <span className="text-sm text-white/60 text-center max-w-md break-all">{message}</span>
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
