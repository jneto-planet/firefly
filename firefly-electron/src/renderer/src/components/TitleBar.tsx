import React from "react";
import { Minus, Square, X, Minimize2, ChevronDown, MonitorSmartphone } from "lucide-react";

// Extend CSS properties to include Electron-specific properties
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}

interface Device {
  serial: string;
  name: string;
  online: boolean;
}

interface TitleBarProps {
  devices: Device[];
  selectedSerial: string;
  deviceTitle: string;
  deviceIcons: Record<string, string | null>;
  deviceMenuOpen: boolean;
  setDeviceMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onSelectDeviceSerial: (serial: string) => void;
}

export default function TitleBar({
  devices,
  selectedSerial,
  deviceTitle,
  deviceIcons,
  deviceMenuOpen,
  setDeviceMenuOpen,
  onSelectDeviceSerial,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isMacOS, setIsMacOS] = React.useState(false);

  React.useEffect(() => {
    // Detect platform
    const platform = navigator.platform.toLowerCase();
    const isMac = platform.includes('mac');
    setIsMacOS(isMac);

    // Check initial maximize state
    window.firefly.windowIsMaximized().then(setIsMaximized);
  }, []);

  const handleMinimize = () => {
    window.firefly.windowMinimize();
  };

  const handleMaximize = () => {
    if (isMaximized) {
      window.firefly.windowMaximize(); // This will unmaximize if already maximized
    } else {
      window.firefly.windowMaximize();
    }
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.firefly.windowClose();
  };

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-8"
      style={{
        background: "#08121A",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        WebkitAppRegion: "drag"
      }}
    >
      {/* Left side - Empty */}
      <div className="flex-1"></div>
      
      {/* Center - Device Selector */}
      <div className="relative" style={{ WebkitAppRegion: "no-drag" }}>
        <button
          onClick={() => setDeviceMenuOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1 rounded hover:bg-white/5 transition-colors"
          style={{ minWidth: "200px" }}
        >
          <div className="flex-1 min-w-0 text-left truncate">
            <span className="text-xs text-white/80">{deviceTitle || "No device"}</span>
            {selectedSerial && (
              <span className="text-[10px] text-white/50 font-mono ml-2">{selectedSerial}</span>
            )}
          </div>
          <ChevronDown className={`h-3 w-3 transition flex-shrink-0 ${deviceMenuOpen ? "rotate-180" : ""}`} color="#fff" />
        </button>
        
        {/* Device dropdown menu */}
        {deviceMenuOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-auto rounded-lg shadow-lg z-50"
            style={{ background: "rgba(8,15,22,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {devices.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/60">No devices found</div>
            )}
            {devices.map((d) => {
              const active = d.serial === selectedSerial;
              const deviceIcon = deviceIcons[d.serial];
              return (
                <button
                  key={d.serial}
                  disabled={!d.online}
                  onClick={() => {
                    onSelectDeviceSerial(d.serial);
                    setDeviceMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 ${
                    active ? "bg-white/5" : "hover:bg-white/5"
                  } ${!d.online ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 flex-shrink-0">
                    {deviceIcon ? (
                      <img src={deviceIcon} className="h-5 w-5 object-contain" />
                    ) : (
                      <MonitorSmartphone className="h-4 w-4" color="#fff" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-white">{d.name || d.serial}</div>
                    <div className="text-[10px] text-white/60 font-mono">
                      {d.serial}{!d.online ? " (offline)" : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Right side - Window controls (only on Windows/Linux) */}
      <div className="flex-1 flex justify-end">
        {!isMacOS && (
          <div className="flex" style={{ WebkitAppRegion: "no-drag" }}>
            <button
              onClick={handleMinimize}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Minimize"
            >
              <Minus size={14} className="text-white/70" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 size={14} className="text-white/70" />
              ) : (
                <Square size={14} className="text-white/70" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-red-500 transition-colors"
              title="Close"
            >
              <X size={14} className="text-white/70" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}