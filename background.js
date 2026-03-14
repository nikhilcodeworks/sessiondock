/**
 * SessionDock Background Service Worker (V3 - Gated Swapping)
 * 
 * Logic:
 * 1. The browser's global cookie store belongs to the ACTIVE session.
 * 2. Background session tabs are BLOCKED via declarativeNetRequest to prevent cookie bleed.
 * 3. Switching tabs triggers a 'Global Swap': Save current -> Clear -> Restore new.
 */

const STORAGE_KEYS = {
  SESSIONS: 'sessions',
  TAB_MAPPING: 'tabMapping',
  ACTIVE_SESSION: 'activeSessionId',
  SESSION_COLORS: 'sessionColors'
};

const DEFAULT_SESSION_ID = '__default__';

// In-memory state
let currentActiveSessionId = DEFAULT_SESSION_ID;
let isSwapping = false;

/**
 * Initialize extension
 */
async function initialize() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SESSIONS, STORAGE_KEYS.ACTIVE_SESSION]);
  
  if (!data[STORAGE_KEYS.SESSIONS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SESSIONS]: {
        [DEFAULT_SESSION_ID]: { id: DEFAULT_SESSION_ID, name: 'Default', cookies: [] }
      },
      [STORAGE_KEYS.TAB_MAPPING]: {},
      [STORAGE_KEYS.ACTIVE_SESSION]: DEFAULT_SESSION_ID
    });
  } else {
    currentActiveSessionId = data[STORAGE_KEYS.ACTIVE_SESSION] || DEFAULT_SESSION_ID;
  }
  
  // Clean up any stale DNR rules on startup
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id)
  });
}

/**
 * Save all global cookies to a session's storage
 */
async function saveSessionToStorage(sessionId) {
  const allCookies = await chrome.cookies.getAll({});
  const sessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || {};
  
  if (sessions[sessionId]) {
    sessions[sessionId].cookies = allCookies.map(c => ({
      domain: c.domain,
      expirationDate: c.expirationDate,
      httpOnly: c.httpOnly,
      name: c.name,
      path: c.path,
      sameSite: c.sameSite,
      secure: c.secure,
      storeId: c.storeId,
      value: c.value,
      url: `http${c.secure ? 's' : ''}://${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}${c.path}`
    }));
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
    console.log(`[SessionDock] Saved ${allCookies.length} cookies to session: ${sessionId}`);
  }
}

/**
 * Restore a session's cookies to the global store
 */
async function restoreSessionFromStorage(sessionId) {
  const sessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || {};
  const session = sessions[sessionId];
  if (!session) return;

  // Clear current global jar
  const currentCookies = await chrome.cookies.getAll({});
  for (const c of currentCookies) {
    const url = `http${c.secure ? 's' : ''}://${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}${c.path}`;
    try {
      await chrome.cookies.remove({ url, name: c.name });
    } catch (e) {
      console.warn('Failed to remove cookie', c.name, e);
    }
  }

  // Restore session cookies
  const cookiesToSet = session.cookies || [];
  for (const c of cookiesToSet) {
    const details = {
      url: c.url,
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expirationDate: c.expirationDate,
      storeId: c.storeId
    };
    
    // Clean up incompatible properties for chrome.cookies.set
    if (details.sameSite === 'no_restriction') details.secure = true;
    if (details.hostOnly) delete details.domain;

    try {
      await chrome.cookies.set(details);
    } catch (e) {
      console.warn('Failed to set cookie', c.name, e);
    }
  }
  
  console.log(`[SessionDock] Restored ${cookiesToSet.length} cookies for session: ${sessionId}`);
}

/**
 * Update DNR rules to block non-active session tabs
 */
async function updateGatingRules(activeTabId, sessionId) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING);
  const tabMapping = data[STORAGE_KEYS.TAB_MAPPING] || {};
  
  // Rule IDs must be integers. We'll use tabIds as ruleIds.
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = currentRules.map(r => r.id);
  
  const addRules = [];

  // Block all tabs that are session tabs but DOES NOT belong to the active session
  for (const [tIdStr, sId] of Object.entries(tabMapping)) {
    const tId = parseInt(tIdStr);
    
    // If this tab belongs to a session that is NOT the active one, BLOCK its network
    if (sId !== sessionId) {
      addRules.push({
        id: tId,
        priority: 1,
        action: { type: 'block' },
        condition: { tabIds: [tId] }
      });
    }
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
  
  console.log(`[SessionDock] Gating updated. Blocked ${addRules.length} session tabs.`);
}

/**
 * Handle Tab Activation (The Core Switch)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (isSwapping) return;
  
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING);
    const tabMapping = data[STORAGE_KEYS.TAB_MAPPING] || {};
    
    const targetSessionId = tabMapping[activeInfo.tabId] || DEFAULT_SESSION_ID;
    
    if (targetSessionId === currentActiveSessionId) {
      // Still in the same session context, just ensure rules are correct (in case tabId changed)
      await updateGatingRules(activeInfo.tabId, targetSessionId);
      return;
    }

    isSwapping = true;
    console.log(`[SessionDock] Switching: ${currentActiveSessionId} -> ${targetSessionId}`);

    // 1. Save current global state
    await saveSessionToStorage(currentActiveSessionId);

    // 2. Clear and Restore new session state
    await restoreSessionFromStorage(targetSessionId);

    // 3. Update memory state and persistence
    currentActiveSessionId = targetSessionId;
    await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_SESSION]: targetSessionId });

    // 4. Update Gating (Block background sessions)
    await updateGatingRules(activeInfo.tabId, targetSessionId);

    // 5. Reload the newly active tab so it sees the new cookie jar
    await chrome.tabs.reload(activeInfo.tabId);

    isSwapping = false;
  } catch (error) {
    console.error('[SessionDock] Switch Error:', error);
    isSwapping = false;
  }
});

/**
 * Handle Tab Removal
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING);
  const tabMapping = data[STORAGE_KEYS.TAB_MAPPING] || {};
  
  if (tabMapping[tabId]) {
    const sId = tabMapping[tabId];
    delete tabMapping[tabId];
    await chrome.storage.local.set({ [STORAGE_KEYS.TAB_MAPPING]: tabMapping });
    
    // If the active session's tab was closed, we stay in that session context 
    // until the user switches to another tab.
    
    // Cleanup DNR rule for this tab
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [tabId]
    });
  }
});

// ============================================================================
// Messaging Implementation
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'getSessions':
        const sData = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
        sendResponse({ success: true, sessions: sData[STORAGE_KEYS.SESSIONS] || {} });
        break;

      case 'createSession':
        const sessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || {};
        const sId = `session_${Date.now()}`;
        sessions[sId] = {
          id: sId,
          name: request.sessionName,
          color: '#4ECDC4',
          cookies: [],
          createdAt: new Date().toISOString()
        };
        await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
        sendResponse({ success: true, session: sessions[sId] });
        break;

      case 'openTabInSession':
        // 1. Map the tab before it's even created/loaded
        const tab = await chrome.tabs.create({ url: 'https://www.google.com' });
        const mapping = (await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING))[STORAGE_KEYS.TAB_MAPPING] || {};
        mapping[tab.id] = request.sessionId;
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_MAPPING]: mapping });
        
        // This tab is now a session tab. Moving to it will trigger the onActivated swap.
        sendResponse({ success: true, tab });
        break;

      case 'deleteSession':
        const allSessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || {};
        delete allSessions[request.sessionId];
        await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: allSessions });
        sendResponse({ success: true });
        break;
        
      case 'getSessionForTab':
        const maps = (await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING))[STORAGE_KEYS.TAB_MAPPING] || {};
        const sessId = maps[request.tabId];
        const sessData = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || {};
        sendResponse({ success: true, session: sessData[sessId] || null });
        break;

      case 'getCurrentTabId':
        sendResponse({ tabId: sender.tab?.id || null });
        break;
    }
  })();
  return true;
});

// Run Init
initialize();
