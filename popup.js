/**
 * SessionDock Popup Script
 * Handles UI interactions and communication with background service worker
 */

// ============================================================================
// DOM Elements
// ============================================================================
const createSessionBtn = document.getElementById('createSessionBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const sessionsList = document.getElementById('sessionsList');
const sessionModal = document.getElementById('sessionModal');
const confirmModal = document.getElementById('confirmModal');
const sessionForm = document.getElementById('sessionForm');
const sessionNameInput = document.getElementById('sessionName');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalCloseBtn = document.querySelector('.modal-close');
const toast = document.getElementById('toast');
const activeSessionCount = document.getElementById('activeSessionCount');
const openTabCount = document.getElementById('openTabCount');

// ============================================================================
// State Management
// ============================================================================
let sessions = {};
let editingSessionId = null;
let userHasEditedDomain = false;

// Common service to domain mapping
const DOMAIN_MAPPING = {
  'github': 'github.com',
  'linkedin': 'linkedin.com',
  'google': 'google.com',
  'gmail': 'gmail.com',
  'facebook': 'facebook.com',
  'meta': 'facebook.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'instagram': 'instagram.com',
  'reddit': 'reddit.com',
  'amazon': 'amazon.com',
  'netflix': 'netflix.com',
  'microsoft': 'microsoft.com',
  'outlook': 'outlook.com',
  'apple': 'apple.com',
  'youtube': 'youtube.com',
  'discord': 'discord.com',
  'slack': 'slack.com',
  'chatgpt': 'chatgpt.com',
  'openai': 'openai.com',
  'claude': 'anthropic.com',
  'gemini': 'gemini.google.com',
  'binance': 'binance.com',
  'coinbase': 'coinbase.com',
  'upstox': 'upstox.com',
  'kite': 'kite.zerodha.com',
  'zerodha': 'kite.zerodha.com',
  'canva': 'canva.com'
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Send message to background service worker
 * @param {Object} message - Message to send
 * @returns {Promise} Response from background worker
 */
function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - 'success', 'error', 'info'
 * @param {number} duration - Duration in ms
 */
function showToast(message, type = 'info', duration = 3000) {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

/**
 * Load and render all sessions
 */
async function loadSessions() {
  try {
    const response = await sendMessageToBackground({ action: 'getSessions' });
    sessions = response.sessions || {};
    renderSessions();
    updateStats();
  } catch (error) {
    showToast('Failed to load sessions', 'error');
    console.error(error);
  }
}

/**
 * Render sessions list
 */
function renderSessions() {
  const sessionIds = Object.keys(sessions).filter(id => id !== '__default__');
  
  if (sessionIds.length === 0) {
    sessionsList.innerHTML = `
      <div class="empty-state">
        <p>No sessions yet</p>
        <p class="empty-hint">Create a new session to get started</p>
      </div>
    `;
    return;
  }
  
  sessionsList.innerHTML = sessionIds.map(id => createSessionCard(id)).join('');
  attachSessionCardListeners();
}

/**
 * Create HTML for a session card
 * @param {string} sessionId - Session ID
 * @returns {string} HTML string
 */
function createSessionCard(sessionId) {
  const session = sessions[sessionId];
  const domain = session.targetDomain || 'All Domains';
  const hasTab = !!session.tabId;
  const openLabel = hasTab ? '🔍 Focus' : '📂 Open';
  const openTitle = hasTab ? 'Focus existing session tab' : 'Open in new tab';
  
  return `
    <div class="session-card" data-session-id="${sessionId}">
      <div class="session-header">
        <div class="session-color-badge" style="background-color: ${session.color}"></div>
        <div class="session-info">
          <h3 class="session-name">${escapeHtml(session.name)}</h3>
          <p class="session-domain">Isolated Tab Session</p>
        </div>
      </div>
      
      <div class="session-meta">
        <span class="session-date">Created: ${formatDate(session.createdAt)}</span>
        <span class="session-status ${hasTab ? 'active' : 'inactive'}">
          ${hasTab ? '● Active' : '○ Inactive'}
        </span>
      </div>
      
      <div class="session-actions">
        <button class="btn-action btn-open" data-action="open" title="${openTitle}">
          ${openLabel}
        </button>
        <button class="btn-action btn-edit" data-action="edit" title="Edit session">
          ✎ Edit
        </button>
        <button class="btn-action btn-delete" data-action="delete" title="Delete session">
          🗑 Delete
        </button>
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date to readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Attach event listeners to session cards
 */
function attachSessionCardListeners() {
  document.querySelectorAll('.session-card').forEach(card => {
    const sessionId = card.dataset.sessionId;
    const actions = card.querySelectorAll('[data-action]');
    
    actions.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        
        switch (action) {
          case 'open':
            await handleOpenSession(sessionId);
            break;
          case 'edit':
            handleEditSession(sessionId);
            break;
          case 'delete':
            handleDeleteSession(sessionId);
            break;
        }
      });
    });
  });
}

/**
 * Update statistics
 */
async function updateStats() {
  const activeSessions = Object.values(sessions).filter(s => s.isActive).length;
  activeSessionCount.textContent = activeSessions;
  
  // Count open tabs (would require additional tracking)
  const tabs = await chrome.tabs.query({});
  openTabCount.textContent = tabs.length;
}

/**
 * Handle opening a session in a new tab
 * @param {string} sessionId - Session ID
 */
async function handleOpenSession(sessionId) {
  try {
    const session = sessions[sessionId];
    const hasTab = !!session?.tabId;
    
    const response = await sendMessageToBackground({
      action: 'openTabInSession',
      sessionId
    });
    
    if (response.success) {
      const msg = hasTab ? 'Focused session tab' : 'Opened session in new tab';
      showToast(msg, 'success');
      // Close popup after short delay
      setTimeout(() => window.close(), 500);
    } else {
      showToast('Failed to open session', 'error');
    }
  } catch (error) {
    showToast('Error opening session', 'error');
    console.error(error);
  }
}

/**
 * Handle editing a session
 * @param {string} sessionId - Session ID
 */
function handleEditSession(sessionId) {
  editingSessionId = sessionId;
  const session = sessions[sessionId];
  
  document.getElementById('modalTitle').textContent = 'Edit Session';
  sessionNameInput.value = session.name;
  sessionForm.querySelector('button[type="submit"]').textContent = 'Save Changes';
  
  openModal();
}

/**
 * Handle deleting a session
 * @param {string} sessionId - Session ID
 */
function handleDeleteSession(sessionId) {
  const session = sessions[sessionId];
  showConfirmModal(
    'Delete Session',
    `Are you sure you want to delete "${escapeHtml(session.name)}"? This action cannot be undone.`,
    async () => {
      try {
        await sendMessageToBackground({
          action: 'deleteSession',
          sessionId
        });
        
        showToast('Session deleted', 'success');
        await loadSessions();
      } catch (error) {
        showToast('Failed to delete session', 'error');
        console.error(error);
      }
    }
  );
}

// ============================================================================
// Modal Management
// ============================================================================

/**
 * Open session modal
 */
function openModal() {
  sessionModal.classList.remove('hidden');
  sessionNameInput.focus();
}

/**
 * Close session modal
 */
function closeModal() {
  sessionModal.classList.add('hidden');
  resetForm();
  editingSessionId = null;
  userHasEditedDomain = false;
}

/**
 * Reset form inputs
 */
function resetForm() {
  sessionForm.reset();
  document.getElementById('modalTitle').textContent = 'Create New Session';
  sessionForm.querySelector('button[type="submit"]').textContent = 'Create Session';
  userHasEditedDomain = false;
}

/**
 * Show confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {Function} onConfirm - Callback on confirm
 */
function showConfirmModal(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  const handler = async () => {
    await onConfirm();
    confirmModal.classList.add('hidden');
    confirmOkBtn.removeEventListener('click', handler);
  };
  
  confirmOkBtn.addEventListener('click', handler);
  confirmModal.classList.remove('hidden');
}

// ============================================================================
// Event Listeners
// ============================================================================

// Create session button
createSessionBtn.addEventListener('click', () => {
  resetForm();
  editingSessionId = null;
  openModal();
});

// Modal close buttons
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
document.getElementById('confirmCancelBtn').addEventListener('click', () => {
  confirmModal.classList.add('hidden');
});

// Auto-fill domain based on name
sessionNameInput.addEventListener('input', () => {
  if (editingSessionId || userHasEditedDomain) return;
  
  const name = sessionNameInput.value.toLowerCase().trim();
  
  // Try to find a match in the mapping
  for (const [key, domain] of Object.entries(DOMAIN_MAPPING)) {
    if (name.includes(key)) {
      targetDomainInput.value = domain;
      return;
    }
  }
});

// Track if user manually edits domain
// (Removed)

// Form submission
sessionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const sessionName = sessionNameInput.value.trim();
  
  if (!sessionName) {
    showToast('Session name cannot be empty', 'error');
    return;
  }
  
  try {
    if (editingSessionId) {
      // Edit existing session
      await sendMessageToBackground({
        action: 'renameSession',
        sessionId: editingSessionId,
        newName: sessionName
      });
      showToast('Session updated', 'success');
    } else {
      // Create new session
      await sendMessageToBackground({
        action: 'createSession',
        sessionName
      });
      showToast('Session created successfully', 'success');
    }
    
    closeModal();
    await loadSessions();
  } catch (error) {
    showToast('Failed to save session', 'error');
    console.error(error);
  }
});

// Export button
exportBtn.addEventListener('click', async () => {
  try {
    const response = await sendMessageToBackground({ action: 'exportSessions' });
    const dataStr = response.data;
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sessions-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Sessions exported', 'success');
  } catch (error) {
    showToast('Failed to export sessions', 'error');
    console.error(error);
  }
});

// Import button
importBtn.addEventListener('click', async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target.result;
        const response = await sendMessageToBackground({
          action: 'importSessions',
          data
        });
        
        if (response.success) {
          showToast('Sessions imported', 'success');
          await loadSessions();
        } else {
          showToast(response.message || 'Import failed', 'error');
        }
      } catch (error) {
        showToast('Failed to import sessions', 'error');
        console.error(error);
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

// Settings and Help links
document.getElementById('settingsLink').addEventListener('click', (e) => {
  e.preventDefault();
  showToast('Settings coming soon', 'info');
});

document.getElementById('helpLink').addEventListener('click', (e) => {
  e.preventDefault();
  const helpText = `
SessionDock Help:

1. Create sessions with a name and target domain (e.g. chatgpt.com)
2. Click "Open" to launch a session in a new tab
3. Each session tab has isolated cookies — separate logins!
4. Click "Focus" to switch to an already-open session tab
5. Use Export/Import to backup and restore sessions

For more help, visit the documentation.
  `.trim();
  alert(helpText);
});

// ============================================================================
// Initialize
// ============================================================================

loadSessions();

// Refresh sessions every 5 seconds
setInterval(loadSessions, 5000);

console.log('SessionDock popup initialized');
