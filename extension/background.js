/**
 * SessionDock Background Service Worker
 * Manages session lifecycle, cookie isolation, and tab associations
 * All sessions open as tabs in the same window with cookie swapping on tab switch
 */

const STORAGE_KEYS = {
  SESSIONS: 'sessions',
  TAB_MAPPING: 'tabMapping',
  ACTIVE_SESSION: 'activeSession',
  SESSION_COLORS: 'sessionColors'
};

const SESSION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52C4A8'
];

// Track the last active session tab for cookie swapping
let lastActiveTabId = null;
let lastActiveSessionId = null;

/**
 * Initialize extension storage with default data
 */
async function initializeStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SESSIONS, STORAGE_KEYS.TAB_MAPPING]);
  
  if (!data[STORAGE_KEYS.SESSIONS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SESSIONS]: {},
      [STORAGE_KEYS.TAB_MAPPING]: {},
      [STORAGE_KEYS.SESSION_COLORS]: SESSION_COLORS
    });
  }
}

/**
 * Create a new isolated session
 * @param {string} sessionName - Display name for the session
 * @param {string} targetDomain - Optional domain restriction
 * @returns {Promise<Object>} Created session object
 */
async function createSession(sessionName, targetDomain = null) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || {};
  const colors = (await chrome.storage.local.get(STORAGE_KEYS.SESSION_COLORS))[STORAGE_KEYS.SESSION_COLORS] || SESSION_COLORS;
  
  const colorIndex = Object.keys(sessions).length % colors.length;
  
  const session = {
    id: sessionId,
    name: sessionName,
    targetDomain,
    color: colors[colorIndex],
    createdAt: new Date().toISOString(),
    cookies: [],
    localStorage: {},
    isActive: false,
    tabId: null  // Track which tab this session owns
  };
  
  sessions[sessionId] = session;
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  
  return session;
}

/**
 * Delete a session and all associated data
 * @param {string} sessionId - Session ID to delete
 */
async function deleteSession(sessionId) {
  const [sessions, tabMapping] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEYS.SESSIONS),
    chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING)
  ]);
  
  const sessionsData = sessions[STORAGE_KEYS.SESSIONS] || {};
  const tabMappingData = tabMapping[STORAGE_KEYS.TAB_MAPPING] || {};
  
  // Close the session's tab if it's still open
  const session = sessionsData[sessionId];
  if (session && session.tabId) {
    try {
      await chrome.tabs.remove(session.tabId);
    } catch (e) {
      // Tab may already be closed
    }
  }
  
  delete sessionsData[sessionId];
  
  // Remove all tab associations for this session
  Object.keys(tabMappingData).forEach(tabId => {
    if (tabMappingData[tabId] === sessionId) {
      delete tabMappingData[tabId];
    }
  });
  
  await Promise.all([
    chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessionsData }),
    chrome.storage.local.set({ [STORAGE_KEYS.TAB_MAPPING]: tabMappingData })
  ]);
}

/**
 * Rename an existing session
 * @param {string} sessionId - Session ID
 * @param {string} newName - New display name
 */
async function renameSession(sessionId, newName) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
  const sessions = data[STORAGE_KEYS.SESSIONS] || {};
  
  if (sessions[sessionId]) {
    sessions[sessionId].name = newName;
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  }
}

/**
 * Get all sessions
 * @returns {Promise<Object>} Sessions object
 */
async function getSessions() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
  return data[STORAGE_KEYS.SESSIONS] || {};
}

/**
 * Get session for a specific tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<Object|null>} Session object or null
 */
async function getSessionForTab(tabId) {
  const tabMapping = await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING);
  const tabMappingData = tabMapping[STORAGE_KEYS.TAB_MAPPING] || {};
  const sessionId = tabMappingData[tabId];
  
  if (!sessionId) return null;
  
  const sessions = await getSessions();
  return sessions[sessionId] || null;
}

// ============================================================================
// Cookie Isolation Functions
// ============================================================================

/**
 * Extract clean domain from a target domain string
 * @param {string} targetDomain - Raw target domain (may include protocol, trailing slash)
 * @returns {string} Clean domain
 */
function cleanDomain(targetDomain) {
  let domain = targetDomain.trim();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/\/.*$/, '');
  return domain;
}

/**
 * Get all cookies related to a domain (including parent domain cookies)
 * @param {string} domain - Clean domain
 * @returns {Promise<Array>} Array of cookie objects
 */
async function getAllDomainCookies(domain) {
  const cookies = await chrome.cookies.getAll({ domain });
  const allCookies = [...cookies];
  
  // Also get cookies for parent domains (e.g., .linkedin.com for in.linkedin.com)
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    const parentCookies = await chrome.cookies.getAll({ domain: parentDomain });
    for (const c of parentCookies) {
      if (!allCookies.some(existing => existing.name === c.name && existing.domain === c.domain && existing.path === c.path)) {
        allCookies.push(c);
      }
    }
  }
  
  return allCookies;
}

/**
 * Save current browser cookies for a session's domain into session storage
 * @param {string} sessionId - Session ID
 */
async function saveSessionCookies(sessionId) {
  const sessions = await getSessions();
  const session = sessions[sessionId];
  if (!session || !session.targetDomain) return;
  
  const domain = cleanDomain(session.targetDomain);
  const allCookies = await getAllDomainCookies(domain);
  
  session.cookies = allCookies.map(cookie => ({
    url: `http${cookie.secure ? 's' : ''}://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate
  }));
  
  sessions[sessionId] = session;
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  console.log(`[SessionDock] Saved ${session.cookies.length} cookies for session "${session.name}"`);
}

/**
 * Clear all cookies for a specific domain
 * @param {string} targetDomain - Domain to clear cookies for
 */
async function clearDomainCookies(targetDomain) {
  const domain = cleanDomain(targetDomain);
  const allCookies = await getAllDomainCookies(domain);
  
  for (const cookie of allCookies) {
    try {
      const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
      await chrome.cookies.remove({
        url: cookieUrl,
        name: cookie.name
      });
    } catch (e) {
      console.log(`[SessionDock] Could not remove cookie: ${cookie.name}`);
    }
  }
  
  console.log(`[SessionDock] Cleared ${allCookies.length} cookies for domain "${domain}"`);
}

/**
 * Restore saved cookies for a session from session storage
 * @param {string} sessionId - Session ID
 */
async function restoreSessionCookies(sessionId) {
  const sessions = await getSessions();
  const session = sessions[sessionId];
  if (!session || !session.cookies || !Array.isArray(session.cookies) || session.cookies.length === 0) {
    console.log(`[SessionDock] No cookies to restore for session "${session?.name}"`);
    return;
  }
  
  let restored = 0;
  for (const cookie of session.cookies) {
    try {
      const cookieDetails = {
        url: cookie.url,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'unspecified'
      };
      
      if (cookieDetails.sameSite === 'no_restriction') {
        cookieDetails.secure = true;
      }
      
      if (cookie.expirationDate) {
        cookieDetails.expirationDate = cookie.expirationDate;
      }
      
      if (cookie.domain && cookie.domain.startsWith('.')) {
        cookieDetails.domain = cookie.domain;
      }
      
      await chrome.cookies.set(cookieDetails);
      restored++;
    } catch (e) {
      console.log(`[SessionDock] Could not restore cookie: ${cookie.name}`, e);
    }
  }
  
  console.log(`[SessionDock] Restored ${restored}/${session.cookies.length} cookies for session "${session.name}"`);
}

// ============================================================================
// Session Tab Management
// ============================================================================

/**
 * Open a session in a new tab (same window) with cookie isolation
 * If session tab already exists, focus it instead
 * @param {string} sessionId - Session ID
 * @param {string} url - URL to navigate to (uses target domain if not provided)
 */
async function openTabInSession(sessionId, url = null) {
  const sessions = await getSessions();
  const session = sessions[sessionId];
  
  // Determine URL from target domain if not provided
  if (!url && session?.targetDomain) {
    let domain = cleanDomain(session.targetDomain);
    url = `https://${domain}`;
  }
  
  // If no URL and no domain — open a new tab page (NOT about:blank)
  // We pass no url to chrome.tabs.create which defaults to new tab page
  
  // Check if session already has an open tab — focus it
  if (session.tabId) {
    try {
      const existingTab = await chrome.tabs.get(session.tabId);
      if (existingTab) {
        // Tab still exists — just focus it
        await chrome.tabs.update(session.tabId, { active: true });
        // Also focus the window the tab is in
        await chrome.windows.update(existingTab.windowId, { focused: true });
        console.log(`[SessionDock] Focused existing tab for session "${session.name}"`);
        return { id: session.tabId };
      }
    } catch (e) {
      // Tab was closed, we'll create a new one below
      console.log(`[SessionDock] Session tab was closed, creating new one`);
      session.tabId = null;
    }
  }
  
  // Cookie isolation: save current session cookies, clear, restore new session's
  if (session?.targetDomain) {
    // Save cookies of whatever session currently owns the cookie jar for this domain
    const currentOwner = await findActiveSessionForDomain(session.targetDomain, sessionId);
    if (currentOwner) {
      await saveSessionCookies(currentOwner);
    }
    
    // Clear all domain cookies
    await clearDomainCookies(session.targetDomain);
    
    // Restore this session's saved cookies (empty for new session = logged out)
    await restoreSessionCookies(sessionId);
  }
  
  // Create the tab — if no URL, omit it so Chrome opens the default new tab page
  const tabOptions = { active: true };
  if (url) {
    tabOptions.url = url;
  }
  const tab = await chrome.tabs.create(tabOptions);
  
  // Map tab to session
  const tabMapping = (await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING))[STORAGE_KEYS.TAB_MAPPING] || {};
  tabMapping[tab.id] = sessionId;
  await chrome.storage.local.set({ [STORAGE_KEYS.TAB_MAPPING]: tabMapping });
  
  // Update session with tabId and active status
  sessions[sessionId].tabId = tab.id;
  sessions[sessionId].isActive = true;
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  
  // Track this as the last active session tab
  lastActiveTabId = tab.id;
  lastActiveSessionId = sessionId;
  
  console.log(`[SessionDock] Opened session "${session.name}" in tab ${tab.id}`);
  return tab;
}

/**
 * Find an active (has open tab) session that uses the same domain, excluding a given sessionId
 * @param {string} targetDomain - Domain to match
 * @param {string} excludeSessionId - Session ID to exclude
 * @returns {Promise<string|null>} Session ID or null
 */
async function findActiveSessionForDomain(targetDomain, excludeSessionId) {
  const sessions = await getSessions();
  const domain = cleanDomain(targetDomain);
  
  for (const [sid, s] of Object.entries(sessions)) {
    if (sid === excludeSessionId) continue;
    if (!s.targetDomain || !s.tabId) continue;
    if (cleanDomain(s.targetDomain) !== domain) continue;
    
    // Verify tab is still open
    try {
      await chrome.tabs.get(s.tabId);
      return sid;
    } catch (e) {
      // Tab closed, clear the tabId
      s.tabId = null;
      s.isActive = false;
    }
  }
  
  // Persist any tabId cleanups
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
  return null;
}

/**
 * Export sessions as JSON
 * @returns {Promise<string>} JSON string of all sessions
 */
async function exportSessions() {
  const sessions = await getSessions();
  return JSON.stringify(sessions, null, 2);
}

/**
 * Import sessions from JSON
 * @param {string} jsonData - JSON string of sessions
 */
async function importSessions(jsonData) {
  try {
    const importedSessions = JSON.parse(jsonData);
    const existingSessions = await getSessions();
    
    // Clear tabId from imported sessions (tabs won't be valid)
    for (const s of Object.values(importedSessions)) {
      s.tabId = null;
      s.isActive = false;
    }
    
    const merged = { ...existingSessions, ...importedSessions };
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: merged });
    
    return { success: true, message: 'Sessions imported successfully' };
  } catch (e) {
    return { success: false, message: 'Invalid JSON format' };
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Listen for tab activation to swap cookies between sessions
 * This is the core of cookie isolation — when user switches to a session tab,
 * save old session cookies and restore the new session's cookies
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tabMapping = (await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING))[STORAGE_KEYS.TAB_MAPPING] || {};
    const sessions = await getSessions();
    
    const newSessionId = tabMapping[activeInfo.tabId];
    
    // If the new tab is not a session tab, just track it and move on
    if (!newSessionId) {
      lastActiveTabId = activeInfo.tabId;
      lastActiveSessionId = null;
      return;
    }
    
    // If switching to the same session, no cookie swap needed
    if (newSessionId === lastActiveSessionId) {
      lastActiveTabId = activeInfo.tabId;
      return;
    }
    
    const prevSession = lastActiveSessionId ? sessions[lastActiveSessionId] : null;
    const newSession = sessions[newSessionId];
    
    // Only swap cookies if both sessions target the same domain
    if (prevSession?.targetDomain && newSession?.targetDomain &&
        cleanDomain(prevSession.targetDomain) === cleanDomain(newSession.targetDomain)) {
      
      console.log(`[SessionDock] Tab switch: swapping cookies "${prevSession.name}" → "${newSession.name}"`);
      
      // Save current cookies to previous session
      await saveSessionCookies(lastActiveSessionId);
      
      // Clear domain cookies
      await clearDomainCookies(newSession.targetDomain);
      
      // Restore new session's cookies
      await restoreSessionCookies(newSessionId);
      
      // Reload the tab to apply new cookies
      try {
        await chrome.tabs.reload(activeInfo.tabId);
      } catch (e) {
        console.log('[SessionDock] Could not reload tab:', e);
      }
    }
    
    lastActiveTabId = activeInfo.tabId;
    lastActiveSessionId = newSessionId;
  } catch (error) {
    console.error('[SessionDock] Error in tab activation handler:', error);
  }
});

/**
 * Listen for tab closure events — save cookies and clean up
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const tabMapping = await chrome.storage.local.get(STORAGE_KEYS.TAB_MAPPING);
    const tabMappingData = tabMapping[STORAGE_KEYS.TAB_MAPPING] || {};
    
    const sessionId = tabMappingData[tabId];
    if (sessionId) {
      // Save cookies before removing
      await saveSessionCookies(sessionId);
      console.log(`[SessionDock] Saved cookies on tab close for session`);
      
      // Clear tabId from session
      const sessions = await getSessions();
      if (sessions[sessionId]) {
        sessions[sessionId].tabId = null;
        sessions[sessionId].isActive = false;
        await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions });
      }
    }
    
    delete tabMappingData[tabId];
    await chrome.storage.local.set({ [STORAGE_KEYS.TAB_MAPPING]: tabMappingData });
    
    if (lastActiveTabId === tabId) {
      lastActiveTabId = null;
      lastActiveSessionId = null;
    }
  } catch (error) {
    console.error('[SessionDock] Error in tab removal handler:', error);
  }
});

/**
 * Listen for messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'createSession':
          const newSession = await createSession(request.sessionName, request.targetDomain);
          sendResponse({ success: true, session: newSession });
          break;
          
        case 'deleteSession':
          await deleteSession(request.sessionId);
          sendResponse({ success: true });
          break;
          
        case 'renameSession':
          await renameSession(request.sessionId, request.newName);
          sendResponse({ success: true });
          break;
          
        case 'getSessions':
          const sessions = await getSessions();
          sendResponse({ success: true, sessions });
          break;
          
        case 'getSessionForTab':
          const session = await getSessionForTab(request.tabId);
          sendResponse({ success: true, session });
          break;
          
        case 'openTabInSession':
          const tab = await openTabInSession(request.sessionId, request.url);
          sendResponse({ success: true, tab });
          break;
          
        case 'exportSessions':
          const exported = await exportSessions();
          sendResponse({ success: true, data: exported });
          break;
          
        case 'importSessions':
          const importResult = await importSessions(request.data);
          sendResponse(importResult);
          break;
          
        default:
          sendResponse({ success: false, message: 'Unknown action' });
      }
    } catch (error) {
      console.error('[SessionDock] Message handler error:', error);
      sendResponse({ success: false, message: error.message });
    }
  })();
  
  return true; // Keep the channel open for async responses
});

// Initialize storage on service worker startup
initializeStorage();

console.log('[SessionDock] Background service worker initialized');
