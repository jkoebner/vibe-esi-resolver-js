// Firefox compatibility layer
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

console.log('ESI Content script loading, browserAPI:', typeof browserAPI);

class ESIProcessor {
  constructor() {
    console.log('ESIProcessor constructor');
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
    this.init();
  }

  async init() {
    console.log('ESIProcessor init starting...');
    await this.loadSettings();
    this.loadStats();
    
    console.log('ESI enabled:', this.enabled);
    if (this.enabled) {
      console.log('Processing ESI...');
      setTimeout(() => {
        this.processESI();
      }, 100);
    } else {
      console.log('ESI processing disabled');
    }

    // Listen for messages from popup
    browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request);
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
      console.log('Storage changed:', changes);
      if (changes.esiEnabled) {
        this.enabled = changes.esiEnabled.newValue;
        console.log('ESI enabled changed to:', this.enabled);
        if (this.enabled) {
          setTimeout(() => {
            this.processESI();
          }, 100);
        }
      }
      if (changes.customHeaders) {
        this.customHeaders = changes.customHeaders.newValue || [];
        console.log('Custom headers changed to:', this.customHeaders);
      }
    });
  }

  async loadSettings() {
    console.log('Loading settings...');
    const result = await browserAPI.storage.local.get(['esiEnabled', 'customHeaders']);
    this.enabled = result.esiEnabled !== false;
    this.customHeaders = result.customHeaders || [];
    console.log('Settings loaded - enabled:', this.enabled, 'headers:', this.customHeaders.length);
  }

  loadStats() {
    console.log('Loading stats...');
    const storageKey = `esiStats_${window.location.href}`;
    browserAPI.storage.local.get([storageKey]).then(result => {
      if (result[storageKey]) {
        this.stats = result[storageKey];
        this.fragmentCounter = Math.max(...this.stats.fragments.map(f => f.id || 0), 0);
        console.log('Stats loaded:', this.stats);
      } else {
        console.log('No existing stats found');
      }
    });
  }

  saveStats() {
    const storageKey = `esiStats_${window.location.href}`;
    console.log('Saving stats with key:', storageKey, 'stats:', this.stats);
    browserAPI.storage.local.set({
      [storageKey]: this.stats
    });
  }

  clearStats() {
    console.log('Clearing stats...');
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
    console.log('Jumping to fragment:', fragmentId);
    const element = document.getElementById(`esi-fragment-${fragmentId}`);
    if (element) {
      console.log('Found fragment element, scrolling...');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.outline = '3px solid #ff6600';
      element.style.outlineOffset = '2px';
      setTimeout(() => {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }, 2000);
    } else {
      console.log('Fragment element not found:', `esi-fragment-${fragmentId}`);
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
    console.log('=== STARTING ESI PROCESSING ===');
    if (!this.enabled) {
      console.log('ESI processing disabled, skipping');
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
    
    console.log('ESI processing complete, saving stats...');
    this.saveStats();
    console.log('=== ESI PROCESSING FINISHED ===');
  }

  async processESITryBlocks() {
    console.log('--- Processing ESI Try Blocks ---');
    
    const tryBlocks = document.querySelectorAll('esi\\:try, ESI\\:TRY');
    console.log(`Found ${tryBlocks.length} ESI try blocks`);

    for (const tryBlock of tryBlocks) {
      if (this.processedElements.has(tryBlock)) {
        console.log('Try block already processed, skipping');
        continue;
      }

      console.log('Processing ESI try block:', tryBlock);
      
      // Find the esi:include inside the try block
      const includeTag = tryBlock.querySelector('esi\\:include, ESI\\:INCLUDE, esi-include, ESI-INCLUDE');
      if (includeTag) {
        const src = includeTag.getAttribute('src');
        if (src) {
          console.log('Found include in try block with src:', src);
          this.processedElements.add(tryBlock);
          this.processedElements.add(includeTag); // Mark include as processed too
          await this.fetchAndReplaceESI(tryBlock, src, null, true); // true = is try block
        }
      }
    }
  }

  async processStandaloneESITags() {
    console.log('--- Processing Standalone ESI Tags ---');
    
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
        console.log(`Found ${tags.length} tags with selector: ${selector}`);
        
        // Only process those that aren't inside try blocks and haven't been processed
        Array.from(tags).forEach(tag => {
          if (!this.processedElements.has(tag) && !this.isInsideESITryBlock(tag)) {
            standaloneIncludes.push(tag);
          }
        });
      } catch (e) {
        console.log(`Selector ${selector} failed:`, e);
      }
    });

    console.log(`Found ${standaloneIncludes.length} standalone ESI includes`);

    for (const tag of standaloneIncludes) {
      if (this.processedElements.has(tag)) {
        continue; // Skip if already processed
      }
      
      console.log('Processing standalone ESI tag:', tag);
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
    console.log('--- Processing ESI Comments ---');
    
    if (!document.documentElement) {
      console.log('Document element not available');
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
        console.log('Found ESI comment:', comment.substring(0, 100) + '...');
        esiComments.push(node);
      }
    }

    console.log(`Found ${esiComments.length} unprocessed ESI comments`);

    for (const commentNode of esiComments) {
      if (this.processedElements.has(commentNode)) {
        continue;
      }
      
      console.log('Processing ESI comment...');
      this.processedElements.add(commentNode);
      await this.processESIComment(commentNode);
    }
  }

  async processESIComment(commentNode) {
    const comment = commentNode.nodeValue;
    console.log('Processing ESI comment:', comment.substring(0, 200) + '...');
    
    // Handle ESI try blocks
    if (comment.includes('<esi:try>')) {
      const srcMatch = comment.match(/<esi:include[^>]+src=["']([^"']+)["'][^>]*>/);
      if (srcMatch) {
        const url = srcMatch[1];
        console.log('Found ESI include in try comment with src:', url);
        await this.fetchAndReplaceESI(commentNode, url, comment, true);
      }
      return;
    }
    
    // Handle simple ESI includes
    const srcMatch = comment.match(/src=["']([^"']+)["']/);
    if (srcMatch) {
      const url = srcMatch[1];
      console.log('Found ESI include in comment with src:', url);
      await this.fetchAndReplaceESI(commentNode, url);
    }
  }

  async fetchAndReplaceESI(element, url, originalComment = null, isTryBlock = false) {
    console.log('=== FETCHING AND REPLACING ESI ===');
    console.log('Element:', element.nodeType === Node.COMMENT_NODE ? 'COMMENT' : 'ELEMENT');
    console.log('URL:', url);
    console.log('Is try block:', isTryBlock);
    
    // Check if element still has a parent before proceeding
    if (!element.parentNode) {
      console.log('Element has no parent node, skipping');
      return;
    }
    
    this.stats.total++;
    this.fragmentCounter++;

    const fragmentId = this.fragmentCounter;
    const fragmentMarkerId = `esi-fragment-${fragmentId}`;

    try {
      const resolvedUrl = this.resolveUrl(url);
      console.log(`Fetching ESI fragment ${fragmentId}: ${url} -> ${resolvedUrl}`);

      const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest'
      };

      // Add custom headers
      this.customHeaders.forEach(header => {
        if (header.name && header.value) {
          headers[header.name] = header.value;
          console.log('Added custom header:', header.name, '=', header.value);
        }
      });

      console.log('Making fetch request...');
      const response = await fetch(resolvedUrl, {
        method: 'GET',
        headers: headers,
        credentials: 'same-origin'
      });

      console.log('Fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      console.log(`Successfully fetched content for fragment ${fragmentId}, length:`, content.length);
      
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
      
      // Add the actual content
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'contents';
      contentWrapper.innerHTML = content;
      container.appendChild(contentWrapper);

      console.log('Created replacement container with ID:', fragmentMarkerId);

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

      console.log(`✓ Successfully replaced ESI fragment ${fragmentId}`);

    } catch (error) {
      console.error(`✗ Failed to fetch ESI fragment ${fragmentId}:`, error);
      
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
    console.log('=== REPLACING ESI ELEMENT ===');
    console.log('Element type:', element.nodeType === Node.COMMENT_NODE ? 'COMMENT' : 'ELEMENT');
    console.log('Is try block:', isTryBlock);
    console.log('Has parent:', !!element.parentNode);
    
    if (!element.parentNode) {
      console.error('Element has no parent node, cannot replace!');
      return;
    }

    if (isTryBlock || (originalComment && originalComment.includes('<esi:try>'))) {
      console.log('Handling ESI try block replacement...');
      
      if (element.nodeType === Node.COMMENT_NODE) {
        // For comment-based try blocks, find the closing comment
        this.replaceCommentTryBlock(element, replacement);
      } else {
        // For element-based try blocks, replace the entire try element
        element.parentNode.replaceChild(replacement, element);
        console.log('Replaced entire try block element');
      }
    } else {
      // Simple replacement for regular ESI tags/comments
      console.log('Simple ESI element replacement');
      element.parentNode.replaceChild(replacement, element);
      console.log('Element replaced successfully');
    }
  }

  replaceCommentTryBlock(startComment, replacement) {
    console.log('Replacing comment-based try block...');
    
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
        console.log('Found closing ESI try comment');
        
        try {
          const range = document.createRange();
          range.setStartBefore(startComment);
          range.setEndAfter(walker.currentNode);
          
          range.deleteContents();
          range.insertNode(replacement);
          foundClosing = true;
          console.log('Successfully replaced comment try block');
          break;
        } catch (e) {
          console.error('Error replacing comment try block:', e);
          break;
        }
      }
    }
    
    if (!foundClosing) {
      console.log('No closing try comment found, using simple replacement');
      if (startComment.parentNode) {
        startComment.parentNode.replaceChild(replacement, startComment);
      }
    }
  }
}

// Initialize ESI processor
console.log('Setting up ESI processor initialization...');

function initializeWhenReady() {
  if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOMContentLoaded fired, creating ESIProcessor...');
      new ESIProcessor();
    });
  } else {
    console.log('DOM already loaded, creating ESIProcessor after short delay...');
    setTimeout(() => {
      new ESIProcessor();
    }, 100);
  }
}

initializeWhenReady();

console.log('ESI Content script setup complete');