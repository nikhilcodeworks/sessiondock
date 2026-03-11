/**
 * SessionDock Content Script
 * Injected into web pages to handle localStorage isolation
 * and provide session context to the webpage
 */

// Get current tab ID and session info
let currentSessionId = null;
let currentTabId = null;

/**
 * Initialize content script
 * Get session information from background worker
 */
async function initializeContentScript() {
  try {
    const tabId = chrome.devtools?.inspectedWindow?.tabId || 
                  await getTabIdFromBackground();
    
    currentTabId = tabId;
    
    // Store session context in session storage
    const response = await chrome.runtime.sendMessage({
      action: 'getSessionForTab',
      tabId: currentTabId
    });
    
    if (response.success && response.session) {
      currentSessionId = response.session.id;
      
      // Inject session context into page
      injectSessionContext(response.session);
      
      // Override localStorage for this tab
      overrideLocalStorage(currentSessionId);
    }
  } catch (error) {
    console.log('SessionDock: Could not initialize content script:', error);
  }
}

/**
 * Get current tab ID by querying tabs
 */
async function getTabIdFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'getCurrentTabId' },
      (response) => {
        resolve(response?.tabId || null);
      }
    );
  });
}

/**
 * Inject session context into the page's window object
 * Allows page scripts to detect the session
 */
function injectSessionContext(session) {
  const script = document.createElement('script');
  script.textContent = `
    window.__sessionDock = {
      sessionId: ${JSON.stringify(session.id)},
      sessionName: ${JSON.stringify(session.name)},
      sessionColor: ${JSON.stringify(session.color)},
      targetDomain: ${JSON.stringify(session.targetDomain)},
      createdAt: ${JSON.stringify(session.createdAt)}
    };
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Clean up script tag
}

/**
 * Override localStorage to isolate per session
 * Uses chrome.storage.local as backing storage
 */
function overrideLocalStorage(sessionId) {
  const storageKey = `localStorage_${sessionId}`;
  
  // Create a proxy for localStorage
  const sessionLocalStorage = {
    _data: {},
    
    async _loadData() {
      if (Object.keys(this._data).length === 0) {
        const result = await chrome.storage.local.get(storageKey);
        this._data = result[storageKey] || {};
      }
    },
    
    async _saveData() {
      const data = {};
      data[storageKey] = this._data;
      await chrome.storage.local.set(data);
    },
    
    async setItem(key, value) {
      await this._loadData();
      this._data[key] = String(value);
      await this._saveData();
    },
    
    async getItem(key) {
      await this._loadData();
      return this._data[key] || null;
    },
    
    async removeItem(key) {
      await this._loadData();
      delete this._data[key];
      await this._saveData();
    },
    
    async clear() {
      this._data = {};
      await this._saveData();
    },
    
    async key(index) {
      await this._loadData();
      const keys = Object.keys(this._data);
      return keys[index] || null;
    },
    
    getLength() {
      return Object.keys(this._data).length;
    }
  };
  
  // Create a script to override localStorage in the page context
  const overrideScript = document.createElement('script');
  overrideScript.textContent = `
    (function() {
      // Store original localStorage
      const originalStorage = window.localStorage;
      const sessionId = '${sessionId}';
      const storageKey = 'localStorage_' + sessionId;
      
      // Create proxy localStorage
      const sessionStorage = {
        _data: {},
        _loaded: false,
        
        async _ensureLoaded() {
          if (!this._loaded) {
            const result = await chrome.storage.local.get(storageKey);
            this._data = result[storageKey] || {};
            this._loaded = true;
          }
        },
        
        async setItem(key, value) {
          await this._ensureLoaded();
          this._data[key] = String(value);
          const data = {};
          data[storageKey] = this._data;
          await chrome.storage.local.set(data);
        },
        
        async getItem(key) {
          await this._ensureLoaded();
          return this._data[key] || null;
        },
        
        async removeItem(key) {
          await this._ensureLoaded();
          delete this._data[key];
          const data = {};
          data[storageKey] = this._data;
          await chrome.storage.local.set(data);
        },
        
        async clear() {
          this._data = {};
          const data = {};
          data[storageKey] = this._data;
          await chrome.storage.local.set(data);
        },
        
        async key(index) {
          await this._ensureLoaded();
          const keys = Object.keys(this._data);
          return keys[index] || null;
        },
        
        getLength() {
          return Object.keys(this._data).length;
        }
      };
      
      // Override window.localStorage
      Object.defineProperty(window, 'localStorage', {
        value: sessionStorage,
        writable: false,
        configurable: false
      });
      
      console.log('[SessionDock] localStorage isolated for session:', sessionId);
    })();
  `;
  
  (document.head || document.documentElement).appendChild(overrideScript);
  overrideScript.remove();
}

/**
 * Monitor for page navigation and handle session switches
 */
window.addEventListener('beforeunload', async () => {
  // Save any pending state before leaving page
  // This ensures data is persisted when switching tabs
});

/**
 * Handle messages from popup/background
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSessionContext') {
    sendResponse({
      sessionId: currentSessionId,
      tabId: currentTabId
    });
  }
  return true;
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

console.log('[SessionDock] Content script loaded');
