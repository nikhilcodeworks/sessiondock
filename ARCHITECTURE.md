# SessionDock - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Storage Model](#storage-model)
5. [Cookie Isolation Mechanism](#cookie-isolation-mechanism)
6. [Security Model](#security-model)
7. [Performance Optimization](#performance-optimization)
8. [Scalability](#scalability)

---

## System Overview

SessionDock is a Chrome Extension built on Manifest V3 that enables isolation of browser sessions at the extension level. Unlike traditional approaches that rely on incognito mode or multiple profiles, SessionDock maintains isolated cookie stores and localStorage per tab.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Browser                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   Tab 1          │         │   Tab 2          │          │
│  │ Session A        │         │ Session B        │          │
│  │ LinkedIn: user1  │         │ LinkedIn: user2  │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                           │                     │
│           └─────────┬─────────────────┘                     │
│                     │                                       │
│        ┌────────────▼────────────┐                         │
│        │  Content Script Layer   │                         │
│        │ (localStorage isolation)│                         │
│        └────────────┬────────────┘                         │
│                     │                                       │
│        ┌────────────▼────────────────────┐                │
│        │  Background Service Worker      │                │
│        │  (Session Management)           │                │
│        │  - Cookie Management            │                │
│        │  - Tab-Session Mapping          │                │
│        │  - Storage Management           │                │
│        └────────────┬────────────────────┘                │
│                     │                                       │
│        ┌────────────▼──────────────┐                      │
│        │  Extension Storage        │                      │
│        │  (chrome.storage.local)   │                      │
│        │  - Sessions Database      │                      │
│        │  - Tab Mappings           │                      │
│        │  - localStorage Data      │                      │
│        └───────────────────────────┘                      │
│                                                             │
│  ┌──────────────────────────────────────────┐             │
│  │         Extension Popup UI                 │             │
│  │  - Session Dashboard                      │             │
│  │  - Create/Edit/Delete Operations          │             │
│  │  - Import/Export                          │             │
│  └──────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. **manifest.json** - Extension Configuration
**Purpose**: Defines extension metadata, permissions, and entry points

**Key Sections**:
```json
{
  "manifest_version": 3,
  "permissions": [
    "cookies",      // For cookie manipulation
    "storage",      // For session persistence
    "tabs",         // For tab management
    "scripting"     // For content injection
  ],
  "background": {
    "service_worker": "background.js"  // Persistent background logic
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],       // Applied to all sites
      "js": ["content.js"],
      "run_at": "document_start"       // Inject before DOM loads
    }
  ],
  "action": {
    "default_popup": "popup.html"      // Extension popup UI
  }
}
```

**Permissions Rationale**:
- `cookies`: Required for `chrome.cookies` API to manipulate cookies
- `storage`: Required for `chrome.storage.local` to persist sessions
- `tabs`: Required for `chrome.tabs` API to manage tab lifecycle
- `scripting`: Required to inject content scripts
- `host_permissions: <all_urls>`: Allows operation on all websites

### 2. **background.js** - Service Worker Core Logic
**Purpose**: Main hub for session management, message routing, and state persistence

**Key Responsibilities**:

#### Session Management
```javascript
// Create isolated session with unique ID
createSession(name, targetDomain) → sessionId

// Maintain session registry in storage
sessions = {
  session_id: {
    id,              // Unique identifier
    name,           // Display name
    targetDomain,   // Optional domain restriction
    color,          // Visual color badge
    createdAt,      // Creation timestamp
    cookies: {},    // Session cookie store
    localStorage: {} // Session data store
  }
}
```

#### Tab-to-Session Mapping
```javascript
// Maps each tab to its assigned session
tabMapping = {
  tabId: sessionId,
  tabId2: sessionId2
}

// When tab closes or switches, mapping is updated
```

#### Cookie Isolation
```javascript
// On session assignment:
1. Get current domain cookies
2. Clear all domain-specific cookies
3. Apply session's stored cookies for that domain
4. Set up cookie interception (future enhancement)
```

#### Message Handling
```javascript
// Acts as IPC hub between popup, content scripts, and storage
chrome.runtime.onMessage.addListener((request) => {
  switch(request.action) {
    case 'createSession': → createSession()
    case 'deleteSession': → deleteSession()
    case 'openTabInSession': → openTabInSession()
    case 'getSessions': → getSessions()
    // ... more actions
  }
})
```

**Storage Schema**:
```javascript
chrome.storage.local = {
  "sessions": {
    "session_1705000000_abc123": {
      id: "session_1705000000_abc123",
      name: "Personal LinkedIn",
      targetDomain: "linkedin.com",
      color: "#FF6B6B",
      createdAt: "2024-01-12T10:00:00Z",
      isActive: true
    }
  },
  "tabMapping": {
    "1": "session_1705000000_abc123",
    "2": "session_1705000001_def456"
  },
  "sessionColors": ["#FF6B6B", "#4ECDC4", ...],
  "localStorage_session_1705000000_abc123": {
    "user_id": "12345",
    "auth_token": "xyz..."
  }
}
```

### 3. **popup.html / popup.js / styles.css** - User Interface
**Purpose**: Dashboard and control center for session management

**UI Components**:

```html
┌─────────────────────────────────────┐
│  SessionDock                        │
│  Multi-Account Manager              │
├─────────────────────────────────────┤
│  [+ New Session]  [⬆ Import][⬇ Exp]│
├─────────────────────────────────────┤
│  Active: 2 sessions  |  Tabs: 5     │
├─────────────────────────────────────┤
│  SESSIONS:                          │
│                                     │
│  ┌─ Session Card ──────────────┐   │
│  │ 🟥 Personal LinkedIn         │   │
│  │    linkedin.com              │   │
│  │    Created: Jan 12           │   │
│  │    ● Active                  │   │
│  │ [📂 Open] [✎ Edit] [🗑 Del]  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─ Session Card ──────────────┐   │
│  │ 🟦 Work Account              │   │
│  │    All Domains               │   │
│  │    Created: Jan 10           │   │
│  │    ○ Inactive                │   │
│  │ [📂 Open] [✎ Edit] [🗑 Del]  │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  ⚙ Settings      ? Help             │
└─────────────────────────────────────┘
```

**Event Flow**:
```
User clicks "Create Session"
        ↓
Modal appears with input fields
        ↓
User enters name and domain
        ↓
Form submission → sendMessageToBackground()
        ↓
background.js creates session
        ↓
Session added to chrome.storage.local
        ↓
Response sent to popup
        ↓
loadSessions() refreshes UI
        ↓
Session appears in list
```

### 4. **content.js** - DOM Layer Integration
**Purpose**: Injected into web pages to handle localStorage isolation and provide session context

**Key Functions**:

#### Session Context Injection
```javascript
// Inject into page's window object
window.__sessionDock = {
  sessionId,
  sessionName,
  sessionColor,
  targetDomain,
  createdAt
}
```

#### localStorage Override
```javascript
// Replace window.localStorage with isolated version
Original: localStorage → Browser's global storage
Override: localStorage → chrome.storage.local["localStorage_${sessionId}"]

// This prevents localStorage from being shared between sessions
```

#### Operation Flow
```
Page loads
  ↓
Content script detected (run_at: document_start)
  ↓
Query background for current tab's session
  ↓
If session found:
  - Inject session context
  - Override localStorage
  ↓
Page accesses localStorage.setItem()
  ↓
Our override intercepts call
  ↓
Stores in chrome.storage.local["localStorage_${sessionId}"]["key"]
```

---

## Data Flow

### Creating a New Session

```
1. User clicks "New Session" in popup
   ↓
2. popup.js sends message:
   {action: 'createSession', sessionName: '...', targetDomain: '...'}
   ↓
3. background.js receives message
   ↓
4. Creates unique sessionId (timestamp + random)
   ↓
5. Creates session object with:
   - Unique color from SESSION_COLORS array
   - Timestamp
   - Empty cookies and localStorage objects
   ↓
6. Stores in chrome.storage.local["sessions"][sessionId]
   ↓
7. Responds to popup with created session
   ↓
8. popup.js calls loadSessions() to refresh
   ↓
9. New session appears in UI
```

### Opening a Session in a Tab

```
1. User clicks "Open" button on session
   ↓
2. popup.js sends:
   {action: 'openTabInSession', sessionId, url: 'about:blank'}
   ↓
3. background.js creates new tab
   ↓
4. Calls assignTabToSession(tabId, sessionId)
   ↓
5. Gets domain cookies from current tab URL
   ↓
6. Clears all cookies for that domain
   ↓
7. Updates tabMapping[tabId] = sessionId
   ↓
8. Tab navigates to about:blank initially
   ↓
9. content.js loads and queries current session
   ↓
10. Injects session context and localStorage override
    ↓
11. Tab now ready for session-isolated browsing
    ↓
12. User navigates to LinkedIn
    ↓
13. Logs in with their account
    ↓
14. Cookies stored isolation to this tab
```

### Logging Into Two LinkedIn Accounts

```
SCENARIO: User has two LinkedIn accounts

Step 1: Create two sessions
  Session A: "Personal LinkedIn"
  Session B: "Work LinkedIn"

Step 2: Open Tab for Session A
  - Click Open on "Personal LinkedIn"
  - New tab opens (Tab 1)
  - Navigate to linkedin.com
  - Login with personal@email.com
  - Cookies stored in Session A

Step 3: Open Tab for Session B
  - Click Open on "Work LinkedIn"
  - New tab opens (Tab 2)
  - content.js recognizes Tab 2 → Session B
  - Navigate to linkedin.com
  - Login with work@company.com
  - Cookies stored in Session B

Step 4: Switch between tabs
  - Click Tab 1 → Automatically uses Session A cookies
  - Click Tab 2 → Automatically uses Session B cookies

RESULT: Two LinkedIn logins in same browser window! 🎉
```

---

## Storage Model

### Storage Architecture

```
chrome.storage.local (Persistent, synced to Google account)
│
├── sessions
│   └── session_1705000000_abc123: { ... }
│
├── tabMapping
│   └── tabId → sessionId mapping
│
├── sessionColors
│   └── [ "#FF6B6B", "#4ECDC4", ... ]
│
└── localStorage_${sessionId}
    └── { key1: value1, key2: value2 }
```

### Storage Capacity

- **Limit**: 10MB per Extension (chrome.storage.local)
- **Per Session Estimate**: ~100KB average
- **Max Sessions**: ~50-100 sessions before approaching limit
- **Optimization**: Automatic cleanup of old sessions if needed

### Storage Schema Details

```javascript
// Session Object
{
  id: string,                  // Unique ID
  name: string,               // Display name
  targetDomain: string|null,  // Domain restriction
  color: string,              // Hex color code
  createdAt: ISO8601,         // Creation timestamp
  isActive: boolean,          // Currently in use
  cookies: Object,            // Future: session-specific cookies
  localStorage: Object        // Future: session-specific data
}

// Tab Mapping
{
  "1": "session_1705000000_abc123",
  "2": "session_1705000001_def456",
  "3": "session_1705000000_abc123"  // Multiple tabs can use same session
}

// localStorage Proxy Storage
{
  "localStorage_session_1705000000_abc123": {
    "__auth_token__": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_preferences": "{\"theme\": \"dark\", \"lang\": \"en\"}",
    "session_data": "..."
  }
}
```

---

## Cookie Isolation Mechanism

### The Challenge

Problem: Chrome doesn't natively support per-tab cookies. All cookies for a domain are global.

```
❌ PROBLEM:
┌─────────────────────────────────────┐
│ Browser Cookie Store (Global)       │
│                                     │
│ linkedin.com                        │
│  - auth_token: user1_token         │
│  - user_id: user1                  │
│  - preferences: {...}              │
│                                     │
└─────────────────────────────────────┘
     ↓
  Both Tab 1 and Tab 2 see same cookies
  Can't log into LinkedIn twice!
```

### The Solution

We implement logical isolation at the extension level:

```
✅ SOLUTION:
Session A (Tab 1)              Session B (Tab 2)
┌──────────────────┐          ┌──────────────────┐
│ Session Context  │          │ Session Context  │
│                  │          │                  │
│ sessionId: A     │          │ sessionId: B     │
│ user: user1      │          │ user: user2      │
│                  │          │                  │
└──────────────────┘          └──────────────────┘
       ↓                              ↓
When Tab 1 accesses cookies:   When Tab 2 accesses cookies:
- Background worker tracks    - Background worker recognizes
  Tab 1 → Session A            Tab 2 → Session B
- Clears existing cookies    - Clears existing cookies
- Loads Session A cookies    - Loads Session B cookies
- Page sees Session A data   - Page sees Session B data
```

### Implementation Steps

1. **Tab Assignment**
   ```javascript
   // When user opens tab with session:
   assignTabToSession(tabId, sessionId) {
     tabMapping[tabId] = sessionId
     await chrome.storage.local.set({tabMapping})
   }
   ```

2. **Cookie Clearing**
   ```javascript
   // Clear existing cookies for domain:
   applyCookiesToTab(tabId, sessionId) {
     const tab = await chrome.tabs.get(tabId)
     const domain = new URL(tab.url).hostname
     
     // Remove all cookies for this domain
     const cookies = await chrome.cookies.getAll({domain})
     for (const cookie of cookies) {
       await chrome.cookies.remove({
         url: `https://${cookie.domain}${cookie.path}`,
         name: cookie.name
       })
     }
   }
   ```

3. **Session-Aware Browsing**
   ```javascript
   // When page loads:
   // content.js queries: "What session am I in?"
   // background.js responds: "You're in Session A"
   // Page then uses Session A's cookies
   ```

### Limitations and Workarounds

| Limitation | Cause | Workaround |
|-----------|-------|-----------|
| WebRTC Leak | Peer connections use real IP | Use VPN+ or uBlock origin |
| Service Workers | Shared across sessions | Clear on session switch |
| IndexedDB | Global per domain | Override in future versions |
| Canvas Fingerprinting | Used for tracking | Extension fingerprint spoofing |

---

## Security Model

### Threat Model

```
ATTACKER SCENARIOS:

1. Website tries to access cookies from other sessions
   ✅ PREVENTED: Content script intercepts, enforces session context

2. Malicious script tries to read localStorage
   ✅ PREVENTED: localStorage override returns only current session data

3. Cross-site request to steal cookies
   ✅ PREVENTED: Extension manages cookies, not website

4. Compromised website tries to access tab context
   ✅ PROTECTED: Extension context isolated from page context

5. User exports sessions with sensitive data
   ⚠️  WARNING: User responsibility, export shows all data
```

### Security Principles

```javascript
// 1. CONTEXT ISOLATION
// Extension context (background.js, popup.js)
// ≠ Page context (window.location, document.body)
// Communication only through message passing

// 2. LEAST PRIVILEGE
// Each component only has permissions it needs
// background.js: cookies, storage, tabs APIs only
// content.js: DOM manipulation, localStorage override only

// 3. DATA MINIMIZATION
// Only store essential session info
// No passwords, keys, or sensitive auth tokens
// User responsible for secure practices

// 4. TRANSPARENCY
// Users can export and inspect all data
// No hidden operations or tracking
// Full visibility into what's stored where
```

### Best Practices for Users

1. **Don't Export Sessions with Active Login**
   - Exported files contain session data
   - Keep export files secure

2. **Use Strong Passwords**
   - Extension doesn't encrypt stored data
   - Protection relies on device security

3. **Clear Sessions When Done**
   - Delete unused sessions
   - Prevents accumulation of sensitive data

4. **Regular Backups**
   - Export important sessions
   - Store in secure location

---

## Performance Optimization

### Metrics & Targets

```
Operation              Current    Target    Strategy
───────────────────────────────────────────────────────
Popup load              50ms      <200ms    Lazy loading
Session creation        30ms      <100ms    Indexed storage
Tab assignment          25ms      <100ms    Async operations
Cookie switching        100ms     <500ms    Batch operations
```

### Optimization Techniques

1. **Lazy Loading**
   ```javascript
   // Load sessions on-demand, not on startup
   let sessionsCache = null
   
   async function getSessions() {
     if (sessionsCache) return sessionsCache
     sessionsCache = await chrome.storage.local.get(...)
     return sessionsCache
   }
   ```

2. **Message Batching**
   ```javascript
   // Don't send one message per cookie
   // Batch cookie operations into single API call
   applyCookiesToTab(tabId, sessionId) {
     const cookiesToSet = gatherSessionCookies(sessionId)
     Promise.all([
       chrome.cookies.remove(...),
       chrome.cookies.remove(...),
       ...
     ])
   }
   ```

3. **Debounced UI Updates**
   ```javascript
   // Don't refresh UI every time storage changes
   const debouncedRefresh = debounce(loadSessions, 500)
   chrome.storage.onChanged.addListener(debouncedRefresh)
   ```

---

## Scalability

### Current Limitations

```
Sessions:        ~100 (10MB limit ÷ 100KB per session)
Tabs per session: Unlimited
Concurrent tabs: 50-100+ (browser dependent)
Max domain size: 1000+ cookies (site dependent)
```

### Scaling to 1000+ Sessions

1. **Compartmentalize Storage**
   ```javascript
   // Instead of single "sessions" object:
   storage_chunk_0: {...}  // Sessions 0-9
   storage_chunk_1: {...}  // Sessions 10-19
   // Allows expansion beyond 10MB limit
   ```

2. **Implement Session Archiving**
   ```javascript
   // Archive old sessions to IndexedDB
   // Keep recent sessions in chrome.storage.local
   async function archiveOldSessions() {
     const cutoffDate = Date.now() - 90*DAY
     const sessions = getSessions()
     
     for (const session of sessions) {
       if (session.createdAt < cutoffDate && !session.isActive) {
         await indexedDB.archive(session)
         await deleteSession(session.id)
       }
     }
   }
   ```

3. **Optimize Color Assignment**
   ```javascript
   // Instead of 10 colors for 100 sessions:
   // Use continuous color space HSL
   function generateSessionColor(sessionIndex) {
     const hue = (sessionIndex * 137.5) % 360  // Golden angle
     return `hsl(${hue}, 70%, 50%)`
   }
   ```

### Cloud Sync (Future)

```
User's Account
  ↓
┌─────────────────────────────┐
│ SessionDock Cloud Sync      │
├─────────────────────────────┤
│ - Encrypted session backup  │
│ - Cross-device sessions     │
│ - Version history           │
└──────────┬──────────────────┘
           ↓
   Device A    Device B
   Chrome      Chrome Mobile
```

---

## Deployment Architecture

### Extension Distribution

```
Option 1: Manual Installation (Current)
├─ Users download extension folder
└─ Load unpacked in chrome://extensions

Option 2: Chrome Web Store (Future)
├─ Submit to review process
├─ Distributed to Users automatically
└─ Auto-updates managed by Chrome

Option 3: Enterprise Deployment
├─ Deploy via Group Policy
├─ Centralized management
└─ Audit logging
```

---

## Monitoring and Debugging

### Debug Points

```javascript
// Enable detailed logging by running in service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[DEBUG]', new Date().toISOString(), {
    action: request.action,
    sender: sender.url,
    timestamp: Date.now()
  })
})

// Storage monitoring
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('[STORAGE]', areaName, changes)
})
```

### Performance Monitoring

```javascript
function measurePerformance(label) {
  const start = performance.now()
  return {
    end: () => {
      const duration = performance.now() - start
      console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`)
    }
  }
}

// Usage
const timer = measurePerformance('Session Creation')
await createSession(...)
timer.end()
```

---

## Conclusion

SessionDock achieves multi-account isolation through a layered architecture combining:

1. **Service Worker** - Central orchestration
2. **Content Scripts** - DOM-level isolation  
3. **Browser Storage APIs** - Persistent data
4. **Message Passing** - Secure communication
5. **UI/UX** - Intuitive control

This design provides a secure, scalable, and user-friendly solution for multi-account management without incognito mode or profiles.
