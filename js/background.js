// Firefox compatibility layer
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Debug logging utility
let debugSettings = { esiEnabled: false, debugLogging: false };

function debugLog(...args) {
  if (debugSettings.esiEnabled && debugSettings.debugLogging) {
    console.log(...args);
  }
}

// Load debug settings
async function loadDebugSettings() {
  try {
    const result = await browserAPI.storage.local.get(['esiEnabled', 'debugLogging']);
    debugSettings.esiEnabled = result.esiEnabled !== false;
    debugSettings.debugLogging = result.debugLogging || false;
  } catch (e) {}
}

// Initialize debug settings
loadDebugSettings();

browserAPI.runtime.onInstalled.addListener(() => {
  debugLog('Extension installed');
  browserAPI.storage.local.set({
    esiEnabled: true,
    customHeaders: [],
    debugLogging: false,
    executeScripts: false
  });
  
  // Set initial icon
  updateIcon(true);
});

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    cleanupOldStats();
    updateIconForCurrentState();
  }
});

// Listen for storage changes to update icon and debug settings
browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (changes.esiEnabled) {
    debugSettings.esiEnabled = changes.esiEnabled.newValue;
    debugLog('ESI enabled state changed to:', changes.esiEnabled.newValue);
    updateIcon(changes.esiEnabled.newValue);
  }
  if (changes.debugLogging) {
    debugSettings.debugLogging = changes.debugLogging.newValue;
    debugLog('Debug logging state changed to:', changes.debugLogging.newValue);
  }
});

// Handle messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateIcon') {
    debugLog('Received icon update request:', request.enabled);
    updateIcon(request.enabled);
    sendResponse({ success: true });
  }
});

// Update icon based on enabled state
function updateIcon(enabled) {
  debugLog('Updating icon, enabled:', enabled);
  
  if (browserAPI.browserAction && browserAPI.browserAction.setIcon) {
    const iconPath = enabled ? {
      "16": "icons/icon16-on.png",
      "48": "icons/icon48-on.png", 
      "128": "icons/icon128-on.png"
    } : {
      "16": "icons/icon16-off.png",
      "48": "icons/icon48-off.png",
      "128": "icons/icon128-off.png"
    };
    
    browserAPI.browserAction.setIcon({
      path: iconPath
    });
    
    // Update tooltip
    const title = enabled ? 
      'ESI Resolver - Enabled\nClick to open settings' : 
      'ESI Resolver - Disabled\nClick to open settings';
      
    browserAPI.browserAction.setTitle({
      title: title
    });
    
    debugLog('Icon updated to:', enabled ? 'ON' : 'OFF');
  }
}

// Update icon for current state
async function updateIconForCurrentState() {
  try {
    const result = await browserAPI.storage.local.get(['esiEnabled']);
    const enabled = result.esiEnabled !== false;
    updateIcon(enabled);
  } catch (error) {
    debugLog('Error updating icon:', error);
  }
}

async function cleanupOldStats() {
  const cutoffTime = Date.now() - (60 * 60 * 1000);
  const allData = await browserAPI.storage.local.get();
  
  Object.keys(allData).forEach(key => {
    if (key.startsWith('esiStats_')) {
      const stats = allData[key];
      if (stats.fragments && stats.fragments.length > 0) {
        const latestTimestamp = Math.max(...stats.fragments.map(f => f.timestamp || 0));
        if (latestTimestamp < cutoffTime) {
          browserAPI.storage.local.remove(key);
        }
      }
    }
  });
}

// Initialize icon on startup
updateIconForCurrentState();