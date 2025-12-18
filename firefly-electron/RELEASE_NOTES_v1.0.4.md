# Firefly v1.0.4 Release Notes

## 🎨 UI/UX Improvements

### Configuration Page Redesign
- **Search Bar**: Moved to top bar next to Settings icon with smaller, cleaner design
- **Breadcrumbs & Navigation**: Reorganized layout with improved spacing
  - Back button now always visible (icon-only, disabled at root)
  - Refresh icon repositioned to right side of window
  - Breadcrumbs moved below search bar for better hierarchy
- **Get Config from Terminal**: 
  - Changed to icon-only button with Upload icon
  - Relocated to bottom panel next to Send button
  - Added smooth bounce animation on hover
  - Proper sizing to match Send button style

### Icon Animations
- Added rotation animations to all refresh icons (Configuration, TitleBar, Logcat)
- Added rotation animations to all settings icons (Sidebar, Configuration)
- Consistent animation timing (0.3s duration) across the app
- Smooth hover interactions for better user feedback

### Tooltips Enhancement
- Added tooltips to refresh and eye icons
- Fixed tooltip functionality for quick action buttons (Scrcpy, Screenshot)
- Consistent tooltip styling and timing throughout the app

## ⚙️ New Features

### Butterfly Integration
- **New Quick Action**: Added Butterfly launcher in Quick Actions section
- **Cross-Platform Support**: Automatically detects and runs correct script (.sh for macOS/Linux, .bat for Windows)
- **Beautiful Icon**: Using PiButterflyLight icon with wiggle animation on hover
- **Bundled Resources**: Butterfly app included in installer for seamless deployment

### Clear TID Functionality
- **Device File Management**: Automatically removes `INSTANCE_TERMINAL_IDENTIFICATION` from device configuration files
- **Dual File Processing**: Handles both DataStoreIntegrator.properties and firmware.config.properties
- **Error Handling**: Individual error handling for each file with detailed logging

### Configuration Management
- **Pull Config from Terminal**: Download XML configuration directly from connected device
- **Save Dialog**: Choose custom location to save downloaded configuration
- **Auto Refresh**: Automatically refreshes XML list after successful download
- **Default Path**: Smart default save location based on current directory

## 🛠️ Technical Improvements

### Architecture
- Enhanced IPC handlers for better main-renderer communication
- Improved error handling and user feedback with dialog boxes
- Better process management for external applications (detached mode)
- Optimized resource bundling for production builds

### Dependencies
- Added `react-icons` package for expanded icon library
- Updated framer-motion integration for smoother animations

## 📦 Build & Distribution
- Version bumped to 1.0.4
- Updated electron-builder configuration for Butterfly resources
- Improved resource path handling for development and production

## 🐛 Bug Fixes
- Fixed tooltip rendering issues on quick action buttons
- Resolved JSX structure issues in Configuration breadcrumbs
- Fixed animation targeting for icon-only buttons
- Corrected import paths and missing dependencies

---

**Full Changelog**: v1.0.3...v1.0.4
