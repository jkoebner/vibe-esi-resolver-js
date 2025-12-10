# Changelog

All notable changes to the ESI Resolver browser extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-12-10

### Added
- **Script Execution Support**: ESI fragments now properly execute JavaScript code
  - Extract script tags from ESI content before HTML insertion
  - Execute scripts in proper order after content insertion
  - Support for both inline scripts and external script references
  - Preserve script attributes (async, defer, etc.)
- **Script Execution Toggle**: New "Execute scripts ⚠️" option in popup settings
  - Disabled by default for security
  - Warning icon indicates potential security implications
  - User must explicitly enable script execution

### Changed
- ESI fragments now provide complete functionality including JavaScript execution
- More accurate simulation of real edge-side includes

### Security
- Script execution is opt-in only (disabled by default)
- Scripts execute in current page context (same as real ESI)
- Clear visual warning for security implications

## [1.1.0] - 2024-12-10

### Added
- **Debug Logging Control**: New conditional logging system
  - Debug logging toggle in popup settings
  - Logs only appear when both plugin is enabled AND debug logging is enabled
  - Clean console by default (no logs unless explicitly enabled)
- **Performance Optimization**: Settings caching with storage change listeners

### Changed
- **Console Output**: All console.log statements replaced with conditional debugLog function
- **Settings System**: Extended to include debug logging preference
- **User Experience**: Clean console experience by default

### Fixed
- Console pollution from excessive logging
- Debug information now controllable by user

## [1.0.0] - 2024-12-10

### Added
- **ESI Tag Resolution**: Automatically resolves `<esi:include>` tags and ESI comments
- **Toggle Control**: Easy on/off switch with visual icon indicators
- **Statistics Tracking**: Monitor successful/failed ESI requests with detailed stats
- **Jump Navigation**: Click to jump directly to any ESI fragment on the page
- **Custom Headers**: Add custom HTTP headers to ESI fragment requests
- **URL Resolution**: Smart resolution of relative URLs against page base URL
- **Error Handling**: Clear error messages for failed ESI requests
- **Try/Except Support**: Handles complex ESI try/attempt/except structures
- **Browser Compatibility**: Support for Firefox and Chrome
- **Visual Indicators**: Green/red icons for enabled/disabled states

### Features
- Process ESI tags in various formats (standard tags, comments, try blocks)
- Forward request headers and cookies (optional)
- Real-time statistics display
- Fragment highlighting and navigation
- Persistent settings storage
- Background processing with content script injection

---

## Version History Summary

- **v1.2.0**: Added script execution support for complete ESI simulation
- **v1.1.0**: Added debug logging control and console cleanup
- **v1.0.0**: Initial release with core ESI resolution functionality