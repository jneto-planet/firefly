import React from "react";
import { resolveDeviceIconByModelManu } from "./lib/deviceIcons";
import Sidebar from "./components/Sidebar";
import SplashScreen from "./components/SplashScreen";
import TitleBar from "./components/TitleBar";
import Configuration from "./components/Configuration";
import Logcat from "./components/Logcat";
import VideoGenerator from "./components/VideoGenerator";
import AccessibilityConverter from "./components/AccessibilityConverter";
import Apps from "./components/Apps";
import { prefetchApps } from "./lib/appsCache";
import ScreenshotDialog from "./components/ScreenshotDialog";
import ConfigurationSettingsDialog from "./components/ConfigurationSettingsDialog";
import RecordingOptionsDialog from "./components/RecordingOptionsDialog";
import LoggerClientParamsDialog from "./components/LoggerClientParamsDialog";
import { Save, XCircle } from "lucide-react";

interface Device {
  serial: string;
  name: string;
  online: boolean;
}

interface XmlItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

const ACCENT = "#FFD86A";

// App constants
const TARGET_PACKAGE = "com.cccintegra.pax";
const TARGET_XML_PATH = "files/appconfig/cccterminal/3cixml/cccterminal-3cixml-default.xml";
const TEMP_XML_PATH = "/sdcard/3cxml_temp.xml";

export default function App() {
  // ---- State ----
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [selectedSerial, setSelectedSerial] = React.useState<string>("");
  const [deviceIcon, setDeviceIcon] = React.useState<string | null>(null);
  const [deviceTitle, setDeviceTitle] = React.useState<string>("No device");
  const [deviceIcons, setDeviceIcons] = React.useState<Record<string, string | null>>({});
  const [deviceIpAddress, setDeviceIpAddress] = React.useState<string | null>(null);
  const [deviceBatteryLevel, setDeviceBatteryLevel] = React.useState<number | null>(null);
  const [deviceIsCharging, setDeviceIsCharging] = React.useState<boolean>(false);
  const [deviceAndroidVersion, setDeviceAndroidVersion] = React.useState<string | null>(null);

  const [pollingEnabled, setPollingEnabled] = React.useState<boolean>(true);
  const [pollingInterval, setPollingInterval] = React.useState<number>(2000);

  const [dir3cxml, setDir3cxml] = React.useState<string>("");

  const [xmlList, setXmlList] = React.useState<XmlItem[]>([]);
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("");
  const [currentDir, setCurrentDir] = React.useState<string>("");

  const [busy, setBusy] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("Loading...");

  // UI shell
  const [deviceMenuOpen, setDeviceMenuOpen] = React.useState(false);
  const [active, setActive] = React.useState<"configuration" | "logcat" | "video-generator" | "accessibility" | "apps">("configuration");

  // Settings dialog
  const [showSettings, setShowSettings] = React.useState(false);
  const [showConfigSettings, setShowConfigSettings] = React.useState(false);

  // ADB and Scrcpy diagnostics state
  const [adbStatus, setAdbStatus] = React.useState<{ working: boolean; path: string; error?: string } | null>(null);
  const [testingAdb, setTestingAdb] = React.useState<boolean>(false);
  const [scrcpyStatus, setScrcpyStatus] = React.useState<{ working: boolean; path: string; error?: string } | null>(null);
  const [testingScrcpy, setTestingScrcpy] = React.useState<boolean>(false);
  const [butterflyPath, setButterflyPath] = React.useState<string>("");
  const [loggerClientPath, setLoggerClientPath] = React.useState<string>("");
  const [loggerClientSendParams, setLoggerClientSendParams] = React.useState(false);
  const [showLoggerClientDialog, setShowLoggerClientDialog] = React.useState(false);

  // Version and update state
  const [currentVersion, setCurrentVersion] = React.useState<string>("1.0.0");
  const [checkingForUpdates, setCheckingForUpdates] = React.useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = React.useState<boolean>(false);
  const [updateVersion, setUpdateVersion] = React.useState<string | null>(null);

  // Splash screen
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Reentrancy/cleanup guards
  const isMounted = React.useRef(true);
  const refreshingDevices = React.useRef(false);
  const [scrcpyLaunched, setScrcpyLaunched] = React.useState(false); // Track if scrcpy has been launched for current session
  
  // Screenshot state
  const [takingScreenshot, setTakingScreenshot] = React.useState(false);
  const [screenshotData, setScreenshotData] = React.useState<string | null>(null);
  const [screenshotCopied, setScreenshotCopied] = React.useState(false);
  
  // Butterfly state
  const [openingButterfly, setOpeningButterfly] = React.useState(false);

  // Logger Client state
  const [openingLoggerClient, setOpeningLoggerClient] = React.useState(false);
  
  // Screen Recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingPath, setRecordingPath] = React.useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const recordingStartTimeRef = React.useRef<number | null>(null);
  const [recordingOptionsOpen, setRecordingOptionsOpen] = React.useState(false);
  const [recordingOptions, setRecordingOptions] = React.useState<{
    bitRate: number;
    resolution: number;
    showTaps: boolean;
    savePath: string;
  }>({ bitRate: 4, resolution: 100, showTaps: true, savePath: "" });
  
  React.useEffect(() => {
    isMounted.current = true;
    boot();
    
    // Listen for scrcpy close event from main process
    const cleanup = window.firefly.onScrcpyClosed(() => {
      console.log("[renderer] Scrcpy process closed, resetting flag");
      setScrcpyLaunched(false);
    });
    
    return () => { 
      isMounted.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer effect for recording
  React.useEffect(() => {
    if (isRecording && recordingStartTimeRef.current) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current!) / 1000);
        setRecordingSeconds(elapsed);
      }, 1000);
      
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isRecording]);

  // Auto-refresh devices based on polling config
  React.useEffect(() => {
    if (!pollingEnabled) return;

    const interval = setInterval(() => {
      refreshDevices();
    }, pollingInterval);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSerial, devices, pollingEnabled, pollingInterval]);

  // whenever dir3cxml changes, (re)load the list
  React.useEffect(() => {
    if (dir3cxml) {
      setCurrentDir(dir3cxml);
      refreshXml();
    } else {
      setXmlList([]);
      setCurrentDir("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir3cxml]);

  // whenever currentDir changes, (re)load the list
  React.useEffect(() => {
    if (currentDir) {
      refreshXml();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDir]);



  async function boot() {
    try {
      const cfg = await window.firefly.getConfig();
      if (!isMounted.current) return;
      setDir3cxml(cfg?.dir_3cxml || "");
      setPollingEnabled(cfg?.polling_enabled ?? true);
      setPollingInterval(cfg?.polling_interval ?? 2000);
      
      // Load recording preferences
      setRecordingOptions({
        bitRate: cfg?.recording_bit_rate ?? 4,
        resolution: cfg?.recording_resolution ?? 100,
        showTaps: cfg?.recording_show_taps ?? true,
        savePath: cfg?.recording_save_path || ""
      });
      
      // Initialize ADB and Scrcpy status from environment detection only
      // If found in environment, show the path; if not found, show empty state
      try {
        const adbResult = await window.firefly.testAdb();
        setAdbStatus(adbResult);
      } catch (e) {
        setAdbStatus({ working: false, path: '', error: 'Not found in environment' });
      }
      
      try {
        const scrcpyResult = await window.firefly.detectScrcpy();
        setScrcpyStatus(scrcpyResult);
      } catch (e) {
        setScrcpyStatus({ working: false, path: '', error: 'Not found in environment' });
      }

      setButterflyPath(cfg?.butterfly_path || "");
      setLoggerClientPath(cfg?.logger_client_path || "");
      setLoggerClientSendParams(cfg?.logger_client_send_params ?? false);
    } catch (e) {
      console.error("getConfig failed:", e);
    }
    
    await refreshDevices();
    
    // Dismiss splash screen immediately after first device refresh
    handleLoadingComplete();
  }



  const handleLoadingComplete = () => {
    if (isMounted.current) {
      setIsLoading(false);
    }
  };

  async function refreshDevices() {
    if (refreshingDevices.current) return; // prevent overlap
    refreshingDevices.current = true;

    try {
      const list = await window.firefly.listDevices();
      if (!isMounted.current) return;
      setDevices(list);

      // Fetch icons for all online devices
      const iconsMap: Record<string, string | null> = {};
      for (const device of list.filter(d => d.online)) {
        try {
          const props = await window.firefly.getDeviceProps(device.serial);
          const iconUrl = resolveDeviceIconByModelManu(props.model, props.manufacturer);
          iconsMap[device.serial] = iconUrl || null;
        } catch {
          iconsMap[device.serial] = null;
        }
      }
      if (!isMounted.current) return;
      setDeviceIcons(iconsMap);

      // If we had a selectedSerial but it's no longer available, clear it
      if (selectedSerial && !list.some(d => d.serial === selectedSerial)) {
        setSelectedSerial("");
        setDeviceIcon(null);
        setDeviceTitle("No device");
        setScrcpyLaunched(false); // Reset scrcpy flag when device disconnects
      }

      // Auto-select first online device if none selected
      if (!selectedSerial && list.some(d => d.online)) {
        const first = list.find(d => d.online);
        if (first) {
          setSelectedSerial(first.serial);
          // Set device title immediately from the list data
          setDeviceTitle(first.name || first.serial);
          // Then update the icon asynchronously
          updateDeviceIconOnly(first.serial);
        } else {
          setDeviceIcon(null);
          setDeviceTitle("No device");
        }
      } else if (selectedSerial) {
        // Update info for current device
        const found = list.find(d => d.serial === selectedSerial);
        if (found && found.online) {
          // Set device title immediately from the list data
          setDeviceTitle(found.name || found.serial);
          // Then update the icon asynchronously
          updateDeviceIconOnly(found.serial);
        } else {
          setDeviceIcon(null);
        }
      } else {
        setDeviceIcon(null);
        setDeviceTitle("No device");
      }

      setStatus(
        list.length
          ? "Ready"
          : "No devices. Connect and enable USB debugging."
      );

      // Background prefetch apps for all online devices (no-op if already cached)
      for (const device of list.filter(d => d.online)) {
        prefetchApps(device.serial);
      }
    } catch (e) {
      setStatus("ADB error");
      console.error("listDevices failed:", e);
    } finally {
      refreshingDevices.current = false;
    }
  }

  async function updateDeviceIconOnly(serial: string) {
    try {
      const props = await window.firefly.getDeviceProps(serial);
      if (!isMounted.current) return;
      const iconUrl = resolveDeviceIconByModelManu(props.model, props.manufacturer);
      console.log('[firefly] Device props received:', { model: props.model, manufacturer: props.manufacturer, ipAddress: props.ipAddress, battery: props.batteryLevel, charging: props.isCharging, android: props.androidVersion });
      setDeviceIcon(iconUrl || null);
      setDeviceIpAddress(props.ipAddress ?? null);
      setDeviceBatteryLevel(props.batteryLevel ?? null);
      setDeviceIsCharging(props.isCharging ?? false);
      setDeviceAndroidVersion(props.androidVersion ?? null);
    } catch {
      if (!isMounted.current) return;
      setDeviceIcon(null);
      setDeviceIpAddress(null);
      setDeviceBatteryLevel(null);
      setDeviceIsCharging(false);
      setDeviceAndroidVersion(null);
    }
  }

  async function refreshXml() {
    if (!currentDir) { setXmlList([]); return; }
    try {
      const list: XmlItem[] = await window.firefly.listXml(currentDir);
      if (!isMounted.current) return;
      setXmlList(list);
      setSelectedIdx(null);
      setSelectedPath(null);
    } catch (e) {
      console.error("listXml failed:", e);
      if (!isMounted.current) return;
      setXmlList([]);
    }
  }

  function filteredXml(): XmlItem[] {
    const q = filter.trim().toLowerCase();
    if (!q) return xmlList;
    return xmlList.filter(x => `${x.name}`.toLowerCase().includes(q));
  }

  function filteredXmlFiles(): XmlItem[] {
    return filteredXml().filter(x => x.type === 'file');
  }

  function navigateToFolder(folderPath: string) {
    setCurrentDir(folderPath);
    setSelectedIdx(null);
    setFilter("");
  }

  function navigateUp() {
    if (currentDir && currentDir !== dir3cxml) {
      // Remove trailing slash if present
      const normalizedPath = currentDir.endsWith('/') ? currentDir.slice(0, -1) : currentDir;
      const pathParts = normalizedPath.split('/');
      
      // Remove the last part to go up one level
      pathParts.pop();
      const parentDir = pathParts.join('/');
      
      // If parent is within or equal to root, use it; otherwise fall back to root
      if (parentDir && parentDir.startsWith(dir3cxml)) {
        setCurrentDir(parentDir);
      } else {
        setCurrentDir(dir3cxml);
      }
      setSelectedIdx(null);
      setFilter("");
    }
  }

  function currentSerial(): string | null {
    return selectedSerial || null;
  }

  async function handleLaunchScrcpy() {
    const serial = currentSerial();
    if (!serial) {
      return; // Button should be disabled anyway
    }

    // Prevent multiple launches
    if (scrcpyLaunched) {
      console.log("Scrcpy already launched for this session");
      return;
    }

    try {
      const success = await window.firefly.launchScrcpy({ serial });
      if (success) {
        setScrcpyLaunched(true); // Mark as launched to track state
      }
    } catch (e) {
      console.error("Failed to launch scrcpy:", e);
    }
  }

  async function handleOpenButterfly() {
    if (!butterflyPath) {
      setShowSettings(true);
      return;
    }
    try {
      setOpeningButterfly(true);
      const success = await window.firefly.openButterfly();
      if (!success) {
        console.error("Failed to open Butterfly");
      }
      // Keep feedback for 2 seconds
      setTimeout(() => setOpeningButterfly(false), 2000);
    } catch (e) {
      console.error("Error opening Butterfly:", e);
      setOpeningButterfly(false);
    }
  }

  async function handleOpenLoggerClient() {
    if (!loggerClientPath) {
      setShowSettings(true);
      return;
    }
    try {
      setOpeningLoggerClient(true);
      const params = loggerClientSendParams && deviceIpAddress
        ? { ip: deviceIpAddress, port: "10000", pattern: "%d [%c{1}] %p - %m" }
        : undefined;
      const success = await window.firefly.openLoggerClient(params);
      if (!success) {
        console.error("Failed to open Logger Client");
      }
      // Keep feedback for 2 seconds
      setTimeout(() => setOpeningLoggerClient(false), 2000);
    } catch (e) {
      console.error("Error opening Logger Client:", e);
      setOpeningLoggerClient(false);
    }
  }

  async function handleOpenLoggerClientWithParams(params: { ip: string; port: string; pattern: string }) {
    try {
      setOpeningLoggerClient(true);
      const success = await window.firefly.openLoggerClient(params);
      if (!success) {
        console.error("Failed to open Logger Client");
      }
      setTimeout(() => setOpeningLoggerClient(false), 2000);
    } catch (e) {
      console.error("Error opening Logger Client:", e);
      setOpeningLoggerClient(false);
    }
  }

  async function handleTakeScreenshot() {
    const serial = currentSerial();
    if (!serial) {
      return;
    }

    setTakingScreenshot(true);
    try {
      const base64Data = await window.firefly.takeScreenshot({ serial });
      console.log(`[renderer] Received screenshot data: ${base64Data.substring(0, 100)}... (${base64Data.length} chars)`);
      setScreenshotData(base64Data);
      setScreenshotCopied(false); // Reset copied state on new capture
    } catch (e) {
      console.error("Failed to take screenshot:", e);
      alert(`Failed to take screenshot: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setTakingScreenshot(false);
    }
  }

  async function handleRecaptureScreenshot() {
    const serial = currentSerial();
    if (!serial) {
      return;
    }

    setTakingScreenshot(true);
    try {
      const base64Data = await window.firefly.takeScreenshot({ serial });
      console.log(`[renderer] Recaptured screenshot data: ${base64Data.substring(0, 100)}... (${base64Data.length} chars)`);
      setScreenshotData(base64Data);
      setScreenshotCopied(false); // Reset copied state
    } catch (e) {
      console.error("Failed to recapture screenshot:", e);
      alert(`Failed to recapture screenshot: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setTakingScreenshot(false);
    }
  }

  async function handleSaveScreenshot() {
    if (!screenshotData) return;
    
    try {
      const deviceName = deviceTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = await window.firefly.saveScreenshot({
        base64Data: screenshotData,
        deviceName,
      });
      
      if (filePath) {
        // Close dialog after successful save
        setScreenshotData(null);
        // Optionally reveal the file
        await window.firefly.revealInFileManager(filePath);
      }
    } catch (e) {
      console.error("Failed to save screenshot:", e);
      alert(`Failed to save screenshot: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async function handleCopyScreenshotToClipboard() {
    if (!screenshotData) return;
    
    try {
      // Convert base64 to Uint8Array using native APIs
      const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
      
      // Decode base64 to binary string
      const binaryString = atob(base64Data);
      
      // Convert binary string to Uint8Array
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob from Uint8Array
      const blob = new Blob([uint8Array], { type: 'image/png' });
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      // Show success state
      setScreenshotCopied(true);
      
      // Reset success state after 2 seconds
      setTimeout(() => setScreenshotCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
      alert(`Failed to copy to clipboard: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async function handleToggleScreenRecording() {
    const serial = currentSerial();
    if (!serial) {
      console.warn("[renderer] No device serial found");
      return;
    }

    if (isRecording) {
      // Stop recording
      console.log("[renderer] ========== STOP RECORDING (RENDERER) ==========");
      console.log(`[renderer] Device serial: ${serial}`);
      console.log(`[renderer] Recording path: ${recordingPath}`);
      
      if (!recordingPath) {
        console.error("[renderer] No recording path found");
        alert("Error: No recording path found. Please try recording again.");
        return;
      }

      // Immediately stop the timer and update UI
      console.log("[renderer] Stopping timer and updating UI...");
      setIsRecording(false);
      recordingStartTimeRef.current = null;

      try {
        console.log("[renderer] Calling stopScreenRecording IPC...");
        const result = await window.firefly.stopScreenRecording({ serial, recordingPath });
        console.log("[renderer] IPC result:", JSON.stringify(result, null, 2));
        
        if (result.success && result.filePath) {
          console.log(`[renderer] Screen recording saved to ${result.filePath}`);
          // Auto-reveal the file location
          await window.firefly.revealInFileManager(result.filePath);
        } else if (result.canceled) {
          console.log(`[renderer] Screen recording save was canceled`);
        } else {
          console.warn(`[renderer] Unexpected result:`, result);
          if (result.message) {
            alert(`Recording stopped but save failed: ${result.message}`);
          }
        }
      } catch (e) {
        console.error("[renderer] ========== STOP RECORDING ERROR (RENDERER) ==========");
        console.error("[renderer] Error type:", e instanceof Error ? e.constructor.name : typeof e);
        console.error("[renderer] Error message:", e instanceof Error ? e.message : String(e));
        console.error("[renderer] Full error:", e);
        alert(`Failed to stop screen recording: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        // Clean up remaining state
        setRecordingPath(null);
        setRecordingSeconds(0);
      }
    } else {
      // Show options dialog before starting
      console.log("[renderer] Opening recording options dialog");
      setRecordingOptionsOpen(true);
    }
  }

  async function handleStartRecordingWithOptions(options: { bitRate: number; resolution: number; showTaps: boolean; savePath: string }) {
    const serial = currentSerial();
    if (!serial) {
      console.warn("[renderer] No device serial found");
      return;
    }

    console.log("[renderer] ========== START RECORDING (RENDERER) ==========");
    console.log(`[renderer] Device serial: ${serial}`);
    console.log(`[renderer] Options:`, options);

    try {
      // Save options to state and config for next time
      setRecordingOptions(options);
      await window.firefly.setConfig({
        recording_bit_rate: options.bitRate,
        recording_resolution: options.resolution,
        recording_show_taps: options.showTaps,
        recording_save_path: options.savePath
      });

      console.log("[renderer] Calling startScreenRecording IPC...");
      const result = await window.firefly.startScreenRecording({
        serial,
        bitRate: options.bitRate,
        resolution: options.resolution,
        showTaps: options.showTaps
      });
      console.log("[renderer] IPC result:", JSON.stringify(result, null, 2));
      
      if (result.success && result.recordingPath) {
        console.log(`[renderer] Screen recording started: ${result.recordingPath}`);
        console.log(`[renderer] SDK version: ${result.sdkVersion}, Time limit: ${result.timeLimitInfo}`);
        setIsRecording(true);
        setRecordingPath(result.recordingPath);
        setRecordingSeconds(0);
        recordingStartTimeRef.current = Date.now();
        setRecordingOptionsOpen(false);
      } else {
        console.warn(`[renderer] Failed to start recording:`, result);
        alert(`Failed to start screen recording: ${result.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("[renderer] ========== START RECORDING ERROR (RENDERER) ==========");
      console.error("[renderer] Error:", e);
      alert(`Failed to start screen recording: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async function handleConfigureSavePath(): Promise<string | undefined> {
    try {
      const currentPath = recordingOptions.savePath || "";
      const result = await window.firefly.pickDirectory(currentPath);
      if (result) {
        const newOptions = { ...recordingOptions, savePath: result };
        setRecordingOptions(newOptions);
        await window.firefly.setConfig({ recording_save_path: result });
        return result;
      }
    } catch (e) {
      console.error("Failed to pick save path:", e);
      alert(`Failed to select save location: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    return undefined;
  }

  async function onSelectDeviceSerial(serial: string) {
    setSelectedSerial(serial);
    setDeviceMenuOpen(false);
    setScrcpyLaunched(false); // Reset scrcpy flag when device changes
    if (!serial) {
      setDeviceIcon(null);
      setDeviceTitle("No device");
      return;
    }
    // Set device title immediately from the devices array
    const found = devices.find(d => d.serial === serial);
    setDeviceTitle(found?.name || serial);
    // Then update the icon asynchronously
    updateDeviceIconOnly(serial);
  }

  async function handleChooseDirectory() {
    try {
      const d = await window.firefly.pickDirectory(dir3cxml);
      if (d) {
        setDir3cxml(d);
        await window.firefly.setConfig({ dir_3cxml: d });
      }
    } catch (e) {
      console.error("pickDirectory 3cxml failed:", e);
    }
  }

  async function handleSaveConfigSettings(editorPath: string, clearTidFromDataStore: boolean) {
    try {
      await window.firefly.setConfig({ xml_editor_path: editorPath, clear_tid_from_datastore: clearTidFromDataStore });
    } catch (e) {
      console.error("Failed to save configuration settings:", e);
      alert(`Failed to save settings: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  async function onSend() {
    const serial = currentSerial();
    if (!serial || !selectedPath) return;

    // selectedPath is the full path to the file, we can use it directly
    setBusy(true);
    setStatus("Sending…");

    try {
      // 0. Get config to check if we should clear TID
      const config = await window.firefly.getConfig();
      
      // 1. Clear TID from DataStore if enabled
      if (config.clear_tid_from_datastore) {
        setStatus("Clearing TID from DataStore…");
        try {
          const result = await window.firefly.clearTidFromDataStore({
            pkg: TARGET_PACKAGE,
            serial
          });
          console.log("Clear TID result:", result);
        } catch (e: any) {
          console.error("Failed to clear TID (continuing anyway):", e);
          // Don't fail the entire operation if this fails
        }
      }

      // 2. Delete old files
      setStatus("Deleting old configuration…");
      await window.firefly.deleteOldCccFiles({ 
        pkg: TARGET_PACKAGE,
        serial 
      });

      // 3. Push new config
      setStatus("Sending new configuration…");
      await window.firefly.pushAndReplace({
        localPath: selectedPath,
        pkg: TARGET_PACKAGE,
        relTarget: TARGET_XML_PATH,
        sdcardTemp: TEMP_XML_PATH,
        serial
      });

      // 4. Restart the app
      setStatus("Restarting terminal app…");
      const restartOk = await window.firefly.restartApp({ pkg: TARGET_PACKAGE, serial });
      if (!restartOk) {
        throw new Error("Failed to restart terminal app");
      }

      setStatus("Configuration updated with success");
    } catch (e: any) {
      setStatus(`Send failed: ${e.message || e}`);
      console.error("onSend failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function handleGetConfigFromTerminal() {
    const serial = currentSerial();
    if (!serial) return;

    setBusy(true);
    setStatus("Downloading configuration from terminal…");

    try {
      // Use the current directory or root 3cxml folder as default save location
      const baseDir = currentDir || dir3cxml || "";
      const defaultSavePath = baseDir ? `${baseDir}/terminal-config.xml` : "terminal-config.xml";
      
      const result = await window.firefly.pullXmlFromDevice({
        pkg: TARGET_PACKAGE,
        relTarget: TARGET_XML_PATH,
        serial,
        defaultSavePath
      });

      if (result.canceled) {
        setStatus("Download canceled");
        return;
      }

      if (result.success && result.filePath) {
        setStatus("Configuration downloaded successfully");
        // Refresh the XML list to show the new file
        await refreshXml();
      }
    } catch (e: any) {
      setStatus(`Download failed: ${e.message || e}`);
      console.error("handleGetConfigFromTerminal failed:", e);
      alert(`Failed to download configuration:\n\n${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  function SettingsDialog() {
    // keep fields in sync if settings reopen
    React.useEffect(() => {
      if (!showSettings) return;
      // Load current version only
      loadCurrentVersion();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSettings]);

    async function loadCurrentVersion() {
      try {
        const version = await window.firefly.getAppVersion();
        setCurrentVersion(version);
      } catch (e) {
        console.error("Failed to get app version:", e);
      }
    }

    async function checkForUpdates() {
      setCheckingForUpdates(true);
      try {
        const result = await window.firefly.checkForUpdates();
        
        // Only mark as available if the version is different from current
        const isUpdateAvailable = result.available && result.version !== currentVersion;
        setUpdateAvailable(isUpdateAvailable);
        setUpdateVersion(result.version);
        
        if (!isUpdateAvailable) {
          if ((result as any).message) {
            // Development mode
            alert((result as any).message);
          } else {
            // Production mode - no updates available
            alert("You're running the latest version!");
          }
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
        alert(`Failed to check for updates: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        setCheckingForUpdates(false);
      }
    }

    async function testAdbStatus() {
      if (!adbStatus?.path) return; // Don't test if no path selected
      
      setTestingAdb(true);
      try {
        // First set the custom path, then test
        await window.firefly.setCustomAdbPath(adbStatus.path);
        const result = await window.firefly.testAdb();
        setAdbStatus(result);
      } catch (e) {
        console.error("Failed to test ADB:", e);
        setAdbStatus({ working: false, path: adbStatus.path, error: `Test failed: ${e}` });
      } finally {
        setTestingAdb(false);
      }
    }

    async function save() {
      try {
        const configUpdates: any = {};
        
        // Only save ADB/Scrcpy paths if they have been tested and are working
        if (adbStatus?.path && adbStatus.working) {
          await window.firefly.setCustomAdbPath(adbStatus.path);
          configUpdates.custom_adb_path = adbStatus.path;
        }
        
        if (scrcpyStatus?.path && scrcpyStatus.working) {
          await window.firefly.setCustomScrcpyPath(scrcpyStatus.path);
          configUpdates.custom_scrcpy_path = scrcpyStatus.path;
        }
        
        // Save polling settings
        configUpdates.polling_enabled = pollingEnabled;
        configUpdates.polling_interval = pollingInterval;
        
        // Save butterfly path
        configUpdates.butterfly_path = butterflyPath;

        // Save logger client path
        configUpdates.logger_client_path = loggerClientPath;
        configUpdates.logger_client_send_params = loggerClientSendParams;
        
        await window.firefly.setConfig(configUpdates);
        setShowSettings(false);
        await refreshDevices();
      } catch (e) {
        console.error("save settings failed:", e);
        alert("Failed to save settings");
      }
    }
    async function testScrcpyStatus() {
      if (!scrcpyStatus?.path) return; // Don't test if no path selected
      
      setTestingScrcpy(true);
      try {
        const result = await window.firefly.testScrcpy(scrcpyStatus.path);
        setScrcpyStatus(result);
      } catch (e) {
        setScrcpyStatus({ working: false, path: scrcpyStatus.path, error: `Test failed: ${e}` });
      } finally {
        setTestingScrcpy(false);
      }
    }


    async function browseScrcpy() {
      try {
        console.log("Opening file picker for Scrcpy...");
        const file = await window.firefly.pickFile({
          title: "Select Scrcpy Executable",
          fileType: 'executable'
        });
        console.log("File picker result:", file);
        if (file) {
          // Only set the path, don't save or test automatically
          setScrcpyStatus({ working: false, path: file });
        }
      } catch (e) { 
        console.error("pickFile scrcpy failed:", e);
        alert(`Failed to open file picker: ${e}`);
      }
    }
    
    async function browseAdb() {
      try {
        console.log("Opening file picker for ADB...");
        const file = await window.firefly.pickFile({
          title: "Select ADB Executable",
          fileType: 'executable'
        });
        console.log("File picker result:", file);
        if (file) {
          // Only set the path, don't save or test automatically
          setAdbStatus({ working: false, path: file });
        }
      } catch (e) { 
        console.error("pickFile adb failed:", e);
        alert(`Failed to open file picker: ${e}`);
      }
    }

    async function browseButterfly() {
      try {
        const path = await window.firefly.pickFile({
          title: "Select Butterfly Script",
          fileType: "any",
        });
        if (path) {
          setButterflyPath(path);
        }
      } catch (e) {
        alert(`Failed to open file picker: ${e}`);
      }
    }

    async function browseLoggerClient() {
      try {
        const path = await window.firefly.pickFile({
          title: "Select Logger Client Executable",
          fileType: "executable",
        });
        if (path) {
          setLoggerClientPath(path);
        }
      } catch (e) {
        alert(`Failed to open file picker: ${e}`);
      }
    }
    




    if (!showSettings) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.8)" }}
        onClick={() => setShowSettings(false)}
      >
        <div
          className="w-full max-w-md p-6 rounded-2xl space-y-4"
          style={{ background: "#08121A", border: "1px solid rgba(255,255,255,0.1)" }}
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-xl font-semibold text-white">Settings</h2>

          <div className="space-y-4">
            <div className="border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">ADB Status</div>
                  {adbStatus ? (
                    <>
                      <div className={`text-xs ${adbStatus.working ? 'text-green-400' : 'text-red-400'}`}
                        style={{ fontWeight: 500 }}>
                        {adbStatus.working ? <span>ADB working correctly</span> : <span>ADB needs configuration</span>}
                      </div>
                      <div className="text-xs text-white/40 truncate" style={{ maxWidth: '200px' }} title={adbStatus.path}>Path: {adbStatus.path}</div>
                      {adbStatus.error && (
                        <div className="text-xs text-red-400 mt-1">{adbStatus.error}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-white/60">Testing...</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={testAdbStatus}
                    disabled={testingAdb || !adbStatus?.path}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ 
                      borderColor: "rgba(255,255,255,0.12)", 
                      color: "#fff",
                      opacity: (testingAdb || !adbStatus?.path) ? 0.5 : 1
                    }}
                  >
                    {testingAdb ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={browseAdb}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    Select...
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">Scrcpy Status</div>
                  {scrcpyStatus ? (
                    <>
                      <div className={`text-xs ${scrcpyStatus.working ? 'text-green-400' : 'text-red-400'}`}
                        style={{ fontWeight: 500 }}>
                        {scrcpyStatus.working ? <span>Scrcpy working correctly</span> : <span>Scrcpy needs configuration</span>}
                      </div>
                      <div className="text-xs text-white/40 truncate" style={{ maxWidth: '200px' }} title={scrcpyStatus.path}>Path: {scrcpyStatus.path}</div>
                      {scrcpyStatus.error && (
                        <div className="text-xs text-red-400 mt-1">{scrcpyStatus.error}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-white/60">Testing...</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={testScrcpyStatus}
                    disabled={testingScrcpy || !scrcpyStatus?.path}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ 
                      borderColor: "rgba(255,255,255,0.12)", 
                      color: "#fff",
                      opacity: (testingScrcpy || !scrcpyStatus?.path) ? 0.5 : 1
                    }}
                  >
                    {testingScrcpy ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={browseScrcpy}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    Select...
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">Butterfly Path</div>
                  <div className="text-xs text-white/60">Path to the Butterfly script</div>
                  {butterflyPath && (
                    <div className="text-xs text-white/40 truncate" style={{ maxWidth: '200px' }} title={butterflyPath}>Path: {butterflyPath}</div>
                  )}
                </div>
                <button
                  onClick={browseButterfly}
                  className="px-3 py-1 text-xs rounded border"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  Select...
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">Logger Client Path</div>
                  <div className="text-xs text-white/60">Path to the Logger Client executable</div>
                  {loggerClientPath && (
                    <div className="text-xs text-white/40 truncate" style={{ maxWidth: '200px' }} title={loggerClientPath}>Path: {loggerClientPath}</div>
                  )}
                </div>
                <button
                  onClick={browseLoggerClient}
                  className="px-3 py-1 text-xs rounded border"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  Select...
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">Pass Connection Params</div>
                  <div className="text-xs text-white/60">Auto-fill IP and port when launching Logger Client</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loggerClientSendParams}
                    onChange={(e) => setLoggerClientSendParams(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: ACCENT }}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">Polling</div>
                  <div className="text-xs text-white/60">Auto-refresh device list</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pollingEnabled}
                      onChange={(e) => setPollingEnabled(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: ACCENT }}
                    />
                    <span className="text-xs text-white">Enabled</span>
                  </label>
                  {pollingEnabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={pollingInterval / 1000}
                        onChange={(e) => setPollingInterval(Math.max(1, parseInt(e.target.value) || 1) * 1000)}
                        min="1"
                        max="60"
                        className="w-16 px-2 py-1 text-xs rounded border bg-transparent text-white"
                        style={{ borderColor: "rgba(255,255,255,0.12)" }}
                      />
                      <span className="text-xs text-white/60">sec</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="my-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}></div>

              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-white">App Version</div>
                  <div className="text-xs text-white/60">Current: v{currentVersion}</div>
                  {updateAvailable && updateVersion && (
                    <div className="text-xs text-green-400">Update available: v{updateVersion}</div>
                  )}
                </div>
                <button
                  onClick={checkForUpdates}
                  disabled={checkingForUpdates}
                  className="px-3 py-1 text-xs rounded border"
                  style={{ 
                    borderColor: "rgba(255,255,255,0.12)", 
                    color: "#fff",
                    opacity: checkingForUpdates ? 0.5 : 1
                  }}
                >
                  {checkingForUpdates ? "Checking..." : "Check for Updates"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 px-4 py-2 rounded-lg border flex items-center justify-center gap-2"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              <XCircle size={16} />
              Cancel
            </button>
            <button
              onClick={save}
              className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2"
              style={{ background: ACCENT, color: "#1a1a1a" }}
            >
              <Save size={16} />
              Apply
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show splash screen while loading
  if (isLoading) {
    return <SplashScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <div className="h-screen w-screen">
      <TitleBar 
        devices={devices}
        selectedSerial={selectedSerial}
        deviceTitle={deviceTitle}
        deviceIcons={deviceIcons}
        deviceMenuOpen={deviceMenuOpen}
        setDeviceMenuOpen={setDeviceMenuOpen}
        onSelectDeviceSerial={onSelectDeviceSerial}
        refreshDevices={refreshDevices}
      />
      <div className="h-full flex" style={{ background: "#08121A", paddingTop: "32px" }}>
        <Sidebar
          deviceTitle={deviceTitle}
          deviceIcon={deviceIcon}
          deviceIpAddress={deviceIpAddress}
          deviceBatteryLevel={deviceBatteryLevel}
          deviceIsCharging={deviceIsCharging}
          deviceAndroidVersion={deviceAndroidVersion}
          refreshDevices={refreshDevices}
          active={active}
          setActive={setActive}
          setShowSettings={setShowSettings}
          currentSerial={currentSerial}
          launchScrcpy={handleLaunchScrcpy}
          scrcpyActive={scrcpyLaunched}
          takeScreenshot={handleTakeScreenshot}
          takingScreenshot={takingScreenshot}
          openButterfly={handleOpenButterfly}
          openingButterfly={openingButterfly}
          butterflyConfigured={!!butterflyPath}
          openLoggerClient={handleOpenLoggerClient}
          openingLoggerClient={openingLoggerClient}
          loggerClientConfigured={!!loggerClientPath}
          openLoggerClientSettings={() => setShowLoggerClientDialog(true)}
          toggleScreenRecording={handleToggleScreenRecording}
          isRecording={isRecording}
          recordingSeconds={recordingSeconds}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {active === "configuration" && (
            <Configuration
              busy={busy}
              dir3cxml={dir3cxml}
              currentDir={currentDir}
              setCurrentDir={setCurrentDir}
              navigateUp={navigateUp}
              navigateToFolder={navigateToFolder}
              onChooseDirectory={handleChooseDirectory}
              xmlList={xmlList}
              filter={filter}
              setFilter={setFilter}
              selectedIdx={selectedIdx}
              setSelectedIdx={setSelectedIdx}
              selectedPath={selectedPath}
              setSelectedPath={setSelectedPath}
              filteredXml={filteredXml}
              filteredXmlFiles={filteredXmlFiles}
              refreshXml={refreshXml}
              currentSerial={currentSerial}
              onSend={onSend}
              onGetConfigFromTerminal={handleGetConfigFromTerminal}
              onOpenConfigSettings={() => setShowConfigSettings(true)}
            />
          )}
          {active === "logcat" && (
            <Logcat
              currentSerial={currentSerial}
              status={status}
            />
          )}
          {active === "video-generator" && (
            <VideoGenerator
              status={status}
            />
          )}
          {active === "accessibility" && (
            <AccessibilityConverter
              status={status}
            />
          )}
          {active === "apps" && (
            <Apps
              currentSerial={currentSerial}
            />
          )}
        </main>
      </div>

      {showSettings && <SettingsDialog />}
      {showLoggerClientDialog && (
        <LoggerClientParamsDialog
          isOpen={showLoggerClientDialog}
          onClose={() => setShowLoggerClientDialog(false)}
          defaultIp={deviceIpAddress || ""}
          onOpen={handleOpenLoggerClientWithParams}
        />
      )}
      {showConfigSettings && (
        <ConfigurationSettingsDialog
          onClose={() => setShowConfigSettings(false)}
          onSave={handleSaveConfigSettings}
          dir3cxml={dir3cxml}
          onChooseDirectory={handleChooseDirectory}
        />
      )}
      {screenshotData && (
        <ScreenshotDialog
          imageData={screenshotData}
          deviceName={deviceTitle}
          onClose={() => {
            setScreenshotData(null);
            setScreenshotCopied(false);
          }}
          onCopyToClipboard={handleCopyScreenshotToClipboard}
          onSave={handleSaveScreenshot}
          onRecapture={handleRecaptureScreenshot}
          copied={screenshotCopied}
          isCapturing={takingScreenshot}
        />
      )}
      {recordingOptionsOpen && (
        <RecordingOptionsDialog
          isOpen={recordingOptionsOpen}
          onClose={() => setRecordingOptionsOpen(false)}
          onStartRecording={handleStartRecordingWithOptions}
          onConfigure={handleConfigureSavePath}
          maxTimeLimit={deviceAndroidVersion && parseInt(deviceAndroidVersion) >= 9 ? "30 minutes" : "3 minutes"}
          initialOptions={recordingOptions}
        />
      )}
    </div>
  );
}
