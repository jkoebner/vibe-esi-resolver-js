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

// Listen for storage changes to update debug settings
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.esiEnabled) debugSettings.esiEnabled = changes.esiEnabled.newValue;
  if (changes.debugLogging) debugSettings.debugLogging = changes.debugLogging.newValue;
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadDebugSettings();
  debugLog('Popup DOM loaded, browserAPI:', typeof browserAPI);
  const popup = new ESIPopup();
});

class ESIPopup {
  constructor() {
    debugLog('ESIPopup constructor');
    this.enabled = true;
    this.customHeaders = [];
    this.forwardHeaders = false;
    this.forwardCookies = false;
    this.debugLogging = false;
    this.executeScripts = false;
    this.init();
  }

  async init() {
    debugLog('ESIPopup init starting...');
    await this.loadSettings();
    this.setupEventListeners();
    await this.loadStats();
    this.renderHeaders();
    debugLog('ESIPopup init complete');
  }

  async loadSettings() {
    try {
      debugLog('Loading settings...');
      const result = await browserAPI.storage.local.get([
        'esiEnabled', 
        'customHeaders', 
        'forwardHeaders', 
        'forwardCookies',
        'debugLogging',
        'executeScripts'
      ]);
      debugLog('Settings result:', result);
      
      this.enabled = result.esiEnabled !== false;
      this.customHeaders = result.customHeaders || [];
      this.forwardHeaders = result.forwardHeaders || false;
      this.forwardCookies = result.forwardCookies || false;
      this.debugLogging = result.debugLogging || false;
      this.executeScripts = result.executeScripts || false;
      
      debugLog('Parsed settings - enabled:', this.enabled, 'headers:', this.customHeaders.length, 'debug:', this.debugLogging, 'scripts:', this.executeScripts);
      
      // Set toggle states
      const toggleElement = document.getElementById('enableToggle');
      const forwardHeadersElement = document.getElementById('forwardHeaders');
      const forwardCookiesElement = document.getElementById('forwardCookies');
      const debugLoggingElement = document.getElementById('debugLogging');
      const executeScriptsElement = document.getElementById('executeScripts');
      
      if (toggleElement) {
        toggleElement.checked = this.enabled;
        debugLog('Toggle set to:', this.enabled);
      }
      
      if (forwardHeadersElement) {
        forwardHeadersElement.checked = this.forwardHeaders;
        debugLog('Forward headers set to:', this.forwardHeaders);
      }
      
      if (forwardCookiesElement) {
        forwardCookiesElement.checked = this.forwardCookies;
        debugLog('Forward cookies set to:', this.forwardCookies);
      }
      
      if (debugLoggingElement) {
        debugLoggingElement.checked = this.debugLogging;
        debugLog('Debug logging set to:', this.debugLogging);
      }
      
      if (executeScriptsElement) {
        executeScriptsElement.checked = this.executeScripts;
        debugLog('Execute scripts set to:', this.executeScripts);
      }
      
    } catch (error) {
      debugLog('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      debugLog('Saving settings:', { 
        esiEnabled: this.enabled, 
        customHeaders: this.customHeaders,
        forwardHeaders: this.forwardHeaders,
        forwardCookies: this.forwardCookies,
        debugLogging: this.debugLogging,
        executeScripts: this.executeScripts
      });
      await browserAPI.storage.local.set({
        esiEnabled: this.enabled,
        customHeaders: this.customHeaders,
        forwardHeaders: this.forwardHeaders,
        forwardCookies: this.forwardCookies,
        debugLogging: this.debugLogging,
        executeScripts: this.executeScripts
      });
      debugLog('Settings saved successfully');
    } catch (error) {
      debugLog('Error saving settings:', error);
    }
  }

  setupEventListeners() {
    debugLog('Setting up event listeners...');
    
    // Main toggle switch
    const toggleElement = document.getElementById('enableToggle');
    if (toggleElement) {
      toggleElement.addEventListener('change', (e) => {
        debugLog('Toggle changed to:', e.target.checked);
        this.enabled = e.target.checked;
        this.saveSettings();
        this.updateIcon(this.enabled);
      });
    }

    // Forward headers toggle
    const forwardHeadersElement = document.getElementById('forwardHeaders');
    if (forwardHeadersElement) {
      forwardHeadersElement.addEventListener('change', (e) => {
        debugLog('Forward headers changed to:', e.target.checked);
        this.forwardHeaders = e.target.checked;
        this.saveSettings();
      });
    }

    // Forward cookies toggle
    const forwardCookiesElement = document.getElementById('forwardCookies');
    if (forwardCookiesElement) {
      forwardCookiesElement.addEventListener('change', (e) => {
        debugLog('Forward cookies changed to:', e.target.checked);
        this.forwardCookies = e.target.checked;
        this.saveSettings();
      });
    }

    // Debug logging toggle
    const debugLoggingElement = document.getElementById('debugLogging');
    if (debugLoggingElement) {
      debugLoggingElement.addEventListener('change', (e) => {
        debugLog('Debug logging changed to:', e.target.checked);
        this.debugLogging = e.target.checked;
        this.saveSettings();
      });
    }

    // Execute scripts toggle
    const executeScriptsElement = document.getElementById('executeScripts');
    if (executeScriptsElement) {
      executeScriptsElement.addEventListener('change', (e) => {
        debugLog('Execute scripts changed to:', e.target.checked);
        this.executeScripts = e.target.checked;
        this.saveSettings();
      });
    }

    // Add header button
    const addHeaderBtn = document.getElementById('addHeader');
    if (addHeaderBtn) {
      addHeaderBtn.addEventListener('click', () => {
        debugLog('Add header clicked');
        this.customHeaders.push({ name: '', value: '' });
        this.renderHeaders();
        this.saveSettings();
      });
    }

    // Clear stats button
    const clearStatsBtn = document.getElementById('clearStats');
    if (clearStatsBtn) {
      clearStatsBtn.addEventListener('click', () => {
        debugLog('Clear stats clicked');
        this.clearStats();
      });
    }
  }

  updateIcon(enabled) {
    try {
      browserAPI.runtime.sendMessage({
        action: 'updateIcon',
        enabled: enabled
      });
      debugLog('Icon update message sent:', enabled);
    } catch (error) {
      debugLog('Could not send icon update message:', error);
    }
  }

  renderHeaders() {
    debugLog('Rendering headers, count:', this.customHeaders.length);
    const container = document.getElementById('headersContainer');
    
    if (!container) {
      debugLog('Headers container not found!');
      return;
    }

    container.innerHTML = '';

    if (this.customHeaders.length === 0) {
      container.innerHTML = '<div class="empty-headers">No custom headers</div>';
      return;
    }

    this.customHeaders.forEach((header, index) => {
      const headerRow = document.createElement('div');
      headerRow.className = 'header-row';
      headerRow.innerHTML = `
        <input type="text" class="header-input" placeholder="Header Name" 
               value="${this.escapeHtml(header.name)}" data-index="${index}" data-field="name">
        <input type="text" class="header-input" placeholder="Header Value" 
               value="${this.escapeHtml(header.value)}" data-index="${index}" data-field="value">
        <button class="remove-header" data-index="${index}">×</button>
      `;
      container.appendChild(headerRow);
    });

    // Event delegation for header inputs and remove buttons
    container.addEventListener('input', (e) => {
      if (e.target.classList.contains('header-input')) {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        debugLog('Header input changed:', index, field, e.target.value);
        if (this.customHeaders[index]) {
          this.customHeaders[index][field] = e.target.value;
          this.saveSettings();
        }
      }
    });

    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-header')) {
        const index = parseInt(e.target.dataset.index);
        debugLog('Remove header:', index);
        this.customHeaders.splice(index, 1);
        this.renderHeaders();
        this.saveSettings();
      }
    });
  }

  async loadStats() {
    try {
      debugLog('Loading stats...');
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      debugLog('Current tab:', tab);
      
      if (!tab) {
        debugLog('No active tab found');
        return;
      }

      const statsKey = `esiStats_${tab.url}`;
      debugLog('Stats key:', statsKey);
      
      const result = await browserAPI.storage.local.get([statsKey]);
      debugLog('Stats result:', result);
      
      const stats = result[statsKey] || {
        total: 0,
        successful: 0,
        failed: 0,
        fragments: []
      };

      debugLog('Final stats:', stats);

      document.getElementById('totalTags').textContent = stats.total;
      document.getElementById('successfulTags').textContent = stats.successful;
      document.getElementById('failedTags').textContent = stats.failed;

      this.renderFragmentsList(stats.fragments);
    } catch (error) {
      debugLog('Error loading stats:', error);
    }
  }

  renderFragmentsList(fragments) {
    debugLog('Rendering fragments:', fragments.length);
    const fragmentsList = document.getElementById('fragmentsList');
    
    if (!fragmentsList) {
      debugLog('Fragments list not found!');
      return;
    }
    
    fragmentsList.innerHTML = '';

    if (fragments.length === 0) {
      fragmentsList.innerHTML = '<div class="no-fragments">No ESI fragments processed yet</div>';
      return;
    }

    fragments.forEach(fragment => {
      const fragmentDiv = document.createElement('div');
      fragmentDiv.className = `fragment-item ${fragment.success ? 'fragment-success' : 'fragment-error'}`;
      
      const displayUrl = fragment.resolvedUrl || fragment.url;
      const tooltip = fragment.resolvedUrl !== fragment.url ? 
        `Original: ${fragment.url}\nResolved: ${fragment.resolvedUrl}` : 
        fragment.url;

      fragmentDiv.innerHTML = `
        <span title="${this.escapeHtml(tooltip)}" class="fragment-url" data-fragment-id="${fragment.id || 0}">
          ${this.escapeHtml(displayUrl.length > 30 ? displayUrl.substring(0, 30) + '...' : displayUrl)}
        </span>
        <div class="fragment-actions">
          <button class="jump-to-fragment" data-fragment-id="${fragment.id || 0}" title="Jump to fragment">🔍</button>
          <span class="fragment-status">${fragment.success ? '✓' : '✗'}</span>
        </div>
      `;
      fragmentsList.appendChild(fragmentDiv);
    });

    // Event delegation for jump functionality
    fragmentsList.addEventListener('click', (e) => {
      if (e.target.classList.contains('jump-to-fragment') || e.target.classList.contains('fragment-url')) {
        const fragmentId = e.target.dataset.fragmentId;
        debugLog('Jump to fragment:', fragmentId);
        if (fragmentId) {
          this.jumpToFragment(parseInt(fragmentId));
        }
      }
    });
  }

  async jumpToFragment(fragmentId) {
    try {
      debugLog('Jumping to fragment:', fragmentId);
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      await browserAPI.tabs.sendMessage(tab.id, { 
        action: 'jumpToFragment', 
        fragmentId: fragmentId 
      });
      window.close();
    } catch (error) {
      debugLog('Could not jump to fragment:', error);
    }
  }

  async clearStats() {
    try {
      debugLog('Clearing stats...');
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const statsKey = `esiStats_${tab.url}`;
      await browserAPI.storage.local.remove(statsKey);
      await this.loadStats();

      try {
        await browserAPI.tabs.sendMessage(tab.id, { action: 'clearStats' });
      } catch (e) {
        debugLog('Could not send clear message to content script');
      }
    } catch (error) {
      debugLog('Error clearing stats:', error);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}