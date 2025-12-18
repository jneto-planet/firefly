import { XCircle, Save, FolderOpen, Eye } from "lucide-react";
import { useState, useEffect } from "react";

interface ConfigurationSettingsDialogProps {
  onClose: () => void;
  onSave: (editorPath: string, clearTidFromDataStore: boolean) => void;
  dir3cxml: string;
  onChooseDirectory: () => void;
}

const ACCENT = "#FFD86A";

export default function ConfigurationSettingsDialog({
  onClose,
  onSave,
  dir3cxml,
  onChooseDirectory,
}: ConfigurationSettingsDialogProps) {
  const [editorPath, setEditorPath] = useState<string>("");
  const [defaultEditor, setDefaultEditor] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);
  const [clearTidFromDataStore, setClearTidFromDataStore] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      // Get default OS editor
      const osEditor = await window.firefly.getDefaultXmlEditor();
      setDefaultEditor(osEditor || "Not detected");

      // Get custom editor path from config
      const config = await window.firefly.getConfig();
      setEditorPath(config.xml_editor_path || "");
      setClearTidFromDataStore(config.clear_tid_from_datastore ?? true);
    } catch (e) {
      console.error("Failed to load configuration settings:", e);
      setDefaultEditor("Error loading");
    } finally {
      setLoading(false);
    }
  }

  async function browseEditor() {
    try {
      const path = await window.firefly.pickFile({
        title: "Select XML Editor",
        fileType: "executable",
      });
      if (path) {
        setEditorPath(path);
      }
    } catch (e) {
      console.error("Failed to browse for editor:", e);
    }
  }

  function handleSave() {
    onSave(editorPath, clearTidFromDataStore);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 rounded-2xl space-y-4"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white">Configuration Settings</h2>

        <div className="space-y-4">
          {/* 3cxml Folder Section */}
          <div>
            <div className="text-sm font-medium text-white mb-2">3cxml Configurations Folder</div>
            <div className="text-xs text-white/40 mb-2">
              Select the root folder containing your XML configuration files
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={dir3cxml || "(not set)"}
                readOnly
                className="flex-1 px-3 py-2 text-sm rounded border bg-white/5 text-white/60"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              />
              <button
                onClick={onChooseDirectory}
                className="px-3 py-2 text-xs rounded border whitespace-nowrap flex items-center gap-2 hover:bg-white/5"
                style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
              >
                <FolderOpen className="h-4 w-4" /> Choose...
              </button>
              {dir3cxml && (
                <button
                  onClick={() => window.firefly.revealInFileManager(dir3cxml)}
                  className="px-3 py-2 text-xs rounded border hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  title="Open folder in file manager"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            {/* Default OS Editor Display */}
            <div className="mb-4">
              <div className="text-sm font-medium text-white mb-2">Current OS Default Editor</div>
              <div className="text-xs text-white/60 bg-white/5 p-2 rounded border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {loading ? "Loading..." : defaultEditor}
              </div>
            </div>

            {/* Custom Editor Path */}
            <div>
              <div className="text-sm font-medium text-white mb-2">Custom XML Editor</div>
              <div className="text-xs text-white/40 mb-2">
                Override the default editor for opening XML files in Firefly
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editorPath}
                  onChange={(e) => setEditorPath(e.target.value)}
                  placeholder="Leave empty to use OS default"
                  className="flex-1 px-3 py-2 text-sm rounded border bg-transparent text-white"
                  style={{ borderColor: "rgba(255,255,255,0.12)" }}
                />
                <button
                  onClick={browseEditor}
                  className="px-3 py-1 text-xs rounded border whitespace-nowrap"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>

          {/* Clear TID from DataStore Section */}
          <div className="border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-white mb-1">Clear TID from DataStore</div>
                <div className="text-xs text-white/40">
                  Clear TID from DataStore before sending new configuration.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={clearTidFromDataStore}
                  onChange={(e) => setClearTidFromDataStore(e.target.checked)}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFD86A]"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border flex items-center justify-center gap-2"
            style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <XCircle size={16} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2"
            style={{ background: ACCENT, color: "#1a1a1a" }}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
