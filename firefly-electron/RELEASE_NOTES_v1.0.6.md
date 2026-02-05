# Release Notes - Firefly v1.0.6

## Security Updates

This release addresses critical security vulnerabilities identified by the IT security audit.

### Fixed Vulnerabilities
- **Fixed 14 security vulnerabilities** (2 moderate, 12 high severity)
  - Resolved tar package vulnerabilities (arbitrary file overwrite, symlink poisoning, path traversal)
  - Fixed glob CLI command injection vulnerability
  - Patched js-yaml prototype pollution
  - Resolved lodash prototype pollution in `_.unset` and `_.omit` functions
  - Fixed @isaacs/brace-expansion uncontrolled resource consumption

### Updated Dependencies
- `electron-builder`: 25.1.8 → 26.7.0
- `@electron/rebuild`: 3.7.2 → 4.0.3
- Updated multiple transitive dependencies to secure versions

### Security Audit Status
✅ **All vulnerabilities resolved** - Project is now fully compliant with security standards

---

**Release Date:** February 5, 2026  
**Build Status:** ✅ Verified
