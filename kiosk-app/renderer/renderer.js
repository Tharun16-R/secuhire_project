// Simple launcher page to navigate the kiosk window to a given URL.
// Note: In production, you should set START_URL via env and skip this UI.

(function () {
  const field = document.getElementById('url');
  const btn = document.getElementById('launch');

  btn?.addEventListener('click', () => {
    const urlRaw = (field?.value || '').trim();
    const url = urlRaw || (process.env.KIOSK_START_URL || process.env.SECUHIRE_START_URL || 'http://localhost:3000');
    // Navigate same window (main) to URL - relay through hash so main process can read? Not needed; we loaded START_URL initially.
    // If we are currently in renderer page, just set window.location.
    window.location.href = url;
  });
})();
