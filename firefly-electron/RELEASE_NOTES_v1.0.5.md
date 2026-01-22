# Release Notes - v1.0.5

**Release Date:** January 22, 2026

## 🐛 Bug Fixes

### Android 12+ Compatibility Fix
- **Fixed:** Send button not working on Android 12+ devices
  - The issue was caused by SELinux security restrictions introduced in Android 12 that prevented `run-as cp` commands from copying files from world-readable locations like `/sdcard`
  - **Solution:** Replaced the `run-as cp` approach with a pipe-based `cat | run-as sh -c 'cat >'` method that bypasses SELinux restrictions
  - This fix is backward compatible and works on all Android versions

### Technical Details
The following functions were updated:
- `firefly:push-replace` - Main configuration file sending functionality
- `firefly:clear-tid-from-datastore` - TID clearing functionality

Both functions now use the following approach instead of direct `cp`:
```bash
cat /sdcard/temp.xml | run-as <package> sh -c 'cat > target.xml'
```

This ensures reliable operation across all Android versions including Android 12, 13, and beyond.

## 🔧 Improvements
- Enhanced error logging for better debugging
- Added compatibility comments in the codebase for future maintenance

## 📋 Testing
Tested and verified on:
- ✅ Android 10
- ✅ Android 12
- ✅ Android 13+

---

For issues or feedback, please contact the Planet Payment Development Team.
