#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import json
import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog, ttk

PACKAGE = "com.cccintegra.pax"
REL_TARGET = "files/appconfig/cccterminal/3cixml/cccterminal-3cixml-default.xml"
SDCARD_TEMP = "/sdcard/3cxml_temp.xml"

# Display format options
DISPLAY_NAME = "NAME"
DISPLAY_ID = "ID"
DISPLAY_NAME_ID = "NAME + ID"
DEFAULT_DISPLAY_MODE = DISPLAY_NAME_ID  # pick your preferred default

# Defaults (relative to script dir)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_3CXML_DIR = os.path.join(SCRIPT_DIR, "3cxml")
DEFAULT_SCRCPY_DIR = os.path.join(SCRIPT_DIR, "tools", "scrcpy")  # scrcpy.exe expected here

# Terminal Icons
ASSETS_TERMINALS_DIR = os.path.join(SCRIPT_DIR, "assets", "terminals")

# App icon (place the generated files here)
APP_ICONS_DIR = os.path.join(SCRIPT_DIR, "assets", "icons")

# Optional explicit overrides when filename doesn't match simple patterns
MODEL_ICON_MAP = {
    "pax a920pro": "pax_a920pro.png",
    "pax a920 pro": "pax_a920pro.png",
    "pax a920": "pax_a920.png",
    "pax a35": "pax_a35.png",
    "pax a50": "pax_a50.png",
    "pax a77": "pax_a77.png",
    "pax im30": "pax_im30.png",
    "pax im25": "pax_im25.png",
}

LARGE_DEVICE_ICON_PX = 120   # big image below the selector
SMALL_ICON_PX = 16           # small icon button size (already used)

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".3cxml_sender.json")

# ---- Windows taskbar grouping & icon fix ----
if os.name == "nt":
    try:
        import ctypes
        APPID = "com.planet.firefly.v2"  # change string to bust any icon cache
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID.argtypes = [ctypes.c_wchar_p]
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID.restype = ctypes.HRESULT
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APPID)
    except Exception:
        pass
# --------------------------------------------

def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_config(cfg: dict):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        messagebox.showwarning("Config not saved", f"Could not save config:\n{e}")

def run(cmd):
    # Returns (exit_code, stdout, stderr)
    try:
        si = None
        cf = 0
        if os.name == "nt":
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW  # hide window
            cf = subprocess.CREATE_NO_WINDOW               # no console
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,
            startupinfo=si,
            creationflags=cf,
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except FileNotFoundError:
        return 127, "", "Command not found: " + " ".join(cmd)

def adb(*args):
    return run(["adb", *args])

def check_adb():
    code, out, err = adb("version")
    if code != 0:
        raise RuntimeError("ADB not found. Install Android Platform Tools and ensure 'adb' is in PATH.\n" + err)

def get_devices():
    code, out, err = adb("devices")
    if code != 0:
        raise RuntimeError("adb devices failed:\n" + err)
    lines = [l for l in out.splitlines() if "\tdevice" in l]
    return [l.split("\t")[0] for l in lines]

def get_device_name(serial: str) -> str:
    """Return a human-friendly 'manufacturer model' name; fall back to serial if unavailable."""
    code, out, _ = adb("-s", serial, "shell", "getprop", "ro.product.model")
    model = out.strip() if code == 0 and out.strip() else ""
    code, out, _ = adb("-s", serial, "shell", "getprop", "ro.product.manufacturer")
    manu = out.strip() if code == 0 and out.strip() else ""
    name = (f"{manu} {model}").strip()
    return name or serial

def device_display(serial: str, mode: str) -> str:
    """Build the display string for a device based on the selected mode."""
    if mode == DISPLAY_ID:
        return serial
    name = get_device_name(serial)
    if mode == DISPLAY_NAME:
        return name
    # DISPLAY_NAME_ID
    return f"{name} ({serial})"

def _adb_getprop(serial: str, prop: str) -> str:
    code, out, _ = adb("-s", serial, "shell", "getprop", prop)
    return out.strip() if code == 0 else ""

def get_device_model_and_manufacturer(serial: str) -> tuple[str, str]:
    """Return (model, manufacturer). Empty strings if not available."""
    model = _adb_getprop(serial, "ro.product.model")
    manu  = _adb_getprop(serial, "ro.product.manufacturer")
    return model, manu

def _normalize_for_key(s: str) -> str:
    # Lowercase, collapse spaces/dashes to single space, strip, then normalize
    s = s.lower().strip().replace("-", " ")
    # Keep alnum and spaces only
    s = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in s)
    # Collapse multiple spaces
    s = " ".join(s.split())
    return s

def _filename_candidate_keys(model: str, manu: str) -> list[str]:
    """Return normalized keys to try against MODEL_ICON_MAP or slugified filenames."""
    m = _normalize_for_key(model)
    mn = _normalize_for_key(manu)
    keys = []
    if mn and m:
        keys.append(f"{mn} {m}")  # "pax a920 pro"
    if m:
        keys.append(m)            # "a920 pro"
        keys.append(f"pax {m}")   # helpful if manu missing but we assume brand
    return keys

def _to_slug(s: str) -> str:
    # turn "PAX A920 Pro" -> "pax_a920_pro"
    s = _normalize_for_key(s).replace(" ", "_")
    return s

def find_terminal_icon_path(serial: str) -> str | None:
    """
    Try to resolve a PNG icon for the device by:
    1) Checking MODEL_ICON_MAP overrides with normalized keys
    2) Trying common filename patterns under ./assets/terminals
    Returns absolute path or None if not found.
    """
    model, manu = get_device_model_and_manufacturer(serial)
    keys = _filename_candidate_keys(model, manu)

    # 1) Explicit overrides
    for k in keys:
        fname = MODEL_ICON_MAP.get(k)
        if fname:
            p = os.path.join(ASSETS_TERMINALS_DIR, fname)
            if os.path.exists(p):
                return p

    # 2) Heuristics: try "<slug>.png", "pax_<slug>.png", "<manu>_<slug>.png"
    candidates = []
    if model:
        slug = _to_slug(model)
        candidates.extend([f"{slug}.png", f"pax_{slug}.png"])
        if manu:
            candidates.append(f"{_to_slug(manu)}_{slug}.png")

    # Finally: attempt "<manu>_<model>.png" directly
    if model and manu:
        candidates.append(f"{_to_slug(manu)}_{_to_slug(model)}.png")

    for fname in candidates:
        p = os.path.join(ASSETS_TERMINALS_DIR, fname)
        if os.path.exists(p):
            return p

    return None

def load_icon_image(path: str, target_px: int = 16):
    """Load an image and resize to ~target_px square for use on a ttk.Button."""
    try:
        from PIL import Image, ImageTk
        img = Image.open(path).convert("RGBA")
        img = img.resize((target_px, target_px), Image.LANCZOS)
        return ImageTk.PhotoImage(img)
    except Exception:
        pass
    try:
        img = tk.PhotoImage(file=path)
        w, h = img.width(), img.height()
        factor = max(1, int(max(w, h) / max(1, target_px)))
        return img.subsample(factor, factor)
    except Exception:
        return None

def check_run_as(pkg):
    code, out, err = adb("shell", "run-as", pkg, "pwd")
    return code == 0, out if code == 0 else None, err

def delete_old_ccc_files(pkg=PACKAGE):
    """Delete the .obj.gz and .md5 inside the app sandbox using run-as."""
    files = [
        "files/appconfig/cccterminal/3cixml/cccterminal-3cixml-default.obj.gz",
        "files/appconfig/cccterminal/3cixml/cccterminal-3cixml-default.md5",
    ]
    ok, _, err = check_run_as(pkg)
    if not ok:
        raise RuntimeError(f"'run-as {pkg}' is unavailable (app likely not debuggable).\n{err}")
    for target in files:
        code, out, err = adb("shell", "run-as", pkg, "rm", "-f", target)
        if code != 0:
            raise RuntimeError(f"Failed to delete {target}:\n{out}\n{err}")

def push_and_replace(local_path, pkg=PACKAGE):
    # 1) push to sdcard temp
    code, out, err = adb("push", local_path, SDCARD_TEMP)
    if code != 0:
        raise RuntimeError(f"adb push failed:\n{out}\n{err}")

    # 2) try run-as (debuggable builds)
    ok, app_dir, _ = check_run_as(pkg)
    if ok:
        target_dir = os.path.dirname(REL_TARGET)
        code, out, err = adb("shell", "run-as", pkg, "mkdir", "-p", target_dir)
        if code != 0:
            raise RuntimeError(f"mkdir failed:\n{out}\n{err}")
        code, out, err = adb("shell", "run-as", pkg, "cp", SDCARD_TEMP, REL_TARGET)
        if code != 0:
            raise RuntimeError(f"cp failed:\n{out}\n{err}")
        adb("shell", "run-as", pkg, "chmod", "600", REL_TARGET)
        adb("shell", "rm", "-f", SDCARD_TEMP)
        return True, "Copied via run-as"
    else:
        # If not debuggable, try root (requires rooted device)
        code, out, err = adb("root")
        if code != 0:
            adb("shell", "rm", "-f", SDCARD_TEMP)
            raise RuntimeError(
                "run-as unavailable (likely not a debug build) and 'adb root' failed.\n"
                "Device must be rooted or the target app must be debuggable for direct file replacement."
            )
        abs_target = f"/data/user/0/{pkg}/{REL_TARGET}"
        adb("shell", "mkdir", "-p", os.path.dirname(abs_target))
        code, out, err = adb("shell", "cp", SDCARD_TEMP, abs_target)
        if code != 0:
            adb("shell", "rm", "-f", SDCARD_TEMP)
            raise RuntimeError(f"cp (root) failed:\n{out}\n{err}")
        adb("shell", "chmod", "600", abs_target)
        adb("shell", "chown", f"{pkg}:{pkg}", abs_target)  # best-effort
        adb("shell", "rm", "-f", SDCARD_TEMP)
        return True, "Copied with adb root"

def restart_app(pkg=PACKAGE):
    adb("shell", "am", "force-stop", pkg)
    adb("shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1")

def scrcpy_exe_from_dir(scrcpy_dir: str) -> str:
    # Windows exe expected
    return os.path.join(scrcpy_dir, "scrcpy.exe")

def launch_scrcpy(serial, scrcpy_dir):
    exe = scrcpy_exe_from_dir(scrcpy_dir)
    if not os.path.exists(exe):
        messagebox.showerror("scrcpy not found", f"Could not find scrcpy at:\n{exe}")
        return
    try:
        # Do NOT pass STARTUPINFO or CREATE_NO_WINDOW here — scrcpy is a GUI.
        subprocess.Popen([exe, "-s", serial, "--window-title", f"Firefly {serial}"])
    except Exception as e:
        messagebox.showerror("Failed to launch scrcpy", str(e))

# --- Small tooltip helper ---
class Tooltip:
    def __init__(self, widget, text: str):
        self.widget = widget
        self.text = text
        self.tip = None
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)

    def _show(self, _event=None):
        if self.tip:
            return
        x = self.widget.winfo_rootx() + self.widget.winfo_width() + 8
        y = self.widget.winfo_rooty() + int(self.widget.winfo_height() * 0.5)
        self.tip = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = ttk.Label(tw, text=self.text, padding=(6, 3), relief="solid", borderwidth=1)
        label.pack()

    def _hide(self, _event=None):
        if self.tip:
            self.tip.destroy()
            self.tip = None

class App(tk.Tk):

    def _on_list_select(self, event=None):
        self._update_send_button()

    def _update_send_button(self):
        has_selection = bool(self.listbox.curselection())
        self.send_btn.state(["!disabled"] if has_selection else ["disabled"])
    
    def _selected_serial(self) -> str:
        """Return the ADB serial for the current combobox selection."""
        # If you've implemented display mapping, keep using that:
        try:
            return self.display_to_serial.get(self.device_var.get(), self.device_var.get())
        except AttributeError:
            # Fallback if mapping not set (shouldn't happen with your current code)
            return self.device_var.get()

    def _update_scrcpy_icon(self):
        """Enable or disable the 'Open Scrcpy' button depending on device availability."""
        serial = self._selected_serial()
        if serial:
            self.scrcpy_icon_btn.state(["!disabled"])
        else:
            self.scrcpy_icon_btn.state(["disabled"])

    def _update_device_info(self):
        serial = self._selected_serial()
        if not serial:
            self.device_info_frame.forget()
            return
        else:
            # Ensure it's visible and above the list section (same parent: self)
            if not self.device_info_frame.winfo_ismapped():
                self.device_info_frame.pack(fill=tk.X, before=self.list_section)

        name = get_device_name(serial)
        self.device_title_var.set(name)
        self.device_id_var.set(serial)

        icon_path = find_terminal_icon_path(serial)
        if icon_path:
            photo = load_icon_image(icon_path, target_px=LARGE_DEVICE_ICON_PX)
            if photo:
                self.device_large_photo = photo
                self.device_img_label.config(image=self.device_large_photo, text="")
                return

        self.device_img_label.config(image="", text="📱")
        self.device_large_photo = None


    def _on_device_changed(self, _evt=None):
        # Existing small icon update (if you added it earlier)
        try:
            self._update_scrcpy_icon()
        except AttributeError:
            pass
        # New: update the device info block, too
        self._update_device_info()

    def __init__(self):
        super().__init__()

        self.title("Firefly")

        self.minsize(700, 540)
        self.resizable(True, True)

        ICON_DIR = os.path.join(SCRIPT_DIR, "assets", "icons")
        ICO = os.path.join(ICON_DIR, "firefly.ico")
        PNG = os.path.join(ICON_DIR, "firefly.png")

        try:
            # Title bar (Windows)
            if os.path.exists(ICO):
                self.iconbitmap(ICO)

            # Taskbar: Tk needs a PhotoImage *with a live reference*
            if os.path.exists(PNG):
                self._icon_img = tk.PhotoImage(file=PNG)  # keep a reference!
                self.iconphoto(True, self._icon_img)
        except Exception as e:
            print("Icon set error:", e)

        # Load config (with defaults if missing)
        self.config_data = load_config()
        self.dir_var = tk.StringVar(value=self.config_data.get("dir_3cxml", DEFAULT_3CXML_DIR))
        self.scrcpy_dir_var = tk.StringVar(value=self.config_data.get("scrcpy_dir", DEFAULT_SCRCPY_DIR))
        self.open_scrcpy_var = tk.BooleanVar(value=bool(self.config_data.get("auto_open_scrcpy", False)))
        self.display_mode_var = tk.StringVar(value=self.config_data.get("device_display_mode", DEFAULT_DISPLAY_MODE))

        # --- Device row + Settings (same row) ---
        devrow = ttk.Frame(self, padding=(10,0,10,10))
        devrow.pack(fill=tk.X)

        ttk.Label(devrow, text="Device:").grid(row=0, column=0, padx=(0,6), sticky="w")

        self.device_var = tk.StringVar(value="")
        self.device_combo = ttk.Combobox(devrow, textvariable=self.device_var, width=40, state="readonly")
        self.device_combo.grid(row=0, column=1, sticky="we")

        # Icon buttons next to device combo
        self.refresh_btn = ttk.Button(devrow, text="⟳", width=3, command=self.refresh_devices)
        self.refresh_btn.grid(row=0, column=2, padx=(6, 0))
        Tooltip(self.refresh_btn, "Refresh")

        # When user picks a different device, update icon accordingly
        self.device_combo.bind("<<ComboboxSelected>>", self._on_device_changed)

        # Spacer to push settings to the far right
        ttk.Label(devrow, text="").grid(row=0, column=4, sticky="we")

        # Settings icon on the same row (far right)
        self.settings_btn = ttk.Button(devrow, text="⚙", width=3, command=self.open_settings)
        self.settings_btn.grid(row=0, column=5, padx=(6, 10), sticky="e")

        # Make the combo expand and the spacer take the extra space
        devrow.columnconfigure(1, weight=1)   # device combobox grows
        devrow.columnconfigure(4, weight=1)   # spacer pushes settings to right

        # --- Device info section (image + name + id) ---
        self.device_info_frame = ttk.Frame(self, padding=(10, 0, 10, 10))
        self.device_info_frame.pack(fill=tk.X)

        # Left: large image
        self.device_large_photo = None
        self.device_img_label = ttk.Label(self.device_info_frame)
        self.device_img_label.pack(side=tk.LEFT)

        # Right: name (title) and adb id + Open Scrcpy button
        right = ttk.Frame(self.device_info_frame)
        right.pack(side=tk.LEFT, padx=12, fill=tk.BOTH, expand=True)

        self.device_title_var = tk.StringVar(value="No device")
        self.device_id_var = tk.StringVar(value="")

        ttk.Label(right, textvariable=self.device_title_var, font=("TkDefaultFont", 11, "bold")).pack(anchor="w")
        ttk.Label(right, textvariable=self.device_id_var, foreground="#555").pack(anchor="w")

        self.scrcpy_icon_btn = ttk.Button(right, text="Open Scrcpy", command=self.open_scrcpy_manual)
        self.scrcpy_icon_btn.pack(anchor="w", pady=(6, 0))

        # --- Config list section ---
        self.list_section = ttk.Frame(self, padding=(10,0,10,0))
        self.list_section.pack(fill=tk.BOTH, expand=True)

        # Header: title on left, refresh icon right next to it, spacer fills the rest
        list_header = ttk.Frame(self.list_section)
        list_header.pack(fill=tk.X, pady=(0,0))

        ttk.Label(list_header, text="Config List").grid(row=0, column=0, sticky="w")
        self.list_refresh_btn = ttk.Button(list_header, text="⟳", width=3, command=self.populate_files)
        self.list_refresh_btn.grid(row=0, column=1, padx=(6, 0), sticky="w")
        Tooltip(self.list_refresh_btn, "Refresh list")

        # Spacer to take remaining space (keeps header compact on the left)
        ttk.Label(list_header, text="").grid(row=0, column=2, sticky="we")
        list_header.columnconfigure(2, weight=1)

        # The actual list + scrollbar
        mid = ttk.Frame(self.list_section)
        mid.pack(fill=tk.BOTH, expand=True)
        self.listbox = tk.Listbox(mid, height=14, exportselection=False)
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb = ttk.Scrollbar(mid, orient=tk.VERTICAL, command=self.listbox.yview)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.listbox.config(yscrollcommand=sb.set)
        self.listbox.bind("<<ListboxSelect>>", self._on_list_select)

        # bottom buttons
        bottom = ttk.Frame(self, padding=10)
        bottom.pack(side=tk.BOTTOM, fill=tk.X)

        self.send_btn = ttk.Button(bottom, text="Send to terminal", command=self.send_selected, state="disabled")
        self.send_btn.pack(side=tk.LEFT)

        # status
        self.status = tk.StringVar(value="Ready")
        ttk.Label(self, textvariable=self.status, padding=(10,0,10,10)).pack(fill=tk.X)

        # init
        try:
            check_adb()
            self.refresh_devices()
            self._update_scrcpy_icon()
            self._update_device_info()
        except Exception as e:
            messagebox.showerror("ADB error", str(e))
        self.populate_files()
        self._update_send_button()

    def open_settings(self):
        """Settings dialog for 3cxml dir, scrcpy dir, and auto-open option."""
        win = tk.Toplevel(self)
        win.title("Settings")
        win.resizable(False, False)
        win.transient(self)
        win.grab_set()

        frm = ttk.Frame(win, padding=12)
        frm.pack(fill=tk.BOTH, expand=True)

        # 3cxml directory
        ttk.Label(frm, text="3cxml directory:").grid(row=0, column=0, sticky="w")
        dir_entry = ttk.Entry(frm, textvariable=self.dir_var, width=52)
        dir_entry.grid(row=1, column=0, sticky="we", pady=(4, 8))
        def browse_3cxml():
            d = filedialog.askdirectory(parent=win, title="Select 3cxml directory", initialdir=self.dir_var.get() or DEFAULT_3CXML_DIR)
            if d:
                self.dir_var.set(d)
        ttk.Button(frm, text="Browse…", command=browse_3cxml).grid(row=1, column=1, padx=(6,0), sticky="e")

        # scrcpy directory
        ttk.Label(frm, text="scrcpy directory:").grid(row=2, column=0, sticky="w", pady=(8,0))
        scrcpy_entry = ttk.Entry(frm, textvariable=self.scrcpy_dir_var, width=52)
        scrcpy_entry.grid(row=3, column=0, sticky="we", pady=(4, 8))
        def browse_scrcpy_dir():
            d = filedialog.askdirectory(parent=win, title="Select scrcpy directory", initialdir=self.scrcpy_dir_var.get() or DEFAULT_SCRCPY_DIR)
            if d:
                self.scrcpy_dir_var.set(d)
        ttk.Button(frm, text="Browse…", command=browse_scrcpy_dir).grid(row=3, column=1, padx=(6,0), sticky="e")

        # auto-open scrcpy checkbox
        auto_chk = ttk.Checkbutton(frm, text="Open scrcpy automatically after send", variable=self.open_scrcpy_var)
        auto_chk.grid(row=4, column=0, columnspan=2, sticky="w", pady=(8, 0))

        # Device display format
        ttk.Label(frm, text="Device display format:").grid(row=5, column=0, sticky="w", pady=(8,0))
        fmt_combo = ttk.Combobox(
            frm,
            textvariable=self.display_mode_var,
            values=[DISPLAY_NAME, DISPLAY_ID, DISPLAY_NAME_ID],
            state="readonly",
            width=30
        )
        fmt_combo.grid(row=6, column=0, sticky="w", pady=(4, 8))

        # Save / Cancel
        btns = ttk.Frame(frm)
        btns.grid(row=7, column=0, columnspan=2, sticky="e", pady=(12, 0))

        def save_and_close():
            # Persist config
            self.config_data["dir_3cxml"] = self.dir_var.get().strip() or DEFAULT_3CXML_DIR
            self.config_data["scrcpy_dir"] = self.scrcpy_dir_var.get().strip() or DEFAULT_SCRCPY_DIR
            self.config_data["auto_open_scrcpy"] = bool(self.open_scrcpy_var.get())
            self.config_data["device_display_mode"] = self.display_mode_var.get()

            save_config(self.config_data)
            # Refresh file list in case directory changed
            self.populate_files()
            self.refresh_devices()
            win.destroy()

        ttk.Button(btns, text="Save", command=save_and_close).pack(side=tk.RIGHT, padx=(6, 0))
        ttk.Button(btns, text="Cancel", command=win.destroy).pack(side=tk.RIGHT)

        frm.columnconfigure(0, weight=1)
        dir_entry.focus_set()

    def refresh_devices(self):
        try:
            devs = get_devices()
        except Exception as e:
            messagebox.showerror("ADB error", str(e))
            return

        if not devs:
            self.device_combo["values"] = []
            self.device_var.set("")
            self.status.set("No devices. Connect a device and enable USB debugging.")
            self.display_to_serial = {}
            return

        # Build display strings according to current mode
        mode = self.display_mode_var.get()
        displays = []
        display_to_serial = {}
        for s in devs:
            disp = device_display(s, mode)
            displays.append(disp)
            display_to_serial[disp] = s  # NOTE: if two devices resolve to same disp, last wins

        self.display_to_serial = display_to_serial
        self.device_combo["values"] = displays

        # Preserve selection if possible; else select first
        current = self.device_var.get()
        if current in display_to_serial:
            pass  # keep current
        elif displays:
            self.device_var.set(displays[0])

        # Update UI based on current selection
        try:
            self._update_scrcpy_icon()
            self._update_device_info()
        except AttributeError:
            pass

        self.status.set(f"Connected devices: {', '.join(displays)}")

    def populate_files(self):
        d = self.dir_var.get()
        self.listbox.delete(0, tk.END)
        if not d or not os.path.isdir(d):
            self._update_send_button()
            return
        for name in sorted(os.listdir(d)):
            if name.lower().endswith(".xml"):
                self.listbox.insert(tk.END, name)
        self.listbox.selection_clear(0, tk.END)
        self._update_send_button()

    def open_scrcpy_manual(self):
        """Open scrcpy for the selected device using the icon button."""
        if not self.device_var.get():
            messagebox.showwarning("No device", "Select a device (or click ⟳).")
            return
        serial = self._selected_serial()
        self.status.set("Starting Scrcpy…")
        self.update_idletasks()
        launch_scrcpy(serial, self.scrcpy_dir_var.get())

    def send_selected(self):
        if not self.device_var.get():
            messagebox.showwarning("No device", "Select a device (or click ⟳).")
            return
        d = self.dir_var.get()
        if not d or not os.path.isdir(d):
            messagebox.showwarning("Folder not found", f"Directory does not exist:\n{d}")
            return
        sel = self.listbox.curselection()
        if not sel:
            messagebox.showwarning("No file", "Pick a 3CXML file from the list.")
            return
        local = os.path.join(d, self.listbox.get(sel[0]))
        self.status.set("Sending… please wait")
        self.update_idletasks()
        try:
            serial = self._selected_serial()
            os.environ["ANDROID_SERIAL"] = serial

            delete_old_ccc_files(pkg=PACKAGE)
            ok, how = push_and_replace(local, pkg=PACKAGE)
            restart_app(pkg=PACKAGE)
            self.status.set(f"Done: {how}. App restarted.")

            # Auto-open scrcpy if enabled in Settings
            if self.open_scrcpy_var.get():
                self.status.set("Starting Scrcpy…")
                self.update_idletasks()
                launch_scrcpy(serial, self.scrcpy_dir_var.get())

        except Exception as e:
            self.status.set("Error")
            messagebox.showerror("Failed", str(e))

if __name__ == "__main__":
    App().mainloop()
