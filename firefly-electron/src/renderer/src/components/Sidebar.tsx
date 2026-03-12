import {
  ChevronRight,
  Settings,
  MonitorSmartphone,
  Blocks,
  Terminal,
  Film,
  ScreenShare,
  Camera,
  Video,
} from "lucide-react";
import { PiButterflyLight } from "react-icons/pi";
import LoggerClientIcon from "./LoggerClientIcon";
import { motion } from "framer-motion";

import fireflylogo from "../assets/icons/firefly.png";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./Tooltip";

interface SidebarProps {
  // Device management
  deviceTitle: string;
  deviceIcon: string | null;
  deviceIpAddress: string | null;
  deviceBatteryLevel: number | null;
  deviceIsCharging: boolean;
  deviceAndroidVersion: string | null;
  refreshDevices: () => void;
  
  // Navigation
  active: "configuration" | "logcat" | "video-generator";
  setActive: (active: "configuration" | "logcat" | "video-generator") => void;
  
  // Settings
  setShowSettings: (show: boolean) => void;
  
  // Helper functions
  currentSerial: () => string | null;
  
  // Scrcpy
  launchScrcpy: () => void;
  scrcpyActive: boolean;
  
  // Screenshot
  takeScreenshot: () => void;
  takingScreenshot: boolean;
  
  // Butterfly
  openButterfly: () => void;
  openingButterfly: boolean;
  butterflyConfigured: boolean;

  // Logger Client
  openLoggerClient: () => void;
  openingLoggerClient: boolean;
  loggerClientConfigured: boolean;
  openLoggerClientSettings: () => void;
  
  // Screen Recording
  toggleScreenRecording: () => void;
  isRecording: boolean;
  recordingSeconds: number;
}

interface NavItemProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  iconRight?: boolean;
  icon?: React.ReactNode;
  badge?: string;
}

function NavItem({ label, active, disabled, onClick, iconRight, icon, badge }: NavItemProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition
        ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"}
        ${active ? "bg-white/10" : ""}
      `}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-white">{label}</span>
        {badge && (
          <span 
            className="px-1.5 py-0.5 text-[10px] font-medium rounded"
            style={{ 
              background: "rgba(255,216,106,0.15)", 
              color: "#FFD86A",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {iconRight && <ChevronRight className="h-4 w-4" color="#fff" />}
    </button>
  );
}

export default function Sidebar({
  deviceTitle,
  deviceIcon,
  deviceIpAddress,
  deviceBatteryLevel,
  deviceIsCharging,
  deviceAndroidVersion,
  refreshDevices: _refreshDevices,
  active,
  setActive,
  setShowSettings,
  currentSerial,
  launchScrcpy,
  scrcpyActive,
  takeScreenshot,
  takingScreenshot,
  openButterfly,
  openingButterfly,
  butterflyConfigured,
  openLoggerClient,
  openingLoggerClient,
  loggerClientConfigured,
  openLoggerClientSettings,
  toggleScreenRecording,
  isRecording,
  recordingSeconds,
}: SidebarProps) {
  const serial = currentSerial();
  const currentOnline = serial != null;

  // Format recording time as MM:SS
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider delayDuration={500}>
      <aside
        className="h-full flex flex-col border-r"
        style={{ width: 268, background: "#0b1720", borderColor: "rgba(255,255,255,0.08)" }}
      >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <img src={fireflylogo} alt="Firefly" className="w-10 h-10 object-contain" />
        <span
          className="text-lg font-semibold tracking-tight"
          style={{
            color: "#FFD86A",
            textShadow: "0 0 8px rgba(255,216,106,0.5)"
          }}
        >
          Firefly
        </span>
      </div>

      {/* Nav */}
      <nav className="px-2 py-2 flex-1 space-y-3">
        {/* Device Section */}
        <div>
          <div className="px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Device</span>
          </div>
          
          {/* Device Details (Display Only) */}
          {currentOnline && serial && (
            <div className="px-2 mb-2">
              <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {deviceIcon
                      ? <img src={deviceIcon} className="h-6 w-6 object-contain" />
                      : <MonitorSmartphone className="h-5 w-5" color="#fff" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate text-left">{deviceTitle}</div>
                    <div className="text-[10px] text-white/60 font-mono truncate text-left">{serial}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {deviceIpAddress && (
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">IP Address</span>
                      <span className="text-[11px] text-white/80 font-mono text-right">{deviceIpAddress}</span>
                    </div>
                  )}
                  {deviceBatteryLevel !== null && (
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Battery</span>
                      <span className="text-[11px] text-white/80 text-right">
                        {deviceBatteryLevel}%{deviceIsCharging && " ⚡"}
                      </span>
                    </div>
                  )}
                  {deviceBatteryLevel === null && deviceIsCharging && (
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Power</span>
                      <span className="text-[11px] text-white/80 text-right">
                        ⚡
                      </span>
                    </div>
                  )}
                  {deviceAndroidVersion && (
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Android</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-white/80 text-right max-w-[140px] truncate cursor-default">{deviceAndroidVersion}</span>
                        </TooltipTrigger>
                        <TooltipContent>{deviceAndroidVersion}</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions Section */}
        <div>
          <div className="px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Quick Actions</span>
          </div>
          <div className="px-2 flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={launchScrcpy}
                  disabled={!currentOnline}
                  className={`relative h-10 w-10 rounded-lg flex items-center justify-center ${
                    scrcpyActive
                      ? "bg-white/10"
                      : currentOnline
                      ? "bg-white/5"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <motion.div
                    className="w-full h-full flex items-center justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    whileHover={currentOnline && !scrcpyActive ? { scale: [1, 1.15, 1, 1.15, 1] } : {}}
                  >
                    <ScreenShare
                      className="h-4 w-4"
                      color={scrcpyActive ? "#FFD86A" : "#fff"}
                    />
                  </motion.div>
                  {scrcpyActive && (
                    <span
                      className="absolute top-1 right-1 h-2 w-2 rounded-full animate-pulse"
                      style={{ backgroundColor: "#FFD86A" }}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Launch Scrcpy</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={takeScreenshot}
                  disabled={!currentOnline || takingScreenshot}
                  className={`relative h-10 w-10 rounded-lg flex items-center justify-center ${
                    takingScreenshot
                      ? "bg-white/10"
                      : currentOnline
                      ? "bg-white/5"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <motion.div
                    className="w-full h-full flex items-center justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    whileHover={currentOnline && !takingScreenshot ? {
                      scale: [1, 1.2, 1],
                      filter: ["brightness(1)", "brightness(2)", "brightness(1)"]
                    } : {}}
                  >
                    <Camera
                      className="h-4 w-4"
                      color={takingScreenshot ? "#FFD86A" : "#fff"}
                    />
                  </motion.div>
                  {takingScreenshot && (
                    <span
                      className="absolute top-1 right-1 h-2 w-2 rounded-full animate-pulse"
                      style={{ backgroundColor: "#FFD86A" }}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Take Screenshot</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <button
                    onClick={toggleScreenRecording}
                    disabled={!currentOnline && !isRecording}
                    className={`relative h-10 w-10 rounded-lg flex items-center justify-center ${
                      isRecording
                        ? "bg-white/10"
                        : currentOnline
                        ? "bg-white/5"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <motion.div
                      className="w-full h-full flex items-center justify-center"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.25 }}
                      whileHover={currentOnline && !isRecording ? {
                        scale: [1, 1.1, 1],
                      } : {}}
                    >
                      <Video
                        className="h-4 w-4"
                        color={isRecording ? "#FFD86A" : "#fff"}
                      />
                    </motion.div>
                    {isRecording && (
                      <span
                        className="absolute top-1 right-1 h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: "#FF4444" }}
                      />
                    )}
                  </button>
                  {isRecording && (
                    <div 
                      className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-[10px] font-mono whitespace-nowrap"
                      style={{ color: "#FFD86A" }}
                    >
                      {formatRecordingTime(recordingSeconds)}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? "Stop Recording" : "Screen Recording"}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Software Section */}
        <div>
          <div className="px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Software</span>
          </div>
          <div className="space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openButterfly}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition ${
                    !butterflyConfigured
                      ? "opacity-40 hover:bg-white/5"
                      : openingButterfly
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={openingButterfly && butterflyConfigured ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
                      transition={{ duration: 0.5, repeat: openingButterfly ? Infinity : 0 }}
                    >
                      <PiButterflyLight
                        className="h-4 w-4"
                        color={openingButterfly && butterflyConfigured ? "#FFD86A" : "#fff"}
                      />
                    </motion.div>
                    <span className="text-sm text-white">Butterfly</span>
                    {openingButterfly && butterflyConfigured && (
                      <span
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: "#FFD86A" }}
                      />
                    )}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {butterflyConfigured ? "Open Butterfly" : "Configure Butterfly path in Settings"}
              </TooltipContent>
            </Tooltip>

            <div className={`flex items-center rounded-lg transition ${!loggerClientConfigured ? "opacity-40" : ""}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={openLoggerClient}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-l-lg transition ${
                      openingLoggerClient && loggerClientConfigured ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <motion.div
                      animate={openingLoggerClient && loggerClientConfigured ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
                      transition={{ duration: 0.5, repeat: openingLoggerClient ? Infinity : 0 }}
                    >
                      <LoggerClientIcon
                        className="h-4 w-4"
                        color={openingLoggerClient && loggerClientConfigured ? "#FFD86A" : "#fff"}
                      />
                    </motion.div>
                    <span className="text-sm text-white">Logger Client</span>
                    {openingLoggerClient && loggerClientConfigured && (
                      <span
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: "#FFD86A" }}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {loggerClientConfigured ? "Open Logger Client" : "Configure Logger Client path in Settings"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={openLoggerClientSettings}
                    disabled={!loggerClientConfigured}
                    className="px-2 py-2 rounded-r-lg hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Settings className="h-3.5 w-3.5" color="#fff" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Manual connection params</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div>
          <div className="px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Adb Actions</span>
          </div>
          <div className="space-y-1">
            <NavItem
              label="Configuration"
              icon={<Blocks className="h-4 w-4" color="#fff" />}
              active={active === "configuration"}
              onClick={() => setActive("configuration")}
            />
            <NavItem
              label="Logcat"
              icon={<Terminal className="h-4 w-4" color="#fff" />}
              active={active === "logcat"}
              onClick={() => setActive("logcat")}
              badge="beta"
            />
          </div>
        </div>

        {/* Tools Section */}
        <div>
          <div className="px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Tools</span>
          </div>
          <div className="space-y-1">
            <NavItem
              label="Video Generator"
              icon={<Film className="h-4 w-4" color="#fff" />}
              active={active === "video-generator"}
              onClick={() => setActive("video-generator")}
            />
          </div>
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="p-3 mt-auto flex items-center justify-start">
        <button
          onClick={() => setShowSettings(true)}
          className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/10"
          title="Settings"
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
    </aside>
    </TooltipProvider>
  );
}