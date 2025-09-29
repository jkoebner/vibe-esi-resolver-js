// Firefox compatibility layer
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded, browserAPI:', typeof browserAPI);
  const popup = new ESIPopup();
});

class ESIPopup {
  constructor() {
    console.log('ESIPopup constructor');
    this.enabled = true;
    this.customHeaders = [];
    this.init();
  }

  async init() {
    console.log('ESIPopup init starting...');
    await this.loadSettings();
    this.setupEventListeners();
    await this.loadStats();
    this.renderHeaders();
    console.log('ESIPopup init complete');
  }

  async loadSettings() {
    try {
      console.log('Loading settings...');
      const result = await browserAPI.storage.local.get(['esiEnabled', 'customHeaders']);
      console.log('Settings result:', result);
      
      this.enabled = result.esiEnabled !== false;
      this.customHeaders = result.customHeaders || [];
      
      console.log('Parsed settings - enabled:', this.enabled, 'headers:', this.customHeaders.length);
      
      const toggleElement = document.getElementById('enableToggle');
      if (toggleElement) {
        toggleElement.checked = this.enabled;
        console.log('Toggle set to:', this.enabled);
      } else {
        console.error('Toggle element not found!');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      console.log('Saving settings:', { esiEnabled: this.enabled, customHeaders: this.customHeaders });
      await browserAPI.storage.local.set({
        esiEnabled: this.enabled,
        customHeaders: this.customHeaders
      });
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Toggle switch
    const toggleElement = document.getElementById('enableToggle');
    if (toggleElement) {
      toggleElement.addEventListener('change', (e) => {
        console.log('Toggle changed to:', e.target.checked);
        this.enabled = e.target.checked;
        this.saveSettings();
        
        // Update icon immediately
        this.updateIcon(this.enabled);
      });
      console.log('Toggle listener added');
    } else {
      console.error('Toggle element not found!');
    }

    // Add header button
    const addHeaderBtn = document.getElementById('addHeader');
    if (addHeaderBtn) {
      addHeaderBtn.addEventListener('click', () => {
        console.log('Add header clicked');
        this.customHeaders.push({ name: '', value: '' });
        this.renderHeaders();
        this.saveSettings();
      });
      console.log('Add header listener added');
    } else {
      console.error('Add header button not found!');
    }

    // Clear stats button
    const clearStatsBtn = document.getElementById('clearStats');
    if (clearStatsBtn) {
      clearStatsBtn.addEventListener('click', () => {
        console.log('Clear stats clicked');
        this.clearStats();
      });
      console.log('Clear stats listener added');
    } else {
      console.error('Clear stats button not found!');
    }
  }

  updateIcon(enabled) {
    // Send message to background script to update icon
    try {
      browserAPI.runtime.sendMessage({
        action: 'updateIcon',
        enabled: enabled
      });
      console.log('Icon update message sent:', enabled);
    } catch (error) {
      console.log('Could not send icon update message:', error);
    }
  }

  renderHeaders() {
    console.log('Rendering headers, count:', this.customHeaders.length);
    const container = document.getElementById('headersContainer');
    
    if (!container) {
      console.error('Headers container not found!');
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
        console.log('Header input changed:', index, field, e.target.value);
        if (this.customHeaders[index]) {
          this.customHeaders[index][field] = e.target.value;
          this.saveSettings();
        }
      }
    });

    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-header')) {
        const index = parseInt(e.target.dataset.index);
        console.log('Remove header:', index);
        this.customHeaders.splice(index, 1);
        this.renderHeaders();
        this.saveSettings();
      }
    });
  }

  async loadStats() {
    try {
      console.log('Loading stats...');
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);
      
      if (!tab) {
        console.error('No active tab found');
        return;
      }

      const statsKey = `esiStats_${tab.url}`;
      console.log('Stats key:', statsKey);
      
      const result = await browserAPI.storage.local.get([statsKey]);
      console.log('Stats result:', result);
      
      const stats = result[statsKey] || {
        total: 0,
        successful: 0,
        failed: 0,
        fragments: []
      };

      console.log('Final stats:', stats);

      document.getElementById('totalTags').textContent = stats.total;
      document.getElementById('successfulTags').textContent = stats.successful;
      document.getElementById('failedTags').textContent = stats.failed;

      this.renderFragmentsList(stats.fragments);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  renderFragmentsList(fragments) {
    console.log('Rendering fragments:', fragments.length);
    const fragmentsList = document.getElementById('fragmentsList');
    
    if (!fragmentsList) {
      console.error('Fragments list not found!');
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
        console.log('Jump to fragment:', fragmentId);
        if (fragmentId) {
          this.jumpToFragment(parseInt(fragmentId));
        }
      }
    });
  }

  async jumpToFragment(fragmentId) {
    try {
      console.log('Jumping to fragment:', fragmentId);
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      await browserAPI.tabs.sendMessage(tab.id, { 
        action: 'jumpToFragment', 
        fragmentId: fragmentId 
      });
      window.close();
    } catch (error) {
      console.error('Could not jump to fragment:', error);
    }
  }

  async clearStats() {
    try {
      console.log('Clearing stats...');
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const statsKey = `esiStats_${tab.url}`;
      await browserAPI.storage.local.remove(statsKey);
      await this.loadStats();

      try {
        await browserAPI.tabs.sendMessage(tab.id, { action: 'clearStats' });
      } catch (e) {
        console.log('Could not send clear message to content script');
      }
    } catch (error) {
      console.error('Error clearing stats:', error);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}