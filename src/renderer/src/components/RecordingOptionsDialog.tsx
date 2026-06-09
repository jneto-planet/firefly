import React from "react";
import { X } from "lucide-react";

interface RecordingOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (options: RecordingOptions) => void;
  maxTimeLimit: string; // e.g., "3 minutes" or "30 minutes"
  initialOptions: RecordingOptions;
  onConfigure: () => Promise<string | undefined>;
}

export interface RecordingOptions {
  bitRate: number;
  resolution: number;
  showTaps: boolean;
  savePath: string;
}

export default function RecordingOptionsDialog({
  isOpen,
  onClose,
  onStartRecording,
  maxTimeLimit,
  initialOptions,
  onConfigure,
}: RecordingOptionsDialogProps) {
  const [bitRate, setBitRate] = React.useState(initialOptions.bitRate.toString());
  const [resolution, setResolution] = React.useState(initialOptions.resolution);
  const [showTaps, setShowTaps] = React.useState(initialOptions.showTaps);
  const [savePath, setSavePath] = React.useState(initialOptions.savePath);

  // Update state when initialOptions change
  React.useEffect(() => {
    setBitRate(initialOptions.bitRate.toString());
    setResolution(initialOptions.resolution);
    setShowTaps(initialOptions.showTaps);
    setSavePath(initialOptions.savePath);
  }, [initialOptions]);

  const handleStartRecording = () => {
    const bitRateNum = parseFloat(bitRate) || 4;
    onStartRecording({
      bitRate: bitRateNum,
      resolution,
      showTaps,
      savePath,
    });
  };

  const handleConfigure = async () => {
    const newPath = await onConfigure();
    if (newPath) {
      setSavePath(newPath);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Screen Recorder Options</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" color="#fff" />
          </button>
        </div>

        {/* Time Limit Info */}
        <div className="text-sm text-white/70">
          The length of the recording can be up to {maxTimeLimit}.
        </div>

        {/* Bit Rate */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">Bit rate (Mbps):</label>
          <input
            type="number"
            value={bitRate}
            onChange={(e) => setBitRate(e.target.value)}
            className="w-32 px-3 py-2 rounded-lg text-white text-sm"
            style={{ 
              background: "rgba(255,255,255,0.05)", 
              border: "1px solid rgba(255,255,255,0.12)" 
            }}
            min="0.1"
            step="0.1"
          />
        </div>

        {/* Resolution */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">Resolution (% of native):</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(parseInt(e.target.value))}
            className="w-32 px-3 py-2 rounded-lg text-white text-sm cursor-pointer"
            style={{ 
              background: "rgba(255,255,255,0.05)", 
              border: "1px solid rgba(255,255,255,0.12)" 
            }}
          >
            <option value={100}>100</option>
            <option value={75}>75</option>
            <option value={50}>50</option>
            <option value={37}>37</option>
            <option value={25}>25</option>
          </select>
        </div>

        {/* Show Taps */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showTaps}
              onChange={(e) => setShowTaps(e.target.checked)}
              className="h-4 w-4 rounded cursor-pointer"
              style={{
                accentColor: "#FFD86A",
              }}
            />
            <span className="text-sm font-medium text-white">Show taps</span>
          </label>
          <div 
            className="h-5 w-5 rounded-full flex items-center justify-center text-xs text-white/50"
            style={{ background: "rgba(255,255,255,0.05)" }}
            title="Display visual feedback for taps on the screen"
          >
            ?
          </div>
        </div>

        {/* Save Location */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">Saving to:</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70 max-w-[200px] truncate" title={savePath}>
              {savePath}
            </span>
            <button
              onClick={handleConfigure}
              className="px-3 py-1 text-sm rounded-lg text-white hover:bg-white/5 transition"
              style={{ color: "#5EB3F6" }}
            >
              Configure
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-white text-sm font-medium hover:bg-white/5 transition"
            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleStartRecording}
            className="px-6 py-2 rounded-lg text-black text-sm font-medium transition hover:opacity-90"
            style={{ background: "#FFD86A" }}
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
