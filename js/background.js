// Firefox compatibility layer
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  browserAPI.storage.local.set({
    esiEnabled: true,
    customHeaders: []
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

// Listen for storage changes to update icon
browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (changes.esiEnabled) {
    console.log('ESI enabled state changed to:', changes.esiEnabled.newValue);
    updateIcon(changes.esiEnabled.newValue);
  }
});

// Handle messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateIcon') {
    console.log('Received icon update request:', request.enabled);
    updateIcon(request.enabled);
    sendResponse({ success: true });
  }
});

// Update icon based on enabled state
function updateIcon(enabled) {
  console.log('Updating icon, enabled:', enabled);
  
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
    
    console.log('Icon updated to:', enabled ? 'ON' : 'OFF');
  }
}

// Update icon for current state
async function updateIconForCurrentState() {
  try {
    const result = await browserAPI.storage.local.get(['esiEnabled']);
    const enabled = result.esiEnabled !== false;
    updateIcon(enabled);
  } catch (error) {
    console.error('Error updating icon:', error);
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