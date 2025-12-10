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

// Initialize debug settings
loadDebugSettings().then(() => {
  debugLog('ESI Content script loading, browserAPI:', typeof browserAPI);
});

class ESIProcessor {
  constructor() {
    debugLog('ESIProcessor constructor');
    this.enabled = true;
    this.customHeaders = [];
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      fragments: []
    };
    this.fragmentCounter = 0;
    this.processedElements = new Set(); // Track processed elements
    this.executeScripts = false;
    this.init();
  }

  async init() {
    debugLog('ESIProcessor init starting...');
    await this.loadSettings();
    this.loadStats();
    
    debugLog('ESI enabled:', this.enabled);
    if (this.enabled) {
      debugLog('Processing ESI...');
      setTimeout(() => {
        this.processESI();
      }, 100);
    } else {
      debugLog('ESI processing disabled');
    }

    // Listen for messages from popup
    browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
      debugLog('Content script received message:', request);
      if (request.action === 'clearStats') {
        this.clearStats();
        sendResponse({ success: true });
      } else if (request.action === 'jumpToFragment') {
        this.jumpToFragment(request.fragmentId);
        sendResponse({ success: true });
      }
      return true;
    });

    // Listen for storage changes
    browserAPI.storage.onChanged.addListener((changes, namespace) => {
      debugLog('Storage changed:', changes);
      if (changes.esiEnabled) {
        this.enabled = changes.esiEnabled.newValue;
        debugLog('ESI enabled changed to:', this.enabled);
        if (this.enabled) {
          setTimeout(() => {
            this.processESI();
          }, 100);
        }
      }
      if (changes.customHeaders) {
        this.customHeaders = changes.customHeaders.newValue || [];
        debugLog('Custom headers changed to:', this.customHeaders);
      }
      if (changes.executeScripts) {
        this.executeScripts = changes.executeScripts.newValue || false;
        debugLog('Execute scripts changed to:', this.executeScripts);
      }
    });
  }

  async loadSettings() {
    debugLog('Loading settings...');
    const result = await browserAPI.storage.local.get([
      'esiEnabled', 
      'customHeaders', 
      'forwardHeaders', 
      'forwardCookies',
      'executeScripts'
    ]);
    this.enabled = result.esiEnabled !== false;
    this.customHeaders = result.customHeaders || [];
    this.forwardHeaders = result.forwardHeaders || false;
    this.forwardCookies = result.forwardCookies || false;
    this.executeScripts = result.executeScripts || false;
    debugLog('Settings loaded - enabled:', this.enabled, 'headers:', this.customHeaders.length, 'forward headers:', this.forwardHeaders, 'forward cookies:', this.forwardCookies, 'execute scripts:', this.executeScripts);
  }

  loadStats() {
    debugLog('Loading stats...');
    const storageKey = `esiStats_${window.location.href}`;
    browserAPI.storage.local.get([storageKey]).then(result => {
      if (result[storageKey]) {
        this.stats = result[storageKey];
        this.fragmentCounter = Math.max(...this.stats.fragments.map(f => f.id || 0), 0);
        debugLog('Stats loaded:', this.stats);
      } else {
        debugLog('No existing stats found');
      }
    });
  }

  saveStats() {
    const storageKey = `esiStats_${window.location.href}`;
    debugLog('Saving stats with key:', storageKey, 'stats:', this.stats);
    browserAPI.storage.local.set({
      [storageKey]: this.stats
    });
  }

  clearStats() {
    debugLog('Clearing stats...');
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      fragments: []
    };
    this.fragmentCounter = 0;
    this.processedElements.clear();
    this.saveStats();
  }

  jumpToFragment(fragmentId) {
    debugLog('Jumping to fragment:', fragmentId);
    const element = document.getElementById(`esi-fragment-${fragmentId}`);
    if (element) {
      debugLog('Found fragment element, scrolling...');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.outline = '3px solid #ff6600';
      element.style.outlineOffset = '2px';
      setTimeout(() => {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }, 2000);
    } else {
      debugLog('Fragment element not found:', `esi-fragment-${fragmentId}`);
    }
  }

  resolveUrl(url) {
    if (url.match(/^https?:\/\//)) {
      return url;
    }
    
    if (url.startsWith('//')) {
      return window.location.protocol + url;
    }
    
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      if (url.startsWith('/')) {
        return window.location.origin + url;
      }
      const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
      return basePath + url;
    }
  }

  async processESI() {
    debugLog('=== STARTING ESI PROCESSING ===');
    if (!this.enabled) {
      debugLog('ESI processing disabled, skipping');
      return;
    }

    // Reset processed elements for this run
    this.processedElements.clear();

    // First process try blocks (they contain includes)
    await this.processESITryBlocks();
    
    // Then process standalone includes that aren't in try blocks
    await this.processStandaloneESITags();
    
    // Finally process comments
    await this.processESIComments();
    
    debugLog('ESI processing complete, saving stats...');
    this.saveStats();
    debugLog('=== ESI PROCESSING FINISHED ===');
  }

  async processESITryBlocks() {
    debugLog('--- Processing ESI Try Blocks ---');
    
    const tryBlocks = document.querySelectorAll('esi\\:try, ESI\\:TRY');
    debugLog(`Found ${tryBlocks.length} ESI try blocks`);

    for (const tryBlock of tryBlocks) {
      if (this.processedElements.has(tryBlock)) {
        debugLog('Try block already processed, skipping');
        continue;
      }

      debugLog('Processing ESI try block:', tryBlock);
      
      // Find the esi:include inside the try block
      const includeTag = tryBlock.querySelector('esi\\:include, ESI\\:INCLUDE, esi-include, ESI-INCLUDE');
      if (includeTag) {
        const src = includeTag.getAttribute('src');
        if (src) {
          debugLog('Found include in try block with src:', src);
          this.processedElements.add(tryBlock);
          this.processedElements.add(includeTag); // Mark include as processed too
          await this.fetchAndReplaceESI(tryBlock, src, null, true); // true = is try block
        }
      }
    }
  }

  async processStandaloneESITags() {
    debugLog('--- Processing Standalone ESI Tags ---');
    
    const selectors = [
      'esi\\:include',
      'esi-include',
      'ESI\\:INCLUDE',
      'ESI-INCLUDE'
    ];
    
    let standaloneIncludes = [];
    selectors.forEach(selector => {
      try {
        const tags = document.querySelectorAll(selector);
        debugLog(`Found ${tags.length} tags with selector: ${selector}`);
        
        // Only process those that aren't inside try blocks and haven't been processed
        Array.from(tags).forEach(tag => {
          if (!this.processedElements.has(tag) && !this.isInsideESITryBlock(tag)) {
            standaloneIncludes.push(tag);
          }
        });
      } catch (e) {
        debugLog(`Selector ${selector} failed:`, e);
      }
    });

    debugLog(`Found ${standaloneIncludes.length} standalone ESI includes`);

    for (const tag of standaloneIncludes) {
      if (this.processedElements.has(tag)) {
        continue; // Skip if already processed
      }
      
      debugLog('Processing standalone ESI tag:', tag);
      const src = tag.getAttribute('src');
      if (src) {
        this.processedElements.add(tag);
        await this.fetchAndReplaceESI(tag, src);
      }
    }
  }

  isInsideESITryBlock(element) {
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName && (
        parent.tagName.toLowerCase() === 'esi:try' || 
        parent.tagName === 'ESI:TRY'
      )) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  async processESIComments() {
    debugLog('--- Processing ESI Comments ---');
    
    if (!document.documentElement) {
      debugLog('Document element not available');
      return;
    }
    
    const walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );

    const esiComments = [];
    let node;

    while (node = walker.nextNode()) {
      if (this.processedElements.has(node)) {
        continue;
      }
      
      const comment = node.nodeValue;
      if (comment && (comment.includes('<esi:include') || comment.includes('<esi:try>'))) {
        debugLog('Found ESI comment:', comment.substring(0, 100) + '...');
        esiComments.push(node);
      }
    }

    debugLog(`Found ${esiComments.length} unprocessed ESI comments`);

    for (const commentNode of esiComments) {
      if (this.processedElements.has(commentNode)) {
        continue;
      }
      
      debugLog('Processing ESI comment...');
      this.processedElements.add(commentNode);
      await this.processESIComment(commentNode);
    }
  }

  async processESIComment(commentNode) {
    const comment = commentNode.nodeValue;
    debugLog('Processing ESI comment:', comment.substring(0, 200) + '...');
    
    // Handle ESI try blocks
    if (comment.includes('<esi:try>')) {
      const srcMatch = comment.match(/<esi:include[^>]+src=["']([^"']+)["'][^>]*>/);
      if (srcMatch) {
        const url = srcMatch[1];
        debugLog('Found ESI include in try comment with src:', url);
        await this.fetchAndReplaceESI(commentNode, url, comment, true);
      }
      return;
    }
    
    // Handle simple ESI includes
    const srcMatch = comment.match(/src=["']([^"']+)["']/);
    if (srcMatch) {
      const url = srcMatch[1];
      debugLog('Found ESI include in comment with src:', url);
      await this.fetchAndReplaceESI(commentNode, url);
    }
  }

  async fetchAndReplaceESI(element, url, originalComment = null, isTryBlock = false) {
    debugLog('=== FETCHING AND REPLACING ESI ===');
    debugLog('Element:', element.nodeType === Node.COMMENT_NODE ? 'COMMENT' : 'ELEMENT');
    debugLog('URL:', url);
    debugLog('Is try block:', isTryBlock);
    
    // Check if element still has a parent before proceeding
    if (!element.parentNode) {
      debugLog('Element has no parent node, skipping');
      return;
    }
    
    this.stats.total++;
    this.fragmentCounter++;

    const fragmentId = this.fragmentCounter;
    const fragmentMarkerId = `esi-fragment-${fragmentId}`;

    try {
      const resolvedUrl = this.resolveUrl(url);
      debugLog(`Fetching ESI fragment ${fragmentId}: ${url} -> ${resolvedUrl}`);

      const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest'
      };

      // Forward original request headers if enabled
      if (this.forwardHeaders) {
        // Get common headers that should be forwarded
        const headersToForward = [
          'User-Agent', 'Accept-Language', 'Accept-Encoding',
          'Cache-Control', 'Pragma', 'DNT'
        ];
        
        headersToForward.forEach(headerName => {
          // Note: We can't access all original headers due to browser security,
          // but we can forward the most common ones
          if (navigator.userAgent && headerName === 'User-Agent') {
            headers['User-Agent'] = navigator.userAgent;
          }
          if (navigator.language && headerName === 'Accept-Language') {
            headers['Accept-Language'] = navigator.language;
          }
        });
        
        debugLog('Forwarding request headers enabled');
      }

      // Add custom headers
      this.customHeaders.forEach(header => {
        if (header.name && header.value) {
          headers[header.name] = header.value;
          debugLog('Added custom header:', header.name, '=', header.value);
        }
      });

      debugLog('Making fetch request...');
      const fetchOptions = {
        method: 'GET',
        headers: headers,
        credentials: this.forwardCookies ? 'include' : 'same-origin'
      };

      const response = await fetch(resolvedUrl, fetchOptions);

      debugLog('Fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      debugLog(`Successfully fetched content for fragment ${fragmentId}, length:`, content.length);
      
      // Create replacement element
      const container = document.createElement('div');
      container.id = fragmentMarkerId;
      container.style.display = 'contents';
      container.setAttribute('data-esi-fragment', 'true');
      container.setAttribute('data-esi-url', url);
      container.setAttribute('data-esi-resolved-url', resolvedUrl);
      
      // Add debug comment
      const markerComment = document.createComment(`ESI Fragment ${fragmentId}: ${url}`);
      container.appendChild(markerComment);
      
      // Add the actual content with script extraction
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'contents';
      
      // Extract and execute scripts if enabled
      const processedContent = await this.extractAndExecuteScripts(content, contentWrapper);
      contentWrapper.innerHTML = processedContent;
      
      container.appendChild(contentWrapper);

      debugLog('Created replacement container with ID:', fragmentMarkerId);

      // Replace the ESI element
      this.replaceESIElement(element, container, originalComment, isTryBlock);

      this.stats.successful++;
      this.stats.fragments.push({
        id: fragmentId,
        url: url,
        resolvedUrl: resolvedUrl,
        success: true,
        timestamp: Date.now()
      });

      debugLog(`✓ Successfully replaced ESI fragment ${fragmentId}`);

    } catch (error) {
      debugLog(`✗ Failed to fetch ESI fragment ${fragmentId}:`, error);
      
      // Create error element
      const errorDiv = document.createElement('div');
      errorDiv.id = fragmentMarkerId;
      errorDiv.className = 'esi-error';
      errorDiv.setAttribute('data-esi-fragment', 'true');
      errorDiv.setAttribute('data-esi-url', url);
      errorDiv.setAttribute('data-esi-resolved-url', this.resolveUrl(url));
      errorDiv.style.cssText = 'color: red; border: 1px solid red; padding: 10px; margin: 5px; background: #ffe6e6;';
      errorDiv.innerHTML = `
        <!-- ESI Fragment ${fragmentId}: ${url} (FAILED) -->
        <strong>ESI Error:</strong> Failed to load ${url}<br>
        <small>${error.message}</small>
      `;
      
      // Replace with error (check parent still exists)
      if (element.parentNode) {
        this.replaceESIElement(element, errorDiv, originalComment, isTryBlock);
      }

      this.stats.failed++;
      this.stats.fragments.push({
        id: fragmentId,
        url: url,
        resolvedUrl: this.resolveUrl(url),
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    }

    this.saveStats();
  }

  replaceESIElement(element, replacement, originalComment, isTryBlock = false) {
    debugLog('=== REPLACING ESI ELEMENT ===');
    debugLog('Element type:', element.nodeType === Node.COMMENT_NODE ? 'COMMENT' : 'ELEMENT');
    debugLog('Is try block:', isTryBlock);
    debugLog('Has parent:', !!element.parentNode);
    
    if (!element.parentNode) {
      debugLog('Element has no parent node, cannot replace!');
      return;
    }

    if (isTryBlock || (originalComment && originalComment.includes('<esi:try>'))) {
      debugLog('Handling ESI try block replacement...');
      
      if (element.nodeType === Node.COMMENT_NODE) {
        // For comment-based try blocks, find the closing comment
        this.replaceCommentTryBlock(element, replacement);
      } else {
        // For element-based try blocks, replace the entire try element
        element.parentNode.replaceChild(replacement, element);
        debugLog('Replaced entire try block element');
      }
    } else {
      // Simple replacement for regular ESI tags/comments
      debugLog('Simple ESI element replacement');
      element.parentNode.replaceChild(replacement, element);
      debugLog('Element replaced successfully');
    }
  }

  async extractAndExecuteScripts(content, container) {
    if (!this.executeScripts) {
      return content;
    }

    debugLog('Extracting and executing scripts from ESI content');
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const scripts = Array.from(doc.querySelectorAll('script'));
      
      debugLog(`Found ${scripts.length} script tags in ESI content`);
      
      // Remove scripts from content
      scripts.forEach(script => script.remove());
      
      // Get content without scripts
      const contentWithoutScripts = doc.body ? doc.body.innerHTML : content;
      
      // Execute scripts after content is inserted
      setTimeout(async () => {
        for (const script of scripts) {
          await this.executeScript(script, container);
        }
      }, 10);
      
      return contentWithoutScripts;
    } catch (e) {
      debugLog('Error processing scripts:', e);
      return content;
    }
  }

  async executeScript(scriptElement, container) {
    debugLog('Executing script:', scriptElement.src || 'inline');
    
    try {
      const newScript = document.createElement('script');
      
      // Copy attributes
      Array.from(scriptElement.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      if (scriptElement.src) {
        // External script
        return new Promise((resolve, reject) => {
          newScript.onload = () => {
            debugLog('External script loaded:', scriptElement.src);
            resolve();
          };
          newScript.onerror = () => {
            debugLog('External script failed:', scriptElement.src);
            reject();
          };
          container.appendChild(newScript);
        });
      } else {
        // Inline script
        newScript.textContent = scriptElement.textContent;
        container.appendChild(newScript);
        debugLog('Inline script executed');
      }
    } catch (e) {
      debugLog('Script execution error:', e);
    }
  }

  replaceCommentTryBlock(startComment, replacement) {
    debugLog('Replacing comment-based try block...');
    
    let walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_COMMENT,
      null,
      false
    );
    
    walker.currentNode = startComment;
    let foundClosing = false;
    
    // Look for the closing </esi:try> comment
    while (walker.nextNode()) {
      const comment = walker.currentNode.nodeValue;
      if (comment && comment.includes('</esi:try>')) {
        debugLog('Found closing ESI try comment');
        
        try {
          const range = document.createRange();
          range.setStartBefore(startComment);
          range.setEndAfter(walker.currentNode);
          
          range.deleteContents();
          range.insertNode(replacement);
          foundClosing = true;
          debugLog('Successfully replaced comment try block');
          break;
        } catch (e) {
          debugLog('Error replacing comment try block:', e);
          break;
        }
      }
    }
    
    if (!foundClosing) {
      debugLog('No closing try comment found, using simple replacement');
      if (startComment.parentNode) {
        startComment.parentNode.replaceChild(replacement, startComment);
      }
    }
  }
}

// Initialize ESI processor
debugLog('Setting up ESI processor initialization...');

function initializeWhenReady() {
  if (document.readyState === 'loading') {
    debugLog('DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      debugLog('DOMContentLoaded fired, creating ESIProcessor...');
      new ESIProcessor();
    });
  } else {
    debugLog('DOM already loaded, creating ESIProcessor after short delay...');
    setTimeout(() => {
      new ESIProcessor();
    }, 100);
  }
}

initializeWhenReady();

debugLog('ESI Content script setup complete');