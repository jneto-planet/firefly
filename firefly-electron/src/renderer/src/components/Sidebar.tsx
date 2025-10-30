import {
  ChevronDown,
  ChevronRight,
  Settings,
  RefreshCcw,
  MonitorSmartphone,
} from "lucide-react";

import fireflylogo from "../assets/icons/firefly.png";

interface Device {
  serial: string;
  name: string;
  online: boolean;
}

interface SidebarProps {
  // Device management
  devices: Device[];
  selectedSerial: string;
  deviceTitle: string;
  deviceIcon: string | null;
  deviceMenuOpen: boolean;
  setDeviceMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onSelectDeviceSerial: (serial: string) => void;
  refreshDevices: () => void;
  
  // Navigation
  active: "integrate" | "launcher" | "taxfree";
  setActive: (active: "integrate" | "launcher" | "taxfree") => void;
  
  // Settings
  setShowSettings: (show: boolean) => void;
  
  // Helper functions
  currentSerial: () => string | null;
}

interface NavItemProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  iconRight?: boolean;
}

function NavItem({ label, active, disabled, onClick, iconRight }: NavItemProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition
        ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"}
        ${active ? "bg-white/10" : ""}
      `}
    >
      <span className="text-sm text-white">{label}</span>
      {iconRight && <ChevronRight className="h-4 w-4" color="#fff" />}
    </button>
  );
}

export default function Sidebar({
  devices,
  selectedSerial,
  deviceTitle,
  deviceIcon,
  deviceMenuOpen,
  setDeviceMenuOpen,
  onSelectDeviceSerial,
  refreshDevices,
  active,
  setActive,
  setShowSettings,
  currentSerial,
}: SidebarProps) {
  const serial = currentSerial();
  const currentOnline = serial != null;

  return (
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
      
      {/* Device dropdown */}
      <div className="p-4">
        <button
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.06)" }}
          onClick={() => setDeviceMenuOpen(v => !v)}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            {deviceIcon
              ? <img src={deviceIcon} className="h-8 w-8 object-contain" />
              : <MonitorSmartphone className="h-6 w-6" color="#fff" />
            }
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-white truncate">{deviceTitle || "No device"}</div>
            <div className="text-[11px] text-white/60 truncate">{currentOnline ? serial : "No device connected"}</div>
          </div>
          <ChevronDown className={`h-4 w-4 transition ${deviceMenuOpen ? "rotate-180" : ""}`} color="#fff" />
        </button>

        {/* Device menu */}
        {deviceMenuOpen && (
          <div
            className="mt-2 max-h-64 overflow-auto rounded-xl"
            style={{ background: "rgba(8,15,22,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {devices.length === 0 && (
              <div className="px-3 py-3 text-sm text-white/60">No devices found</div>
            )}
            {devices.map((d) => {
              const active = d.serial === selectedSerial;
              return (
                <button
                  key={d.serial}
                  disabled={!d.online}
                  onClick={() => onSelectDeviceSerial(d.serial)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 ${active ? "bg-white/5" : "hover:bg-white/5"} ${!d.online ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                    <MonitorSmartphone className="h-4 w-4" color="#fff" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] text-white">{d.name || d.serial}</div>
                    <div className="text-[11px] text-white/60">{d.serial}{!d.online ? " (offline)" : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="px-2 py-2 flex-1 space-y-1">
        <NavItem
          label="IntegraTE"
          active={active === "integrate"}
          onClick={() => setActive("integrate")}
        />
        <NavItem label="IntegraLauncher" disabled iconRight />
        <NavItem label="TaxFree" disabled iconRight />
      </nav>

      {/* Bottom actions */}
      <div className="p-3 mt-auto flex items-center justify-between">
        <button
          title="Settings"
          onClick={() => setShowSettings(true)}
          className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/10"
        >
          <Settings className="h-5 w-5" color="#fff" />
        </button>
        <button
          title="Refresh devices"
          onClick={refreshDevices}
          className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/10"
        >
          <RefreshCcw className="h-5 w-5" color="#fff" />
        </button>
      </div>
    </aside>
  );
}