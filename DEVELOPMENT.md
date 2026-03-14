# SessionDock Development Guide

Complete guide for extending, debugging, and contributing to SessionDock.

## Table of Contents
1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Code Standards](#code-standards)
4. [Debugging Techniques](#debugging-techniques)
5. [Testing Approach](#testing-approach)
6. [Common Customizations](#common-customizations)
7. [Known Issues](#known-issues)
8. [Performance Profiling](#performance-profiling)

---

## Development Setup

### Prerequisites

- Chrome/Chromium v119+
- Text Editor (VS Code recommended)
- Git (optional)
- Developer Tools (F12)

### Setup Steps

1. **Clone or Download Files**
   ```bash
   # Option A: Download as ZIP
   # From: C:\Users\nikhi\Desktop\SessionDock\extension
   
   # Option B: Initialize as git repo
   cd C:\Users\nikhi\Desktop\SessionDock\extension
   git init
   ```

2. **Open in VS Code**
   ```bash
   code C:\Users\nikhi\Desktop\SessionDock\extension
   ```

3. **Load in Chrome**
   - Open `chrome://extensions`
   - Toggle "Developer mode" ON
   - Click "Load unpacked"
   - Select extension folder

4. **Set Up Debugging**
   - Keep Extensions page open
   - Pin extension to toolbar: Click icon next to address bar
   - Open DevTools with F12

---

## Project Structure

```
extension/
├── manifest.json              # Configuration (don't remove)
├── background.js              # Service worker (core logic)
├── content.js                 # Content script (DOM injection)
├── popup.html                 # UI markup
├── popup.js                   # Popup logic (UI controller)
├── styles.css                 # UI styling
├── README.md                  # User documentation
├── ARCHITECTURE.md            # Design documentation
├── DEVELOPMENT.md             # This file
└── icons/                     # Extension icons
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### File Responsibilities

| File | Purpose | Size | Changes |
|------|---------|------|---------|
| manifest.json | Config | 200B | Minimal |
| background.js | Core | 8KB | Features |
| content.js | DOM | 4KB | Edge cases |
| popup.html | UI markup | 3KB | UI |
| popup.js | Logic | 10KB | Features |
| styles.css | Styling | 8KB | Design |

---

## Code Standards

### JavaScript Style Guide

```javascript
// ✅ DO: Use ES6 syntax
const session = {id: 'abc', name: 'Personal'}
const color = session?.color || '#FF6B6B'

// ❌ DON'T: Use var or old syntax
var session = {};

// ✅ DO: Comment complex functions
/**
 * Description of what this does
 * @param {type} paramName - Description
 * @returns {type} Description
 */
function complexFunction(paramName) {
  // Implementation
}

// ❌ DON'T: Missing documentation
function foo(x) { return x * 2 }

// ✅ DO: Use async/await
async function loadSessions() {
  const data = await chrome.storage.local.get('sessions')
  return data.sessions || {}
}

// ❌ DON'T: Use Promise.then() (outdated style)
chrome.storage.local.get('sessions').then(...)

// ✅ DO: Use meaningful variable names
const sessionId = 'session_1705000000_abc123'

// ❌ DON'T: Use cryptic names
const s = 'session_1705000000_abc123'
```

### Naming Conventions

```javascript
// Constants: UPPER_SNAKE_CASE
const MAX_SESSIONS = 100
const STORAGE_KEYS = { SESSIONS: 'sessions' }

// Functions: camelCase
function createSession(name) {}
async function loadSessions() {}

// Classes: PascalCase (if used)
class SessionManager {}

// Variables: camelCase
const currentSession = {}
let isActive = false

// Private functions: _prefixedName (convention)
function _validateSessionName(name) {}
```

### Commenting Requirements

```javascript
// ✅ Block comments for major sections
/**
 * Session Management Module
 * Handles CRUD operations for sessions
 */

// ✅ Line comments for non-obvious code
// Clear cookies for domain before applying new session
await clearSessionCookies(domain)

// ❌ Avoid obvious comments
// Get sessions
const sessions = getSessions()

// ✅ Complex logic explanation
// Use golden angle for color distribution to maximize
// visual distinction between sessions (reduces collisions)
const hue = (index * 137.5) % 360
```

### Module Organization

```javascript
// ✅ Organize like this:

// 1. Constants at top
const STORAGE_KEYS = { ... }

// 2. Helper functions
function _validateInput(input) { ... }

// 3. Main exported functions
async function createSession(name) { ... }

// 4. Event listeners at bottom
chrome.tabs.onRemoved.addListener(...)
```

---

## Debugging Techniques

### 1. Service Worker Debugging

```javascript
// Access background service worker:
// 1. Go to chrome://extensions
// 2. Find SessionDock
// 3. Click "Service worker" link

// Log in service worker (shows in service worker console)
console.log('[DEBUG]', message)

// Persistent logs (written to storage)
async function debugLog(message) {
  const logs = (await chrome.storage.local.get('debug_logs')).debug_logs || []
  logs.push({ message, timestamp: Date.now() })
  await chrome.storage.local.set({ debug_logs: logs.slice(-100) }) // Keep last 100
}
```

### 2. Popup Debugging

```javascript
// Open DevTools for popup:
// 1. Right-click extension icon
// 2. Click "Inspect popup"
// 3. DevTools opens for popup

// Use normal console.log() - shows in DevTools
console.log('Popup debug message')

// Inspect DOM elements
console.log(document.getElementById('sessionsList'))
```

### 3. Content Script Debugging

```javascript
// Content script runs on web pages
// Debug by opening page DevTools (F12)

// Logs appear in page DevTools console
console.log('[SessionDock Content]', message)

// Access window.__sessionDock
console.log(window.__sessionDock)

// Test localStorage override
localStorage.setItem('test', 'value')
console.log(localStorage.getItem('test'))
```

### 4. Storage Inspection

```javascript
// Check what's stored:
// Method 1: Chrome DevTools
// 1. Open chrome://extensions
// 2. SessionDock → Service worker
// 3. Storage tab → Local Storage

// Method 2: Programmatic
const all = await chrome.storage.local.get()
console.table(all)

// Method 3: Query specific keys
const sessions = await chrome.storage.local.get('sessions')
console.log(sessions.sessions)
```

### 5. Add Debug Features

```javascript
// Add this to popup.js to expose debug panel
window.DEBUG = {
  // Get all data
  async getAllData() {
    return await chrome.storage.local.get()
  },
  
  // Clear all data
  async clearAll() {
    await chrome.storage.local.clear()
    location.reload()
  },
  
  // Create test sessions
  async createTestSessions(count) {
    for (let i = 0; i < count; i++) {
      await chrome.runtime.sendMessage({
        action: 'createSession',
        sessionName: `Test Session ${i+1}`,
        targetDomain: null
      })
    }
  }
}

// Usage in DevTools console while popup is open:
// DEBUG.getAllData()
// DEBUG.clearAll()
// DEBUG.createTestSessions(5)
```

---

## Testing Approach

### Manual Testing Checklist

```
Session Creation:
☐ Create new session
☐ Session appears in list
☐ Can create with target domain
☐ Colors are unique
☐ Can't create with empty name

Session Operations:
☐ Edit session name successfully
☐ Delete session with confirmation
☐ Deleted session removed from list
☐ Can't perform ops on non-existent session

Tab Management:
☐ Opening session creates new tab
☐ Tab is associated with session
☐ Multiple tabs can use same session
☐ Closing tab removes mapping

Cookie Isolation:
☐ Log into LinkedIn Tab 1 with user1
☐ Open new session in Tab 2
☐ Navigate to LinkedIn in Tab 2
☐ Can log in with user2 (different account)
☐ Switch back to Tab 1 - still user1
☐ Switch to Tab 2 - still user2

Import/Export:
☐ Export creates .json file
☐ Import loads sessions from file
☐ Imported sessions appear in list
☐ Invalid JSON shows error
☐ Large export/import works

UI/UX:
☐ Popup loads quickly
☐ All buttons work
☐ Modal opens/closes correctly
☐ Toast notifications appear
☐ Responsive layout works
```

### Automated Testing (Future)

```javascript
// Example test structure (Jest)
describe('Session Management', () => {
  test('creates session successfully', async () => {
    const session = await createSession('Test', null)
    expect(session.id).toBeDefined()
    expect(session.name).toBe('Test')
  })
  
  test('prevents duplicate session names', async () => {
    await createSession('Same', null)
    expect(() => createSession('Same', null)).toThrow()
  })
})
```

---

## Common Customizations

### 1. Change Color Palette

```javascript
// In background.js, modify SESSION_COLORS:

const SESSION_COLORS = [
  '#3498db', // blue
  '#2ecc71', // green
  '#e74c3c', // red
  '#f39c12', // orange
  '#9b59b6'  // purple
  // Add more colors as needed
]
```

### 2. Add Domain Restrictions UI

```javascript
// In popup.html, add field:
<div class="form-group">
  <label for="domainRestriction">Restrict to Domain</label>
  <input type="text" id="domainRestriction" 
         placeholder="e.g., linkedin.com (optional)">
</div>

// In popup.js form handler:
const targetDomain = document.getElementById('domainRestriction').value || null
```

### 3. Customize Popup Size

```css
/* In styles.css: */
body {
  width: 500px;     /* Change width */
  min-height: 600px; /* Change height */
}
```

### 4. Add Session Keyboard Shortcuts

```javascript
// In background.js:
chrome.commands.onCommand.addListener((command) => {
  if (command === 'create_session') {
    chrome.action.openPopup()
  }
})

// In manifest.json:
"commands": {
  "create_session": {
    "suggested_key": {
      "default": "Ctrl+Shift+I"
    },
    "description": "Create new session"
  }
}
```

### 5. Add Session Icons

```javascript
// In popup.js, show emoji icons based on content:
const sessionIcon = session.targetDomain 
  ? {
      'linkedin.com': '💼',
      'gmail.com': '📧',
      'facebook.com': '👥'
    }[session.targetDomain] || '🔒'
  : '🔓'

sessionCard.innerHTML = `<span>${sessionIcon}</span> ${session.name}`
```

---

## Known Issues

### Issue #1: localStorage not persisting across page reloads

**Status**: By design

**Explanation**: The content script override stores in chrome.storage.local which is async. Some websites may override localStorage before injection completes.

**Workaround**: 
- Ensure site doesn't have localStorage initialization in `<head>`
- Use `document_start` run_at (already done)
- Contact if still issues

### Issue #2: WebRTC leaking real IP

**Status**: Known limitation

**Explanation**: WebRTC connections bypass HTTP/HTTPS, so they leak real IP even in isolated sessions.

**Workaround**:
- Recommendations: VPN or uBlock Origin's WebRTC leak prevention
- Future: Implement chrome.webRequest interception (Manifest V2 feature)

### Issue #3: Service Worker Termination

**Status**: Chrome behavior

**Explanation**: Service workers can be terminated after inactivity. This can cause message routing to fail.

**Workaround**:
- Extension handles gracefully with try/catch
- If issues occur, reload extension via chrome://extensions

### Issue #4: IndexedDB Not Isolated

**Status**: Known limitation

**Explanation**: IndexedDB is per-origin, not per-tab, so it's not currently isolated.

**Workaround**:
- First implementation used chrome.storage only
- IndexedDB support planned for v2.0

---

## Performance Profiling

### Measuring Operation Performance

```javascript
// Create custom timer
function createTimer() {
  const start = performance.now()
  return {
    end: (label) => {
      const duration = performance.now() - start
      const formatted = duration.toFixed(2) + 'ms'
      console.log(`⏱️  ${label}: ${formatted}`)
      return duration
    }
  }
}

// Usage
const timer = createTimer()
await createSession('Test', null)
timer.end('Session creation')

// Output: ⏱️  Session creation: 12.50ms
```

### Profile Storage Operations

```javascript
// Measure chrome.storage.local reads
async function profileStorageRead() {
  const timer = createTimer()
  const data = await chrome.storage.local.get()
  const size = JSON.stringify(data).length
  timer.end(`Read ${size} bytes`)
}

// Measure chrome.cookies operations
async function profileCookieOps() {
  const timer = createTimer()
  const cookies = await chrome.cookies.getAll()
  timer.end(`Retrieved ${cookies.length} cookies`)
}
```

### Chrome DevTools Profiling

1. Open Service Worker DevTools (chrome://extensions)
2. Performance tab → Click Record
3. Perform action (create session, etc.)
4. Click Stop
5. Analyze timeline

### Memory Leak Detection

```javascript
// In service worker, monitor memory growth
setInterval(async () => {
  const sessions = await getSessions()
  const size = JSON.stringify(sessions).length / 1024 // KB
  console.log(`Sessions storage: ${size.toFixed(2)} KB`)
}, 60000) // Every minute
```

### Optimization Tips

```javascript
// ✅ DO: Batch operations
await Promise.all([
  chrome.storage.local.set({sessions}),
  chrome.storage.local.set({tabMapping})
])

// ❌ DON'T: Sequential operations
await chrome.storage.local.set({sessions})
await chrome.storage.local.set({tabMapping})

// ✅ DO: Cache frequently accessed data
let sessionCache = null
async function getSessions() {
  if (sessionCache) return sessionCache
  sessionCache = (await chrome.storage.local.get('sessions')).sessions
  return sessionCache
}

// ❌ DON'T: Query storage repeatedly
for (let i = 0; i < 100; i++) {
  const sessions = (await chrome.storage.local.get('sessions')).sessions
}
```

---

## Contributing Guidelines

### Before Making Changes

1. Create a backup: Export sessions
2. Test on fresh data: Clear storage
3. Use version control: Git branches
4. Document changes: Comment addition

### Code Review Checklist

- [ ] Code follows standards above
- [ ] Backwards compatible
- [ ] No console.log spam in production
- [ ] No security issues introduced
- [ ] Performance impact minimal
- [ ] User documentation updated

### Deployment

1. Test locally with chrome://extensions
2. Version bump in manifest.json
3. Create release notes
4. Submit to Chrome Web Store (if public)

---

## Useful Resources

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome APIs Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

---

## Support

For development questions, refer to official Chrome documentation or open an issue.

**Happy Coding! 🚀**
