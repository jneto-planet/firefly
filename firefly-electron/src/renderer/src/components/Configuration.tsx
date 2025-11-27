import {
  RefreshCcw,
  Send,
  FolderOpen,
  Eye,
  Blocks,
  Search,
} from "lucide-react";

interface XmlItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

interface ConfigurationProps {
  // Status and state
  status: string;
  busy: boolean;
  
  // Directory navigation
  dir3cxml: string;
  currentDir: string;
  setCurrentDir: (dir: string) => void;
  navigateUp: () => void;
  navigateToFolder: (path: string) => void;
  onChooseDirectory: () => void;
  
  // XML data and filtering
  xmlList: XmlItem[];
  filter: string;
  setFilter: (filter: string) => void;
  selectedIdx: number | null;
  setSelectedIdx: (idx: number | null) => void;
  filteredXml: () => XmlItem[];
  filteredXmlFiles: () => XmlItem[];
  refreshXml: () => void;
  
  // Device and sending
  currentSerial: () => string | null;
  onSend: () => void;
}

const ACCENT = "#FFD86A"; // Golden accent color

export default function Configuration({
  status,
  busy,
  dir3cxml,
  currentDir,
  setCurrentDir,
  navigateUp,
  navigateToFolder,
  onChooseDirectory,
  xmlList: _xmlList,
  filter,
  setFilter,
  selectedIdx,
  setSelectedIdx,
  filteredXml,
  filteredXmlFiles,
  refreshXml,
  currentSerial,
  onSend,
}: ConfigurationProps) {
  const serial = currentSerial();
  const xml = filteredXml();
  const canSend = !!serial && selectedIdx != null && filteredXmlFiles().length > 0 && !busy;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar within content */}
      <div className="flex items-center justify-between px-6 py-4 border-b"
           style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Blocks className="h-5 w-5" color="#fff" />
          <h2 className="text-lg font-semibold text-white">Configuration</h2>
        </div>
        <div className="text-xs text-white/60">{status}</div>
      </div>

      <div className="flex-1 flex flex-col p-6 min-h-0">
        {/* Main content: file list */}
        <section className="space-y-3 flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-2">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-sm text-white/60 truncate max-w-lg">
              {!dir3cxml ? (
                <span>(3cxml folder not set)</span>
              ) : (
                <div className="flex items-center gap-1" title={currentDir}>
                  <button
                    onClick={() => setCurrentDir(dir3cxml)}
                    className="hover:text-white underline"
                  >
                    📁 Root
                  </button>
                  {currentDir !== dir3cxml && (
                    <>
                      <span>/</span>
                      <span className="truncate">
                        {currentDir.replace(dir3cxml, '').split('/').filter(Boolean).join(' / ')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Choose button - always visible */}
            <button
              onClick={onChooseDirectory}
              className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg border hover:bg-white/5 whitespace-nowrap"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
              title="Choose 3cxml folder"
            >
              <FolderOpen className="h-4 w-4" /> Choose...
            </button>
            
            {dir3cxml && (
              <>
                {/* Back button */}
                {currentDir !== dir3cxml && (
                  <button
                    onClick={navigateUp}
                    className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg border hover:bg-white/5"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                    title="Go up one level"
                  >
                    ↑ Back
                  </button>
                )}
                <button
                  onClick={() => window.firefly.revealInFileManager(currentDir)}
                  className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg border hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  <Eye className="h-4 w-4" /> Open
                </button>
                <button
                  title="Refresh templates"
                  onClick={refreshXml}
                  className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/10"
                >
                  <RefreshCcw className="h-4 w-4" color="#fff" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
              <input
                placeholder="Search…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
          </div>

          <div
            className="rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {xml.map((t, _i) => {
                    const isFolder = t.type === 'folder';
                    const fileIndex = filteredXmlFiles().findIndex(f => f.path === t.path);
                    const isSelected = !isFolder && selectedIdx === fileIndex && fileIndex >= 0;
                    
                    return (
                      <tr
                        key={t.path}
                        onClick={() => {
                          if (isFolder) {
                            navigateToFolder(t.path);
                          } else {
                            setSelectedIdx(fileIndex);
                          }
                        }}
                        className={`cursor-pointer ${isSelected ? "" : "hover:bg-white/5"}`}
                        style={{
                          background: isSelected ? "rgba(255,216,106,0.15)" : "transparent",
                          color: "#fff"
                        }}
                      >
                        <td className="px-3 py-1 font-medium flex items-center gap-2">
                          <span className="text-lg">
                            {isFolder ? "📁" : "📄"}
                          </span>
                          {t.name}
                          {isFolder && <span className="text-white/40 text-xs ml-2">→</span>}
                        </td>
                        <td className="px-3 py-1 text-right">
                          {isFolder ? (
                            <div className="flex justify-end">
                              {/* No button for folders */}
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); window.firefly.openDefault(t.path); }}
                                className="px-2 py-1 rounded-lg border hover:bg-white/5 flex items-center gap-1"
                                style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                              >
                                <Eye className="h-4 w-4" /> Edit
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {xml.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-white/60">
                        {!currentDir ? "No directory selected" : "No files or folders found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Bottom: send panel */}
        <section className="pt-4">
          <div className="flex items-center justify-end">
            {/* Send button */}
            <button
              disabled={!canSend}
              onClick={onSend}
              className="px-6 py-3 rounded-2xl flex items-center gap-2"
              style={{
                background: canSend ? ACCENT : "rgba(255,255,255,0.08)",
                color: canSend ? "#1a1a1a" : "#fff",
                opacity: busy ? 0.7 : 1,
              }}
            >
              <Send className="h-5 w-5" />
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}