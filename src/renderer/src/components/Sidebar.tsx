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
  Eye,
  LayoutGrid,
  HardDriveDownload,
  Waypoints,
  MonitorPlay,
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
  active: "configuration" | "logcat" | "video-generator" | "accessibility" | "apps" | "firmware";
  setActive: (active: "configuration" | "logcat" | "video-generator" | "accessibility" | "apps" | "firmware") => void;
  
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

  // Proxy Tool
  openProxyTool: () => void;
  openingProxyTool: boolean;
  proxyToolConfigured: boolean;

  // OPI Simulator
  openOpiSimulator: () => void;
  openingOpiSimulator: boolean;
  opiSimulatorConfigured: boolean;

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

interface SoftwareCardProps {
  label: string;
  configured: boolean;
  opening: boolean;
  onOpen: () => void;
  openTooltip: string;
  renderIcon: (active: boolean) => React.ReactNode;
  onSettings?: () => void;
  settingsTooltip?: string;
}

function SoftwareCard({
  label,
  configured,
  opening,
  onOpen,
  openTooltip,
  renderIcon,
  onSettings,
  settingsTooltip,
}: SoftwareCardProps) {
  const active = opening && configured;
  return (
    <div className="group relative basis-[calc(33.333%-6px)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onOpen}
            className={`relative h-[66px] w-full rounded-lg flex flex-col items-center justify-center gap-1 px-1 transition ${
              !configured
                ? "opacity-40 hover:opacity-70"
                : active
                ? "bg-white/10"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <motion.div
              animate={active ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.5, repeat: opening ? Infinity : 0 }}
            >
              {renderIcon(active)}
            </motion.div>
            <span className="text-[9px] leading-tight text-center text-white/80 break-words">
              {label}
            </span>
            {active && (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#FFD86A" }}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {configured ? openTooltip : `Configure ${label} path in Settings`}
        </TooltipContent>
      </Tooltip>
      {onSettings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSettings}
              disabled={!configured}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transition disabled:opacity-0 disabled:cursor-not-allowed hover:bg-white/10"
              style={{ background: "#0c1620" }}
            >
              <Settings className="h-3 w-3" color="#fff" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{settingsTooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
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
  openProxyTool,
  openingProxyTool,
  proxyToolConfigured,
  openOpiSimulator,
  openingOpiSimulator,
  opiSimulatorConfigured,
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
      <nav className="px-2 py-2 flex-1 min-h-0 overflow-y-auto space-y-3">
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
              label="Apps"
              icon={<LayoutGrid className="h-4 w-4" color="#fff" />}
              active={active === "apps"}
              onClick={() => setActive("apps")}
            />
            <NavItem
              label="Firmware"
              icon={<HardDriveDownload className="h-4 w-4" color="#fff" />}
              active={active === "firmware"}
              onClick={() => setActive("firmware")}
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

        {/* Software Section */}
        <div>
          <div className="px-3 py-1 mb-1">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Software</span>
          </div>
          <div className="px-2 flex flex-wrap gap-2">
            <SoftwareCard
              label="Butterfly"
              configured={butterflyConfigured}
              opening={openingButterfly}
              onOpen={openButterfly}
              openTooltip="Open Butterfly"
              renderIcon={(active) => (
                <PiButterflyLight className="h-4 w-4" color={active ? "#FFD86A" : "#fff"} />
              )}
            />

            <SoftwareCard
              label="Proxy Tool"
              configured={proxyToolConfigured}
              opening={openingProxyTool}
              onOpen={openProxyTool}
              openTooltip="Open Proxy Tool"
              renderIcon={(active) => (
                <Waypoints className="h-4 w-4" color={active ? "#FFD86A" : "#fff"} />
              )}
            />

            <SoftwareCard
              label="OPI Simulator"
              configured={opiSimulatorConfigured}
              opening={openingOpiSimulator}
              onOpen={openOpiSimulator}
              openTooltip="Open OPI Simulator"
              renderIcon={(active) => (
                <MonitorPlay className="h-4 w-4" color={active ? "#FFD86A" : "#fff"} />
              )}
            />

            <SoftwareCard
              label="Logger Client"
              configured={loggerClientConfigured}
              opening={openingLoggerClient}
              onOpen={openLoggerClient}
              openTooltip="Open Logger Client"
              renderIcon={(active) => (
                <LoggerClientIcon className="h-4 w-4" color={active ? "#FFD86A" : "#fff"} />
              )}
              onSettings={openLoggerClientSettings}
              settingsTooltip="Manual connection params"
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
            <NavItem
              label="Accessibility"
              icon={<Eye className="h-4 w-4" color="#fff" />}
              active={active === "accessibility"}
              onClick={() => setActive("accessibility")}
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