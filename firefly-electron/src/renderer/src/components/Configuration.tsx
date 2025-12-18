import React from "react";
import {
  RefreshCcw,
  Send,
  FolderOpen,
  Eye,
  Blocks,
  Search,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Folder,
  FileText,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./Tooltip";

interface XmlItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

interface ConfigurationProps {
  // Status and state
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
  selectedPath: string | null;
  setSelectedPath: (path: string | null) => void;
  filteredXml: () => XmlItem[];
  filteredXmlFiles: () => XmlItem[];
  refreshXml: () => void;
  
  // Device and sending
  currentSerial: () => string | null;
  onSend: () => void;
  onGetConfigFromTerminal: () => void;
  
  // Configuration settings
  onOpenConfigSettings: () => void;
}

const ACCENT = "#FFD86A"; // Golden accent color

export default function Configuration({
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
  selectedPath,
  setSelectedPath,
  filteredXml,
  filteredXmlFiles,
  refreshXml,
  currentSerial,
  onSend,
  onGetConfigFromTerminal,
  onOpenConfigSettings,
}: ConfigurationProps) {
  const serial = currentSerial();
  const xml = filteredXml();
  const canSend = !!serial && selectedPath != null && !busy;
  const canGetConfig = !!serial && !busy;

  // State for expanded folders
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = React.useState<Map<string, XmlItem[]>>(new Map());

  // Toggle folder expansion
  const toggleFolder = async (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (expandedFolders.has(folderPath)) {
      // Collapse folder
      const newExpanded = new Set(expandedFolders);
      newExpanded.delete(folderPath);
      setExpandedFolders(newExpanded);
    } else {
      // Expand folder - load contents if not already loaded
      if (!folderContents.has(folderPath)) {
        try {
          const contents = await window.firefly.listXml(folderPath);
          const newContents = new Map(folderContents);
          newContents.set(folderPath, contents);
          setFolderContents(newContents);
        } catch (err) {
          console.error("Failed to load folder contents:", err);
          return;
        }
      }
      
      const newExpanded = new Set(expandedFolders);
      newExpanded.add(folderPath);
      setExpandedFolders(newExpanded);
    }
  };

  // Recursive component to render items at any depth
  const renderItem = (item: XmlItem, depth: number = 0): React.ReactNode => {
    const isFolder = item.type === 'folder';
    const fileIndex = filteredXmlFiles().findIndex(f => f.path === item.path);
    const isSelected = !isFolder && selectedPath === item.path;
    const isExpanded = isFolder && expandedFolders.has(item.path);
    const nestedItems = isExpanded ? folderContents.get(item.path) || [] : [];
    const paddingLeft = `${depth * 2}rem`;

    return (
      <React.Fragment key={item.path}>
        <tr
          onClick={() => {
            if (isFolder) {
              navigateToFolder(item.path);
            } else {
              setSelectedIdx(fileIndex);
              setSelectedPath(item.path);
            }
          }}
          onDoubleClick={() => {
            if (!isFolder) {
              window.firefly.openDefault(item.path);
            }
          }}
          className={`cursor-pointer ${isSelected ? "" : "hover:bg-white/5"}`}
          style={{
            background: isSelected ? "rgba(255,216,106,0.15)" : "transparent",
            color: "#fff"
          }}
        >
          <td className="px-3 py-1 font-medium">
            <div className="flex items-center gap-2" style={{ paddingLeft }}>
              {isFolder && (
                <button
                  onClick={(e) => toggleFolder(item.path, e)}
                  className="hover:bg-white/10 rounded p-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              {!isFolder && <span className="w-5" />}
              {isFolder ? (
                <Folder className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {item.name}
            </div>
          </td>
          <td className="px-3 py-1 text-right">
            {!isFolder && (
              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); window.firefly.openDefault(item.path); }}
                  className="px-2 py-1 rounded-lg border hover:bg-white/5 flex items-center gap-1"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  <Eye className="h-4 w-4" /> Edit
                </button>
              </div>
            )}
          </td>
        </tr>
        {/* Recursively render nested items */}
        {isExpanded && nestedItems.map((nestedItem) => renderItem(nestedItem, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <TooltipProvider delayDuration={500}>
      <div className="h-full flex flex-col">
      {/* Top bar within content */}
      <div className="flex items-center justify-between px-6 py-4 border-b"
           style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Blocks className="h-5 w-5" color="#fff" />
          <h2 className="text-lg font-semibold text-white">Configuration</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
            <input
              placeholder="Search…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-1.5 rounded-lg outline-none text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          {/* Settings button */}
          <button
            onClick={onOpenConfigSettings}
            className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/10"
            title="Configuration Settings"
          >
            <motion.div
              className="w-full h-full flex items-center justify-center"
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <Settings className="h-5 w-5" color="#fff" />
            </motion.div>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 min-h-0">
        {/* Main content: file list */}
        <section className="space-y-3 flex flex-col flex-1 min-h-0">
          {/* Breadcrumbs path with action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Back button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={navigateUp}
                    disabled={!dir3cxml || currentDir === dir3cxml}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 shrink-0"
                    style={{ 
                      opacity: (!dir3cxml || currentDir === dir3cxml) ? 0.3 : 1
                    }}
                  >
                    <motion.div
                      className="w-full h-full flex items-center justify-center"
                      whileHover={dir3cxml && currentDir !== dir3cxml ? { x: -2 } : {}}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronLeft 
                        className="h-4 w-4" 
                        color="#fff"
                      />
                    </motion.div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Go back</TooltipContent>
              </Tooltip>
              
              <div className="flex items-center gap-1 text-sm text-white/60 flex-1 min-w-0">
              {!dir3cxml ? (
                <span>(3cxml folder not set)</span>
              ) : (
                <div className="flex items-center gap-1 truncate" title={currentDir}>
                  <button
                    onClick={() => setCurrentDir(dir3cxml)}
                    className="hover:text-white underline shrink-0 flex items-center gap-1"
                  >
                    <Folder className="h-4 w-4" /> Root
                  </button>
                  {currentDir !== dir3cxml && (
                    <>
                      <span className="shrink-0">/</span>
                      <span className="truncate">
                        {currentDir.replace(dir3cxml, '').split('/').filter(Boolean).join(' / ')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>
            
            {dir3cxml && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={refreshXml}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/10 shrink-0"
                  >
                    <motion.div
                      className="w-full h-full flex items-center justify-center"
                      whileHover={{ rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <RefreshCcw className="h-4 w-4" color="#fff" />
                    </motion.div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Refresh templates</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div
            className="rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {xml.map((item) => renderItem(item, 0))}
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
          <div className="flex items-center justify-between">
            {/* Get Config from Terminal button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onGetConfigFromTerminal}
                  disabled={!canGetConfig}
                  className="px-4 py-3 rounded-2xl flex items-center justify-center hover:bg-white/5 shrink-0"
                  style={{ 
                    opacity: busy ? 0.5 : 1
                  }}
                >
                  <motion.div
                    className="w-full h-full flex items-center justify-center"
                    whileHover={canGetConfig ? { y: [0, -4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <Upload 
                      className="h-5 w-5" 
                      color={canGetConfig ? "#FFD86A" : "rgba(255,255,255,0.4)"}
                    />
                  </motion.div>
                </button>
              </TooltipTrigger>
              <TooltipContent>Download config from terminal</TooltipContent>
            </Tooltip>

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
    </TooltipProvider>
  );
}