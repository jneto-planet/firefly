import { Save, Copy, Check, XCircle, RefreshCw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./Tooltip";

interface ScreenshotDialogProps {
  imageData: string; // base64 image data
  deviceName: string;
  onClose: () => void;
  onCopyToClipboard: () => Promise<void>;
  onSave: () => Promise<void>;
  onRecapture: () => Promise<void>;
  copied: boolean;
  isCapturing: boolean;
}

const ACCENT = "#FFD86A";

export default function ScreenshotDialog({
  imageData,
  deviceName,
  onClose,
  onCopyToClipboard,
  onSave,
  onRecapture,
  copied,
  isCapturing,
}: ScreenshotDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] p-6 rounded-2xl space-y-4 overflow-auto"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Screenshot - {deviceName}</h2>
        </div>

        {/* Image Preview */}
        <div className="flex justify-center bg-black/20 rounded-lg p-4">
          <img
            src={`data:image/png;base64,${imageData}`}
            alt="Screenshot"
            className="max-w-full max-h-[60vh] object-contain rounded"
          />
        </div>

        {/* Action Buttons */}
        <TooltipProvider delayDuration={500}>
          <div className="flex gap-2 pt-4 justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border flex items-center justify-center gap-2"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              <XCircle size={16} />
              Close
            </button>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onRecapture}
                    disabled={isCapturing}
                    className="px-4 py-2 rounded-lg border flex items-center justify-center gap-2"
                    style={{ 
                      borderColor: "rgba(255,255,255,0.12)", 
                      color: "#fff",
                      opacity: isCapturing ? 0.5 : 1
                    }}
                  >
                    <RefreshCw className={`h-4 w-4 ${isCapturing ? 'animate-spin' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Recapture Screenshot</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onCopyToClipboard}
                    disabled={copied}
                    className="px-4 py-2 rounded-lg border flex items-center justify-center gap-2"
                    style={{ 
                      borderColor: copied ? ACCENT : "rgba(255,255,255,0.12)", 
                      color: copied ? ACCENT : "#fff",
                      background: copied ? "rgba(255,216,106,0.1)" : "transparent"
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy to Clipboard</TooltipContent>
              </Tooltip>
              <button
                onClick={onSave}
                className="px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                style={{ background: ACCENT, color: "#1a1a1a" }}
              >
                <Save className="h-4 w-4" />
                Save As...
              </button>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
