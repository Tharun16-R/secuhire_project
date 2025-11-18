const { contextBridge, ipcRenderer } = require('electron');

// Minimal hardening in renderer context
window.addEventListener('DOMContentLoaded', () => {
  // Disable context menu
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // Listen for password request and render a simple in-page modal prompt
  ipcRenderer.on('kiosk:request-password', () => {
    try {
      const existing = document.getElementById('secuhire-kiosk-password-modal');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'secuhire-kiosk-password-modal';
      backdrop.style.position = 'fixed';
      backdrop.style.inset = '0';
      backdrop.style.background = 'rgba(0,0,0,0.7)';
      backdrop.style.zIndex = '999999';

      const modal = document.createElement('div');
      modal.style.position = 'absolute';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.width = '360px';
      modal.style.background = '#fff';
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
      modal.style.padding = '20px';
      modal.innerHTML = `
        <h3 style="margin:0 0 10px;font-family:sans-serif;color:#111">Exit Kiosk</h3>
        <p style="margin:0 0 12px;font-family:sans-serif;color:#444;font-size:14px">Enter admin password to quit SecuHire Test App.</p>
        <input type="password" id="secuhire-kiosk-password-input" placeholder="Password" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button id="secuhire-kiosk-cancel" style="padding:8px 12px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer">Cancel</button>
          <button id="secuhire-kiosk-submit" style="padding:8px 12px;border:0;border-radius:8px;background:#6d28d9;color:#fff;cursor:pointer">Unlock & Quit</button>
        </div>
      `;

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      const input = modal.querySelector('#secuhire-kiosk-password-input');
      const cancel = modal.querySelector('#secuhire-kiosk-cancel');
      const submit = modal.querySelector('#secuhire-kiosk-submit');

      cancel.addEventListener('click', () => backdrop.remove());
      submit.addEventListener('click', () => {
        const pwd = input.value || '';
        ipcRenderer.send('kiosk:password-submit', pwd);
        // Keep modal until app exits or wrong password
        input.value = '';
      });

      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') submit.click();
      });

      setTimeout(() => input.focus(), 0);
    } catch (e) {
      // ignore errors
    }
  });

  // Notify the page that the app is about to quit so it can finalize
  ipcRenderer.on('kiosk:about-to-quit', () => {
    try {
      window.dispatchEvent(new CustomEvent('SecuHireKioskAboutToQuit'));
    } catch (e) {}
  });
});

// Expose a minimal API if needed in future
contextBridge.exposeInMainWorld('SecuHireKiosk', {
  requestQuit: () => ipcRenderer.send('kiosk:request-quit')
});
