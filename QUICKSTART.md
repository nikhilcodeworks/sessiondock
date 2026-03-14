# SessionDock Quick Start Guide

Get SessionDock running in 5 minutes!

## 🎯 In 30 Seconds

```
1. Download extension folder
2. Open chrome://extensions
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select extension folder
✅ Done!
```

---

## 📥 Step-by-Step Installation

### **Step 1: Locate Your Extension Folder**

The extension files should be at:
```
C:\Users\nikhi\Desktop\SessionDock\extension\
```

Verify these files exist:
- ✅ manifest.json
- ✅ background.js
- ✅ content.js
- ✅ popup.html
- ✅ popup.js
- ✅ styles.css

### **Step 2: Open Chrome Extensions Management**

**Option A**: Use Menu
1. Click the ⋮ menu (top right)
2. Select **More tools**
3. Click **Extensions**

**Option B**: Direct URL
1. Type `chrome://extensions` in address bar
2. Press Enter

### **Step 3: Enable Developer Mode**

1. Look for **"Developer mode"** toggle (top right of page)
2. Click to turn **ON** (should be blue/enabled)

```
Developer mode: [ON] ←  You should see this
```

### **Step 4: Load the Extension**

1. Click **"Load unpacked"** button (top left)
2. Navigate to: `C:\Users\nikhi\Desktop\SessionDock\extension\`
3. Click **Open** (or **Select Folder** on Mac/Linux)

### **Step 5: Verify Installation**

You should see SessionDock listed with:
- ✅ ID: `(unique-id)`
- ✅ "Enabled" status visible
- ✅ A purple extension icon in toolbar

---

## 🚀 Using SessionDock

### **First Time Setup**

1. **Click the SessionDock icon** in your toolbar
   
2. **Click "New Session"** button

3. **Enter session name**: 
   ```
   Example: "Personal LinkedIn"
   ```

4. **Leave domain empty** (or enter `linkedin.com`)

5. **Click "Create Session"**

✅ Your first session is created!

### **Logging Into LinkedIn Twice**

#### Create Two Sessions

```
Session 1: "Personal LinkedIn"
Session 2: "Work LinkedIn"
```

#### Open First Account

1. Click **SessionDock** icon
2. Find "Personal LinkedIn" session
3. Click **"Open"** (📂 button)
4. In new tab, go to linkedin.com
5. **Login with your personal account**
6. ✅ You're now logged in as personal account

#### Open Second Account

1. Click **SessionDock** icon (you're back at popup)
2. Find "Work LinkedIn" session
3. Click **"Open"** (📂 button)
4. In new tab, go to linkedin.com
5. **Login with your work account**
6. ✅ You're now logged in as work account

#### Switch Between Accounts

- Click Tab 1 → See personal LinkedIn
- Click Tab 2 → See work LinkedIn
- Switch back and forth seamlessly!

🎉 **Success! You have two LinkedIn accounts open simultaneously!**

---

## 🛠️ Troubleshooting Quick Fixes

### "I don't see the extension icon"

**Fix:**
1. Go to `chrome://extensions`
2. Find SessionDock
3. Click the **pin icon** next to it (top right of card)
4. Icon should now appear in toolbar

### "Load unpacked button is missing"

**Fix:**
1. Look top-right of Extensions page
2. Toggle "Developer mode" – it's ON/OFF
3. Make sure it's **ON** (blue/enabled)
4. "Load unpacked" button will appear

### "Sessions disappear when I restart browser"

**This is normal!** Sessions are stored locally. They persist unless:
- You clear browser data
- You uninstall the extension
- You delete sessions manually

To keep sessions safe: **Export them!**
1. Click SessionDock → **Export** button
2. Save the .json file somewhere safe

### "I can't log into two accounts"

**Make sure you:**
- ✅ Use the **"Open"** button in SessionDock (not just Ctrl+T)
- ✅ Each account is in its own tab
- ✅ Waited for page to fully load before logging in

---

## 💡 Pro Tips

### **Organizing Multiple Accounts**

Create sessions like this:
```
Personal Accounts
├─ LinkedIn - Personal
├─ Gmail - Personal  
├─ Facebook - Personal

Work Accounts
├─ LinkedIn - Work
├─ Gmail - Work
├─ Slack - Work

Testing
├─ Test Account 1
├─ Test Account 2
```

### **Backup Your Sessions**

1. Click SessionDock → **Export**
2. Save file to your computer
3. Store it somewhere safe
4. If anything goes wrong, click **Import** to restore

### **Use Target Domain (Optional)**

When creating a session, you can specify a domain:
```
Session name: "Personal LinkedIn"
Target domain: "linkedin.com"
```

This restricts the session to only that domain (optional feature).

### **Edit Session Names Anytime**

1. Find session card
2. Click **Edit** (✎ button)
3. Change the name
4. Click **"Save Changes"**

---

## 🔍 How It Works (Simple Explanation)

**Without SessionDock:**
```
Browser Cookie Store (Shared by all tabs)
  linkedin.com: user1_cookie
  → All tabs see logged in as user1
  → Can't have user2 logged in
```

**With SessionDock:**
```
Tab 1 (Session A)          Tab 2 (Session B)
linkedin.com: user1_cookie linkedin.com: user2_cookie
  → Sees user1             → Sees user2
  → Can switch freely!
```

Each tab has its own session with isolated cookies!

---

## 📊 Feature Overview

| Feature | Status | How to Use |
|---------|--------|-----------|
| Create Session | ✅ Ready | Click "New Session" |
| Edit Session | ✅ Ready | Click "Edit" on session card |
| Delete Session | ✅ Ready | Click "Delete" on session card |
| Open in Tab | ✅ Ready | Click "Open" on session card |
| Export Sessions | ✅ Ready | Click "Export" button |
| Import Sessions | ✅ Ready | Click "Import" button |
| Session Colors | ✅ Ready | Auto-assigned (visual) |
| Domain Targeting | ✅ Ready | Optional in creation dialog |

---

## 🎓 Common Use Cases

### **Multiple Social Media Accounts**

```
Session 1: "Facebook - Personal"
Session 2: "Facebook - Business"
Session 3: "Instagram - Personal"
Session 4: "Instagram - Business"

→ Switch between all easily!
```

### **Work & Personal Email**

```
Session 1: "Gmail - Personal"
Session 2: "Gmail - Work"
Session 3: "Outlook - Work"

→ No more logging in and out!
```

### **Development & Testing**

```
Session 1: "Dev Account 1"
Session 2: "Dev Account 2"
Session 3: "QA Tester 1"
Session 4: "QA Tester 2"

→ Test with different users simultaneously!
```

### **Account Testing**

```
Session 1: "Free Tier"
Session 2: "Premium Tier"
Session 3: "Admin Account"

→ Compare features across account types!
```

---

## ⚡ Keyboard Shortcuts

Currently, SessionDock uses click-based navigation. In future versions:
- `Ctrl+Shift+S` - Open SessionDock
- `Ctrl+Shift+N` - New Session

For now, use the mouse or tab to navigate the UI.

---

## 📞 Getting Help

**Extension not loading?**
- Check that file folder path is correct
- Ensure all files are present (manifest.json, etc.)
- Try reloading: `chrome://extensions` → Find SessionDock → Click reload icon

**Unsure about a feature?**
- Click the **"? Help"** link in SessionDock popup
- Read [README.md](./README.md) for detailed documentation
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details

**Want to customize it?**
- See [DEVELOPMENT.md](./DEVELOPMENT.md) for code changes
- Modify colors, sizes, or features as needed

---

## 🎯 Next Steps

1. ✅ **Install Extension** (steps above)
2. ✅ **Create Your First Session** (2 minutes)
3. ✅ **Log Into Two Accounts** (5 minutes)
4. ✅ **Export Sessions as Backup** (1 minute)
5. ✅ **Create More Sessions as Needed**

---

## 💬 Quick FAQ

**Q: Is it safe?**
A: Yes! SessionDock stores data locally on your computer. No cloud upload, no tracking.

**Q: Does it work on all websites?**
A: Works on most sites. Some sites with custom storage may have issues.

**Q: Can I delete a session?**
A: Yes, click "Delete" on session card. You'll be asked to confirm.

**Q: What if I close a browser tab?**
A: Session remains saved. Just click "Open" again to create a new tab for it.

**Q: How many sessions can I create?**
A: Theoretically 50-100+, but practically limited by storage (10MB).

**Q: Does it work incognito mode?**
A: Extension doesn't load in Incognito by default. Use regular windows instead.

**Q: Can I export and share sessions?**
A: Yes! Export creates a .json file. You can share it, but others can modify it before importing.

---

## 🎉 You're Ready!

You now have everything you need to manage multiple accounts seamlessly.

**Enjoy SessionDock!** 🚀

---

### Version History

| Version | Features | Date |
|---------|----------|------|
| 1.0.0 | Initial Release | 2024-01-12 |

### Support & Feedback

For issues or feature requests, refer to the main documentation or contact support.

**Built with ❤️ for multi-account management**
