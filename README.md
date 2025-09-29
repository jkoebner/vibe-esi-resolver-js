# ESI Resolver Browser Extension

A browser extension that resolves Edge Side Include (ESI) tags locally for development and testing purposes. Built with AI assistance.

## Features

- 🔄 **ESI Tag Resolution**: Automatically resolves `<esi:include>` tags and ESI comments
- 🎛️ **Toggle Control**: Easy on/off switch with visual icon indicators
- 📊 **Statistics Tracking**: Monitor successful/failed ESI requests with detailed stats
- 🔗 **Jump Navigation**: Click to jump directly to any ESI fragment on the page
- 🛠️ **Custom Headers**: Add custom HTTP headers to ESI fragment requests
- 🌐 **URL Resolution**: Smart resolution of relative URLs against page base URL
- ⚠️ **Error Handling**: Clear error messages for failed ESI requests
- 🎯 **Try/Except Support**: Handles complex ESI try/attempt/except structures

## Installation

### From Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jkoebner/vibe-esi-resolver-jsesi-resolver.git
   cd esi-resolver
   ```

2. **Load in Firefox:**
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `manifest.json`

3. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder

### From Packaged Extension

1. Download the latest release from the [Releases page](https://github.com/jkoebner/vibe-esi-resolver-js/releases)
2. For Firefox: Drag the `.xpi` file into Firefox or install via `about:addons`
3. For Chrome: Install the `.crx` file via `chrome://extensions/`

## Usage

1. **Enable/Disable**: Click the extension icon and toggle the ON/OFF switch
2. **View Statistics**: See real-time stats of processed ESI fragments
3. **Add Custom Headers**: Add any custom HTTP headers needed for your ESI requests
4. **Jump to Fragments**: Click on fragment URLs in the popup to scroll to them on the page
5. **Clear Statistics**: Reset all statistics for the current page

### Visual Indicators

- 🟢 **Green Icon**: ESI processing is enabled
- 🔴 **Red Icon**: ESI processing is disabled

## Supported ESI Formats

The extension handles various ESI tag formats:

```html
<!-- Standard ESI include -->
<esi:include src="/path/to/fragment.html" />

<!-- ESI try/attempt/except blocks -->
<esi:try>
    <esi:attempt>
        <esi:include src="/path/to/fragment.html" />  
    </esi:attempt>
    <esi:except>
        Fallback content
    </esi:except>
</esi:try>

<!-- ESI in comments (common in some implementations) -->
<!-- <esi:include src="/path/to/fragment.html" /> -->
```

## Development

### File Structure

```
esi-resolver/
├── manifest.json          # Extension manifest
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic and UI handling
├── content.js             # Main ESI processing logic
├── background.js          # Background script and icon management
├── icon*-on.png          # Enabled state icons
├── icon*-off.png         # Disabled state icons
├── README.md             # This file
├── LICENSE               # GPL-3.0 license
└── .gitignore            # Git ignore rules
```

### Building

To package the extension:

```bash
# For Firefox
zip -r esi-resolver.zip manifest.json popup.html popup.js content.js background.js *.png
mv esi-resolver.zip esi-resolver.xpi

# For Chrome  
# Use Chrome's "Pack extension" feature in chrome://extensions/
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly on both Firefox and Chrome
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Technical Details

### Browser Compatibility

- **Firefox**: Tested on Firefox 90+
- **Chrome**: Tested on Chrome 90+
- **Edge**: Should work (Chromium-based)

### Permissions Required

- `activeTab`: Access current tab for ESI processing
- `storage`: Store extension settings and statistics  
- `<all_urls>`: Make HTTP requests to fetch ESI fragments

### Architecture

The extension consists of three main components:

1. **Content Script** (`content.js`): Scans pages for ESI tags, fetches fragments, and replaces content
2. **Popup Interface** (`popup.js`): Provides user controls and displays statistics
3. **Background Script** (`background.js`): Manages extension state and icon updates

## Troubleshooting

### Common Issues

**ESI tags not being replaced:**
- Check that the extension is enabled (green icon)
- Verify ESI URLs are accessible from your browser
- Check the browser console for error messages

**Custom headers not working:**  
- Ensure header names and values are correctly formatted
- Some headers may be restricted by browsers for security

**Statistics not showing:**
- Refresh the page after enabling the extension
- Check that ESI tags exist on the current page

### Debug Mode

Open browser developer tools to see detailed logging:
- Content script logs appear in the page console (F12)
- Popup logs appear when inspecting the popup (right-click extension icon → Inspect)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with assistance from AI
- Inspired by the need for local ESI testing in development environments
- Thanks to the open source community for browser extension development resources

## Changelog

### v1.0.0
- Initial release
- Basic ESI tag resolution
- Statistics tracking
- Custom headers support
- Jump navigation
- Visual icon indicators

## Support

If you encounter issues or have questions:

1. Check the [Issues page](https://github.com/jkoebner/vibe-esi-resolver-js/issues)
2. Create a new issue with detailed information about your problem
3. Include browser version, extension version, and steps to reproduce

---

**Disclaimer**: This extension is for development and testing purposes. Do not use in production environments where security is critical.

This text has been AI-Generated.