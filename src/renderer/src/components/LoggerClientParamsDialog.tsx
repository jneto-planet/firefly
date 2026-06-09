import React from "react";
import { X } from "lucide-react";

interface LoggerClientParamsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (params: { ip: string; port: string; pattern: string }) => void;
  defaultIp: string;
}

export default function LoggerClientParamsDialog({
  isOpen,
  onClose,
  onOpen,
  defaultIp,
}: LoggerClientParamsDialogProps) {
  const [ip, setIp] = React.useState(defaultIp);
  const [port, setPort] = React.useState("10000");
  const [pattern, setPattern] = React.useState("%d [%c{1}] %p - %m");

  React.useEffect(() => {
    if (isOpen) {
      setIp(defaultIp);
    }
  }, [isOpen, defaultIp]);

  const handleOpen = () => {
    onOpen({ ip, port, pattern });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Logger Client Params</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" color="#fff" />
          </button>
        </div>

        {/* IP */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">IP Address</label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g. 192.168.1.100"
            className="w-52 px-3 py-2 rounded-lg text-white text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* Port */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">Port</label>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-52 px-3 py-2 rounded-lg text-white text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* Pattern */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white">Pattern</label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-52 px-3 py-2 rounded-lg text-white text-sm font-mono"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-white/5 transition"
            style={{ color: "#fff" }}
          >
            Cancel
          </button>
          <button
            onClick={handleOpen}
            className="px-4 py-2 text-sm rounded-lg transition"
            style={{ background: "#FFD86A", color: "#000", fontWeight: 500 }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
