# SecuHire Test App (Electron Kiosk)

An Electron-based kiosk browser to run SecuHire interviews in a locked, fullscreen shell. This app provides stronger controls than a normal web browser: kiosk window, fullscreen, single-instance, always-on-top, blocked context-menu and common shortcuts, and restricted navigation to allowed origins.

> Note: To achieve true, OS-level kiosk (prevent Alt+Tab, task switching, etc.), configure Windows Kiosk policies (Assigned Access/Shell Launcher) to run this app as the system shell. See the Kiosk Guide below.

---

## Quick Start (Development)

1. Install Node.js (v18+ recommended).
2. In `kiosk-app/`:

```bash
npm install
npm run dev
```

This launches Electron loading your frontend at `http://localhost:3000` by default. Change the start URL with:

```bash
# Windows PowerShell
$env:KIOSK_START_URL = "http://localhost:3000"
$env:KIOSK_ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
npm run dev
```

Environment variables (all optional):
- `KIOSK_START_URL`: URL to load initially (e.g., your SecuHire frontend).
- `KIOSK_ALLOWED_ORIGINS`: Comma-separated list of origins allowed for in-app navigation.
- `KIOSK_MODE` (default: true): Set to `false` to disable Electron kiosk mode.
- `KIOSK_ALWAYS_ON_TOP` (default: true): Keep window always on top.
- `KIOSK_DISABLE_DEVTOOLS` (default: true): Disable DevTools in production.
- `KIOSK_QUIT_PASSWORD`: If set, unlock-and-quit shortcut becomes available with Ctrl+Alt+K (prompts password).

---

## Build Windows Installer

```bash
npm install
npm run build
```

This produces a Windows installer (NSIS) under `dist/`. Install it on the target machine.

---

## Security Features in this App

- Kiosk/fullscreen, always-on-top window.
- Disable app menus and context menus.
- Block common navigation/dev shortcuts (F11, F12, Escape, Ctrl+Shift+I/C/J, Ctrl+U/W/T/R/N/L, etc.).
- Single instance lock — prevents multiple instances.
- Navigation restricted to allowed origins; opens external links in system browser.
- Optional admin unlock password (Ctrl+Alt+K) to quit.

> Important: Electron cannot fully block OS-level shortcuts or task switching by itself. For a true lockdown you must use OS kiosk policies.

---

## Windows Kiosk Guide (Assigned Access / Shell Launcher)

There are two primary ways to configure a Windows device to run a single app in kiosk mode:

### 1) Assigned Access (Single-app kiosk)
- Designed for UWP (Store) apps. Traditional Win32 apps (like Electron) are not supported in single-app Assigned Access.
- If you need a single-app kiosk for a Win32 app, use Shell Launcher instead (see below).

Docs: https://learn.microsoft.com/windows/configuration/assigned-access/assigned-access

### 2) Shell Launcher v2 (Preferred for Win32/Electron)
- Available on Windows 10/11 Enterprise/Education.
- Replaces the Windows shell (Explorer) with your app executable. This provides a true kiosk experience (no Start menu, taskbar, etc.).
- You can configure a specific local user to run the kiosk shell, and assign Explorer shell for admin users.

Docs: https://learn.microsoft.com/windows/configuration/shell-launcher/shell-launcher

High-level steps:
1. Create a local kiosk user, e.g., `secuhire-kiosk`.
2. Install the SecuHire Test App for all users (the installer created by `npm run build`).
3. Enable Shell Launcher and configure it to start the app’s executable for the kiosk user.
4. Set an exit/unlock path (admin login, or configure a keyboard shortcut that launches Task Manager for admins only).

Example PowerShell (outline — adapt to your environment):
```powershell
# Requires Windows 10/11 Enterprise/Education and admin privileges
# 1) Create local user (if needed)
New-LocalUser -Name "secuhire-kiosk" -NoPassword
Add-LocalGroupMember -Group "Users" -Member "secuhire-kiosk"

# 2) Locate installed app executable (adjust path)
# Example: C:\\Program Files\\SecuHire Test App\\SecuHire Test App.exe
$exePath = "C:\\Program Files\\SecuHire Test App\\SecuHire Test App.exe"

# 3) Configure Shell Launcher via WMI Bridge Provider (see Microsoft docs for full script)
# The full setup uses a provisioning XML or advanced PowerShell; refer to the Shell Launcher docs:
# https://learn.microsoft.com/windows/configuration/shell-launcher/shell-launcher
```

> Shell Launcher setup is detailed and varies by Windows edition and policy management (local policy, Intune, GPO). Follow the Microsoft guide closely.

### Alternative (less secure): Auto-start at login
If Shell Launcher/Assigned Access aren’t available, you can configure the app to auto-start for a dedicated Windows user:
- Place a shortcut to the app in `shell:startup` (Startup folder).
- Use Group Policy to hide/control Task Manager, disable lock/switch user, hide power options.
- This is not as secure as Shell Launcher (users can still Alt+Tab, etc.).

---

## Integrating with SecuHire Backend/Frontend

- Set `KIOSK_START_URL` to your deployed frontend, e.g., `https://app.secuhire.com`.
- In the frontend, you may detect Electron (e.g., via `navigator.userAgent` or a small API exposed in `preload.js`) and:
  - Automatically enter the interview kiosk flow.
  - Skip prompts that only apply to web browsers.

---

## Troubleshooting

- Black screen or blank window:
  - Check `KIOSK_START_URL` is reachable on the device.
  - Verify network and TLS/SSL.
- Can still use Alt+Tab / taskbar:
  - Configure Windows Shell Launcher (or use a managed device) — Electron alone cannot block OS task switching.
- DevTools accessible:
  - Ensure `KIOSK_DISABLE_DEVTOOLS` is not set to `false`. In production, devtools are disabled by default.

---

## License
MIT
