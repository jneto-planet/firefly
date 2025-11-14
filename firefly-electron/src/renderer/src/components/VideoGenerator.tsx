import React from "react";
import { Film, Plus, Trash2, Play, FolderOpen } from "lucide-react";

interface VideoGeneratorProps {
  status: string;
}

export default function VideoGenerator({ status }: VideoGeneratorProps) {
  const [images, setImages] = React.useState<string[]>([]);
  const [delay, setDelay] = React.useState<number>(3);
  const [terminal, setTerminal] = React.useState<"PAX" | "VIPA">("PAX");
  const [width, setWidth] = React.useState<number>(1280);
  const [height, setHeight] = React.useState<number>(720);
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [progress, setProgress] = React.useState<string>("");
  const [showSuccessDialog, setShowSuccessDialog] = React.useState<boolean>(false);
  const [generatedPath, setGeneratedPath] = React.useState<string>("");

  const handleAddImages = async () => {
    try {
      const selectedImages = await window.firefly.pickImages();
      if (selectedImages && selectedImages.length > 0) {
        setImages([...images, ...selectedImages]);
      }
    } catch (error) {
      console.error("Failed to pick images:", error);
      alert("Failed to select images");
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setImages([]);
  };

  const handleGenerate = async () => {
    if (images.length === 0) {
      alert("Please add at least one image");
      return;
    }

    if (delay <= 0) {
      alert("Delay must be greater than 0");
      return;
    }

    if (width <= 0 || height <= 0) {
      alert("Width and height must be greater than 0");
      return;
    }

    try {
      // Determine default filename based on terminal type
      const extension = terminal === "PAX" ? ".mp4" : ".avi";
      const defaultName = `slideshow${extension}`;

      // Ask user where to save
      const outputPath = await window.firefly.pickSaveLocation(defaultName);
      if (!outputPath) {
        return; // User cancelled
      }

      setIsGenerating(true);
      setProgress("Generating video...");

      const result = await window.firefly.generateVideo({
        images,
        delay,
        terminal,
        width,
        height,
        outputPath,
      });

      setIsGenerating(false);

      if (result.success) {
        setProgress("");
        setGeneratedPath(outputPath);
        setShowSuccessDialog(true);
      } else {
        setProgress("");
        alert(`Failed to generate video:\n\n${result.error}`);
      }
    } catch (error) {
      setIsGenerating(false);
      setProgress("");
      console.error("Failed to generate video:", error);
      alert(`Failed to generate video:\n\n${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b"
           style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5" color="#fff" />
          <h2 className="text-lg font-semibold text-white">Video Generator</h2>
        </div>
        <div className="text-xs text-white/60">{status}</div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Images Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Images ({images.length})</h3>
              <div className="flex gap-2">
                {images.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-xs rounded-lg border flex items-center gap-2 hover:bg-white/5"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All
                  </button>
                )}
                <button
                  onClick={handleAddImages}
                  className="px-3 py-1.5 text-xs rounded-lg flex items-center gap-2"
                  style={{ background: "#FFD86A", color: "#1a1a1a" }}
                >
                  <Plus className="h-3 w-3" />
                  Add Images
                </button>
              </div>
            </div>

            {/* Images List */}
            <div
              className="rounded-lg border min-h-[200px] max-h-[300px] overflow-y-auto"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              {images.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-white/40 text-sm">
                  No images added. Click "Add Images" to get started.
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {images.map((img, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0 w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs text-white/60">
                          {index + 1}
                        </div>
                        <span className="text-sm text-white truncate" title={img}>
                          {img.split(/[/\\]/).pop()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="p-1 rounded hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Settings Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-white">Video Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Delay */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-2">
                  Delay per Image (seconds)
                </label>
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(parseFloat(e.target.value) || 0)}
                  min="0.1"
                  step="0.1"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>

              {/* Terminal Type */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-2">
                  Terminal Model
                </label>
                <select
                  value={terminal}
                  onChange={(e) => {
                    const newTerminal = e.target.value as "PAX" | "VIPA";
                    setTerminal(newTerminal);
                    // Auto-set dimensions for VIPA
                    if (newTerminal === "VIPA") {
                      setWidth(220);
                      setHeight(150);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <option value="PAX">PAX (.mp4)</option>
                  <option value="VIPA">VIPA (.avi)</option>
                </select>
              </div>

              {/* Width */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-2">
                  Width (pixels)
                </label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                  min="1"
                  step="2"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-xs font-medium text-white/80 mb-2">
                  Height (pixels)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                  min="1"
                  step="2"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            {/* Info Box */}
            <div
              className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(255,216,106,0.1)", border: "1px solid rgba(255,216,106,0.2)" }}
            >
              <div className="text-[#FFD86A] space-y-1">
                <p><strong>Output:</strong> {terminal === "PAX" ? "MP4 (H.264 main@3.1)" : "AVI (H.264 baseline@3.1)"}</p>
                <p><strong>Resolution:</strong> {width}x{height} (dimensions will be adjusted to even numbers)</p>
                <p><strong>Total Duration:</strong> ~{(images.length * delay).toFixed(1)}s ({images.length} images × {delay}s each)</p>
              </div>
            </div>
          </section>

          {/* Generate Button */}
          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-sm text-white/60">
              {progress && <span className="text-[#FFD86A]">{progress}</span>}
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || images.length === 0}
              className="px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#FFD86A", color: "#1a1a1a" }}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Generate Video
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      {showSuccessDialog && (
        <div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-xl border shadow-2xl max-w-md w-full mx-4" style={{ background: "#0d0d0d", borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.2)" }}>
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Video Generated Successfully!</h3>
                  <p className="text-sm text-white/60 mt-1">Your video has been created</p>
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs text-white/40 mb-1">Saved to:</p>
                <p className="text-sm text-white break-all">{generatedPath}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    window.firefly.revealInFileManager(generatedPath);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border flex items-center justify-center gap-2 hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  <FolderOpen className="h-4 w-4" />
                  Show in Folder
                </button>
                <button
                  onClick={() => setShowSuccessDialog(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium"
                  style={{ background: "#FFD86A", color: "#1a1a1a" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
