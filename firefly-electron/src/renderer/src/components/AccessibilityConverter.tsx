import React from "react";
import { Eye, Plus, Trash2, Download, FolderOpen, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ConversionMode = "color-inversion" | "color-correction";

interface AccessibilityConverterProps {
  status: string;
}

// Protanomaly matrix (same as the Python script)
const PROTANOMALY_MATRIX = [
  [0.608070, 0.734056, -0.342126],
  [0.185931, 0.989899, -0.175830],
  [-0.023280, 0.039084, 0.984196],
];

function applyColorInversion(imageData: ImageData): ImageData {
  const data = imageData.data;
  const out = new ImageData(imageData.width, imageData.height);
  const od = out.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3];

    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;

    // Lightness
    const l = (cmax + cmin) / 2;

    // Saturation
    const denom = 1 - Math.abs(2 * l - 1);
    const s = denom > 0 ? Math.min(delta / denom, 1) : 0;

    // Hue
    let hue = 0;
    if (delta > 0) {
      if (cmax === r) hue = (((g - b) / delta) % 6 + 6) % 6;
      else if (cmax === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue /= 6;
    }

    // Invert lightness
    const lInv = 1 - l;

    // HSL -> RGB
    const c = (1 - Math.abs(2 * lInv - 1)) * s;
    const x = c * (1 - Math.abs((hue * 6) % 2 - 1));
    const m = lInv - c / 2;

    let ro = 0, go = 0, bo = 0;
    const h6 = Math.floor(hue * 6) % 6;
    switch (h6) {
      case 0: ro = c; go = x; bo = 0; break;
      case 1: ro = x; go = c; bo = 0; break;
      case 2: ro = 0; go = c; bo = x; break;
      case 3: ro = 0; go = x; bo = c; break;
      case 4: ro = x; go = 0; bo = c; break;
      case 5: ro = c; go = 0; bo = x; break;
    }

    od[i] = Math.round(Math.min(Math.max(ro + m, 0), 1) * 255);
    od[i + 1] = Math.round(Math.min(Math.max(go + m, 0), 1) * 255);
    od[i + 2] = Math.round(Math.min(Math.max(bo + m, 0), 1) * 255);
    od[i + 3] = a;
  }

  return out;
}

function applyColorCorrection(imageData: ImageData): ImageData {
  const data = imageData.data;
  const out = new ImageData(imageData.width, imageData.height);
  const od = out.data;
  const m = PROTANOMALY_MATRIX;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3];

    const nr = r * m[0][0] + g * m[0][1] + b * m[0][2];
    const ng = r * m[1][0] + g * m[1][1] + b * m[1][2];
    const nb = r * m[2][0] + g * m[2][1] + b * m[2][2];

    od[i] = Math.round(Math.min(Math.max(nr, 0), 1) * 255);
    od[i + 1] = Math.round(Math.min(Math.max(ng, 0), 1) * 255);
    od[i + 2] = Math.round(Math.min(Math.max(nb, 0), 1) * 255);
    od[i + 3] = a;
  }

  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop()?.split("\\").pop() || filePath;
}

export default function AccessibilityConverter({ status: _status }: AccessibilityConverterProps) {
  const [images, setImages] = React.useState<string[]>([]);
  const [mode, setMode] = React.useState<ConversionMode>("color-inversion");
  const [isConverting, setIsConverting] = React.useState(false);
  const [progress, setProgress] = React.useState("");
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [lastOutputDir, setLastOutputDir] = React.useState("");
  const [lastConvertedCount, setLastConvertedCount] = React.useState(0);

  const handleAddImages = async () => {
    try {
      const selectedImages = await window.firefly.pickAccessibilityImages();
      if (selectedImages && selectedImages.length > 0) {
        setImages((prev) => [...prev, ...selectedImages]);
        // Load thumbnails via IPC
        for (const imgPath of selectedImages) {
          window.firefly.readImageAsDataUrl(imgPath).then((dataUrl) => {
            setThumbnails((prev) => ({ ...prev, [imgPath]: dataUrl }));
          }).catch(() => { /* ignore thumbnail errors */ });
        }
      }
    } catch (error) {
      console.error("Failed to pick images:", error);
      alert("Failed to select images");
    }
  };

  const handleRemoveImage = (index: number) => {
    const removed = images[index];
    setImages(images.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[removed];
      return next;
    });
    setThumbnails((prev) => {
      const next = { ...prev };
      delete next[removed];
      return next;
    });
  };

  const handleClearAll = () => {
    setImages([]);
    setPreviews({});
    setThumbnails({});
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      alert("Please add at least one image");
      return;
    }

    // Ask user where to save
    const outputDir = await window.firefly.pickAccessibilityOutputDir();
    if (!outputDir) return; // User cancelled

    setIsConverting(true);
    setProgress(`Converting 0/${images.length}...`);

    try {
      const results: { path: string; dataUrl: string }[] = [];

      for (let i = 0; i < images.length; i++) {
        setProgress(`Converting ${i + 1}/${images.length}...`);
        const filePath = images[i];

        // Load image data via IPC (file:// is blocked in renderer)
        const srcDataUrl = thumbnails[filePath] || await window.firefly.readImageAsDataUrl(filePath);
        const img = await loadImage(srcDataUrl);

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const converted =
          mode === "color-inversion"
            ? applyColorInversion(imageData)
            : applyColorCorrection(imageData);

        ctx.putImageData(converted, 0, 0);

        const resultDataUrl = canvas.toDataURL("image/png");
        results.push({ path: filePath, dataUrl: resultDataUrl });
      }

      setProgress("Saving files...");

      const suffix = mode === "color-inversion" ? "color_inversion" : "color_correction";

      for (const { path, dataUrl } of results) {
        // Strip data URL prefix to get base64
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        await window.firefly.saveAccessibilityImage({ originalPath: path, base64Data: base64, suffix, outputDir });
      }

      setProgress("");
      setIsConverting(false);

      // Generate previews for display
      const newPreviews: Record<string, string> = {};
      for (const { path, dataUrl } of results) {
        newPreviews[path] = dataUrl;
      }
      setPreviews(newPreviews);

      setLastOutputDir(outputDir);
      setLastConvertedCount(results.length);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Conversion failed:", error);
      setIsConverting(false);
      setProgress("");
      alert(`Conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5" color="#FFD86A" />
          <h2 className="text-lg font-semibold text-white">Accessibility Converter</h2>
        </div>
        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-white/5 transition disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </button>
          )}
          <button
            onClick={handleAddImages}
            disabled={isConverting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#FFD86A] hover:text-[#ffe88a] hover:bg-white/5 transition disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Images
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-6 min-h-0">
        {/* Mode Selection */}
        <section className="mb-4">
          <label className="block text-sm text-white/60 mb-2">Conversion Mode</label>
          <div className="flex gap-3">
            <button
              onClick={() => setMode("color-inversion")}
              className={`flex-1 px-4 py-3 rounded-2xl border text-sm font-medium transition ${
                mode === "color-inversion"
                  ? "border-[#FFD86A] bg-[#FFD86A]/10 text-[#FFD86A]"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Colour Inversion
            </button>
            <button
              onClick={() => setMode("color-correction")}
              className={`flex-1 px-4 py-3 rounded-2xl border text-sm font-medium transition ${
                mode === "color-correction"
                  ? "border-[#FFD86A] bg-[#FFD86A]/10 text-[#FFD86A]"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Colour Correction
            </button>
          </div>
        </section>

        {/* Image List */}
        <section className="flex flex-col flex-1 min-h-0 space-y-3">
          <div className="flex items-center">
            <span className="text-sm text-white/60">
              Images ({images.length})
            </span>
          </div>

          {images.length === 0 ? (
            <button
              onClick={handleAddImages}
              disabled={isConverting}
              className="w-full flex flex-col items-center justify-center gap-2 py-16 rounded-2xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <FolderOpen className="h-8 w-8 text-white/30" />
              <span className="text-sm text-white/40">Click to add images</span>
              <span className="text-xs text-white/20">PNG, JPG, BMP, GIF, WebP</span>
            </button>
          ) : (
            <div
              className="rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex-1 overflow-auto">
                {images.map((img, index) => (
                  <div
                    key={`${img}-${index}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    {/* Thumbnail */}
                    <div className="h-10 w-10 rounded-lg bg-white/10 overflow-hidden shrink-0">
                      {thumbnails[img] ? (
                        <img
                          src={thumbnails[img]}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/20 text-xs">...</div>
                      )}
                    </div>
                    {/* Preview (if converted) */}
                    {previews[img] && (
                      <div className="h-10 w-10 rounded-lg bg-white/10 overflow-hidden shrink-0 ring-1 ring-[#FFD86A]/30">
                        <img
                          src={previews[img]}
                          className="h-full w-full object-cover"
                          alt="converted"
                        />
                      </div>
                    )}
                    <span className="flex-1 text-sm text-white/80 truncate">
                      {getFileName(img)}
                    </span>
                    <button
                      onClick={() => handleRemoveImage(index)}
                      disabled={isConverting}
                      className="text-white/30 hover:text-red-400 transition disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Bottom: action bar */}
        <section className="pt-4">
          <div className="flex items-center justify-end">
            <button
              disabled={isConverting || images.length === 0}
              onClick={handleConvert}
              className="px-8 py-3 rounded-2xl flex items-center gap-2.5 text-sm font-medium transition"
              style={{
                background: !isConverting && images.length > 0 ? "#FFD86A" : "rgba(255,255,255,0.08)",
                color: !isConverting && images.length > 0 ? "#1a1a1a" : "#fff",
                opacity: isConverting ? 0.7 : 1,
              }}
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {progress}
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Convert & Save
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Success Dialog */}
      <AnimatePresence>
        {showSuccessDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={() => setShowSuccessDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
              className="rounded-xl border shadow-2xl max-w-md w-full mx-4"
              style={{ background: "#0b1720", borderColor: "rgba(255,255,255,0.12)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", damping: 12, stiffness: 200 }}
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.2)" }}
                  >
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                    >
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </motion.div>
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Conversion Complete!</h3>
                    <p className="text-sm text-white/60 mt-1">
                      {lastConvertedCount} image{lastConvertedCount > 1 ? "s" : ""} converted successfully
                    </p>
                  </div>
                </div>

                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <p className="text-xs text-white/40 mb-1">Saved to:</p>
                  <p className="text-sm text-white break-all">{lastOutputDir}</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      window.firefly.revealInFileManager(lastOutputDir);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg border flex items-center justify-center gap-2 hover:bg-white/5 transition"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Show in Folder
                  </button>
                  <button
                    onClick={() => setShowSuccessDialog(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium transition hover:opacity-90"
                    style={{ background: "#FFD86A", color: "#1a1a1a" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
