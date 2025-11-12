# Firefly v1.0.1 Release Notes

## 🎉 What's New

### Logcat Feature (Beta)
- **Real-time Android Logcat Viewer** - Monitor your device logs directly in Firefly
- **Smart Filtering** - Automatic PID-based filtering to show only relevant app logs
- **Search & Highlight** - Quickly find specific log entries with real-time highlighting
- **Log Level Filtering** - Filter by Verbose, Debug, Info, Warning, Error, or Fatal
- **Android Studio-like Interface** - Familiar color coding and layout for developers
- **Performance Optimized** - Smooth real-time log streaming with 250ms polling

### UI/UX Improvements
- **Updated Navigation Icons**
  - Configuration: New Blocks icon for better visual recognition
  - Logcat: Terminal icon to represent console/log viewing
- **Beta Badge** - Logcat feature clearly marked as beta in the sidebar

## 🔧 Technical Details
- Logcat polls every 250ms for smooth real-time updates
- Timestamp-based incremental log updates to prevent UI freezing
- Supports up to 2000 log lines with automatic memory management
- PID detection from system process logs for accurate package filtering

## 📦 Downloads

**macOS (Apple Silicon)**
- `firefly-1.0.1.dmg` - Drag-and-drop installer
- `Firefly-1.0.1-arm64-mac.zip` - Portable version

**Windows (ARM64)**
- `firefly-1.0.1-setup.exe` - One-click installer

## 🐛 Bug Fixes
- Fixed TypeScript compilation warnings
- Improved React rendering performance for log display

---

**Full Changelog**: [v1.0.0...v1.0.1](https://github.com/jneto-planet/firefly/compare/v1.0.0...v1.0.1)
