import React from "react";
import { Minus, Square, X, Minimize2 } from "lucide-react";

// Extend CSS properties to include Electron-specific properties
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}

export default function TitleBar() {
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
      {/* Left side - App title or logo could go here */}
      <div className="flex-1"></div>
      
      {/* Center - Empty for clean look */}
      <div></div>
      
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