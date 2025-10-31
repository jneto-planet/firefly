import React from "react";
import { resolveDeviceIconByModelManu } from "./lib/deviceIcons";
import IntegrateTE from "./components/IntegrateTE";
import Sidebar from "./components/Sidebar";
import SplashScreen from "./components/SplashScreen";
import TitleBar from "./components/TitleBar";

declare global {
  interface Window {
    firefly: {
      getConfig: () => Promise<any>;
      setConfig: (cfg: any) => Promise<any>;
      pickDirectory: (initial?: string) => Promise<string | null>;
      pickFile: (options?: { title?: string; defaultPath?: string; fileType?: 'executable' | 'any' }) => Promise<string | null>;
      listXml: (dir: string) => Promise<{ name: string; path: string; type: 'file' | 'folder' }[]>;
      revealInFileManager: (p: string) => Promise<void>;
      openDefault: (p: string) => Promise<void>;
      openWith: (p: string) => Promise<void>;
      listDevices: () => Promise<Device[]>;
      getDeviceProps: (serial: string) => Promise<{ model?: string; manufacturer?: string }>;
      deleteOldCccFiles: (args: { pkg: string; serial: string }) => Promise<any>;
      pushAndReplace: (args: { localPath: string; pkg: string; relTarget: string; sdcardTemp: string; serial: string }) => Promise<{ how: string }>;
      restartApp: (pkg: string) => Promise<boolean>;
      launchScrcpy: (args: any) => Promise<boolean>;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      checkForUpdates: () => Promise<{ available: boolean; version: string | null; message?: string }>;
      getAppVersion: () => Promise<string>;
      installUpdate: () => Promise<void>;
      testAdb: () => Promise<{ working: boolean; path: string; error?: string }>;
      testScrcpy: (scrcpyPath: string) => Promise<{ working: boolean; path: string; error?: string }>;
      detectScrcpy: () => Promise<{ working: boolean; path: string; error?: string }>;
      setCustomAdbPath: (adbPath: string) => Promise<boolean>;
      setCustomScrcpyPath: (scrcpyPath: string) => Promise<boolean>;
    };
  }
}

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

  const [dir3cxml, setDir3cxml] = React.useState<string>("");
  const [autoOpenScrcpy, setAutoOpenScrcpy] = React.useState<boolean>(false);

  const [xmlList, setXmlList] = React.useState<XmlItem[]>([]);
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState<string>("");
  const [currentDir, setCurrentDir] = React.useState<string>("");

  const [busy, setBusy] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("Loading...");

  // UI shell
  const [deviceMenuOpen, setDeviceMenuOpen] = React.useState(false);
  const [active, setActive] = React.useState<"integrate" | "launcher" | "taxfree">("integrate");

  // Settings dialog
  const [showSettings, setShowSettings] = React.useState(false);

  // ADB and Scrcpy diagnostics state
  const [adbStatus, setAdbStatus] = React.useState<{ working: boolean; path: string; error?: string } | null>(null);
  const [testingAdb, setTestingAdb] = React.useState<boolean>(false);
  const [scrcpyStatus, setScrcpyStatus] = React.useState<{ working: boolean; path: string; error?: string } | null>(null);
  const [testingScrcpy, setTestingScrcpy] = React.useState<boolean>(false);

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
  React.useEffect(() => {
    isMounted.current = true;
    boot();
    return () => { isMounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setAutoOpenScrcpy(!!cfg?.auto_open_scrcpy);
      
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
    } catch (e) {
      console.error("getConfig failed:", e);
    }
    
    await refreshDevices();
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

      // If we had a selectedSerial but it's no longer available, clear it
      if (selectedSerial && !list.some(d => d.serial === selectedSerial)) {
        setSelectedSerial("");
        setDeviceIcon(null);
        setDeviceTitle("No device");
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
          ? `Connected devices: ${list.map(d => d.serial).join(", ")}`
          : "No devices. Connect and enable USB debugging."
      );
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
      setDeviceIcon(iconUrl || null);
    } catch {
      if (!isMounted.current) return;
      setDeviceIcon(null);
    }
  }

  async function refreshXml() {
    if (!currentDir) { setXmlList([]); return; }
    try {
      const list: XmlItem[] = await window.firefly.listXml(currentDir);
      if (!isMounted.current) return;
      setXmlList(list);
      setSelectedIdx(null);
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
      const parentDir = currentDir.split('/').slice(0, -1).join('/');
      if (parentDir && parentDir.length >= dir3cxml.length) {
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

  async function onSelectDeviceSerial(serial: string) {
    setSelectedSerial(serial);
    setDeviceMenuOpen(false);
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

  async function onSend() {
    const serial = currentSerial();
    if (!serial || selectedIdx == null) return;

    const files = filteredXmlFiles();
    const file = files[selectedIdx];
    if (!file) return;

    setBusy(true);
    setStatus("Sending…");

    try {
      // 1. Delete old files
      await window.firefly.deleteOldCccFiles({ 
        pkg: TARGET_PACKAGE,
        serial 
      });

      // 2. Push new config
      const pushResult = await window.firefly.pushAndReplace({
        localPath: file.path,
        pkg: TARGET_PACKAGE,
        relTarget: TARGET_XML_PATH,
        sdcardTemp: TEMP_XML_PATH,
        serial
      });

      // 3. Restart the app
      const restartOk = await window.firefly.restartApp(TARGET_PACKAGE);
      if (!restartOk) {
        throw new Error("Failed to restart terminal app");
      }

      // 4. Auto-launch scrcpy if enabled
      if (autoOpenScrcpy) {
        const scrcpyOk = await window.firefly.launchScrcpy({ serial });
        if (!scrcpyOk) {
          console.warn("Failed to launch scrcpy, but XML was sent successfully");
        }
      }

      setStatus(`Sent "${file.name}" successfully ${pushResult.how}!`);
    } catch (e: any) {
      setStatus(`Send failed: ${e.message || e}`);
      console.error("onSend failed:", e);
    } finally {
      setBusy(false);
    }
  }

  function SettingsDialog() {
    const [tmpDir, setTmpDir] = React.useState(dir3cxml);
    // Remove tmpScrcpy - we now use custom path choosers
    // Remove tmpAuto, scrcpy open-after-send is now only on Integrate page



    // keep fields in sync if settings reopen
    React.useEffect(() => {
      if (!showSettings) return;
      setTmpDir(dir3cxml);
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
        setUpdateAvailable(result.available);
        setUpdateVersion(result.version);
        
        if (!result.available) {
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
        const configUpdates: any = {
          dir_3cxml: tmpDir || dir3cxml
        };
        
        // Only save ADB/Scrcpy paths if they have been tested and are working
        if (adbStatus?.path && adbStatus.working) {
          await window.firefly.setCustomAdbPath(adbStatus.path);
          configUpdates.custom_adb_path = adbStatus.path;
        }
        
        if (scrcpyStatus?.path && scrcpyStatus.working) {
          await window.firefly.setCustomScrcpyPath(scrcpyStatus.path);
          configUpdates.custom_scrcpy_path = scrcpyStatus.path;
        }
        
        await window.firefly.setConfig(configUpdates);
        setDir3cxml(tmpDir || dir3cxml);
        setShowSettings(false);
        await refreshDevices();
        await refreshXml();
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
    async function testLaunchScrcpy() {
      const serial = currentSerial();
      if (!serial) {
        alert("No device selected. Connect a device first.");
        return;
      }

      if (!scrcpyStatus?.working) {
        alert("Scrcpy is not configured or not working. Please test scrcpy first.");
        return;
      }

      try {
        console.log("Testing scrcpy launch for device:", serial);
        const success = await window.firefly.launchScrcpy({ serial });
        if (success) {
          console.log("Scrcpy launched successfully");
          // You could show a temporary success message here if desired
        } else {
          alert("Failed to launch scrcpy. Check console for details.");
        }
      } catch (e) {
        console.error("Test launch failed:", e);
        alert(`Failed to launch scrcpy: ${e}`);
      }
    }

    async function browse3c() {
      try {
        const d = await window.firefly.pickDirectory(tmpDir || dir3cxml);
        if (d) setTmpDir(d);
      } catch (e) { console.error("pickDirectory 3cxml failed:", e); }
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
          setScrcpyStatus({ working: false, path: file, error: 'Ready to test' });
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
          setAdbStatus({ working: false, path: file, error: 'Ready to test' });
        }
      } catch (e) { 
        console.error("pickFile adb failed:", e);
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
          style={{ background: "#1a2730", border: "1px solid rgba(255,255,255,0.1)" }}
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-xl font-semibold text-white">Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">3cxml Folder</label>
              <div className="flex gap-2">
                <input
                  value={tmpDir}
                  onChange={e => setTmpDir(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
                  placeholder="Select folder containing XML templates"
                />
                <button
                  onClick={browse3c}
                  className="px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                >
                  Browse
                </button>
              </div>
            </div>



            <div className="border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-white">ADB Status</div>
                  {adbStatus ? (
                    <>
                      <div className={`text-xs ${adbStatus.working ? 'text-green-400' : 'text-red-400'}`}
                        style={{ fontWeight: 500 }}>
                        {adbStatus.working ? <span>ADB found</span> : <span>ADB not found</span>}
                      </div>
                      <div className="text-xs text-white/40">Path: {adbStatus.path}</div>
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
                    {testingAdb ? "Testing..." : "Test ADB"}
                  </button>
                  <button
                    onClick={browseAdb}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    Choose...
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
                        {scrcpyStatus.working ? <span>Scrcpy found</span> : <span>Scrcpy not found</span>}
                      </div>
                      <div className="text-xs text-white/40">Path: {scrcpyStatus.path}</div>
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
                    {testingScrcpy ? "Testing..." : "Test Scrcpy"}
                  </button>
                  <button
                    onClick={testLaunchScrcpy}
                    disabled={!scrcpyStatus?.working || !currentSerial()}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ 
                      borderColor: "rgba(255,255,255,0.12)", 
                      color: "#fff",
                      opacity: (!scrcpyStatus?.working || !currentSerial()) ? 0.5 : 1
                    }}
                  >
                    Test Launch
                  </button>
                  <button
                    onClick={browseScrcpy}
                    className="px-3 py-1 text-xs rounded border"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
                  >
                    Choose...
                  </button>
                </div>
              </div>

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
              className="flex-1 px-4 py-2 rounded-lg border"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="flex-1 px-4 py-2 rounded-lg"
              style={{ background: ACCENT, color: "#1a1a1a" }}
            >
              Save
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
      <TitleBar />
      <div className="h-full flex" style={{ background: "#08121A", paddingTop: "32px" }}>
        <Sidebar
          devices={devices}
          selectedSerial={selectedSerial}
          deviceTitle={deviceTitle}
          deviceIcon={deviceIcon}
          deviceMenuOpen={deviceMenuOpen}
          setDeviceMenuOpen={setDeviceMenuOpen}
          onSelectDeviceSerial={onSelectDeviceSerial}
          refreshDevices={refreshDevices}
          active={active}
          setActive={setActive}
          setShowSettings={setShowSettings}
          currentSerial={currentSerial}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {active === "integrate" && (
            <IntegrateTE
              status={status}
              busy={busy}
              dir3cxml={dir3cxml}
              currentDir={currentDir}
              setCurrentDir={setCurrentDir}
              navigateUp={navigateUp}
              navigateToFolder={navigateToFolder}
              xmlList={xmlList}
              filter={filter}
              setFilter={setFilter}
              selectedIdx={selectedIdx}
              setSelectedIdx={setSelectedIdx}
              filteredXml={filteredXml}
              filteredXmlFiles={filteredXmlFiles}
              refreshXml={refreshXml}
              currentSerial={currentSerial}
              autoOpenScrcpy={autoOpenScrcpy}
              setAutoOpenScrcpy={setAutoOpenScrcpy}
              onSend={onSend}
            />
          )}
          {active !== "integrate" && (
            <div className="h-full flex items-center justify-center text-white/60">
              <div className="text-center">
                <div className="text-xl font-semibold mb-1">Coming soon</div>
                <div className="text-sm">This section is disabled for now.</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showSettings && <SettingsDialog />}
    </div>
  );
}
