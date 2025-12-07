/**
 * YouTube Clipper Content Script
 * Injects a "Clip" button into the YouTube player
 */
(function () {
  const BUTTON_ID = 'youtube-clipper-button';
  const TOAST_ID = 'youtube-clipper-toast';

  // Find YouTube player controls
  function getVideoControls() {
    return (
      document.querySelector('.ytp-right-controls') ||
      document.querySelector('#top-level-buttons-computed') ||
      document.querySelector('#info-contents')
    );
  }

  // Create the Clip button
  function createButton() {
    if (document.getElementById(BUTTON_ID)) return null;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.title = 'Send to YouTube Clipper in Obsidian (Ctrl+Shift+Y)';
    btn.textContent = '✂ Clip';
    btn.style.cssText = `
      margin-left: 8px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #7c3aed, #5b21b6);
      color: white;
      border-radius: 4px;
      border: none;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `.replace(/\s+/g, ' ');

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    });
    btn.addEventListener('click', onClick);
    
    return btn;
  }

  // Show toast notification
  function showToast(text, isError = false) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      el.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 80px;
        background: ${isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(124, 58, 237, 0.95)'};
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        z-index: 999999;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: opacity 0.3s ease;
      `.replace(/\s+/g, ' ');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }

  // Send URL to Obsidian
  async function sendToObsidian(url) {
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      showToast('✓ URL copied, opening Obsidian...');
    } catch (e) {
      console.warn('Clipper: clipboard write failed', e);
    }

    // Open Obsidian protocol
    try {
      const params = new URLSearchParams({ url });
      window.open('obsidian://youtube-clipper?' + params.toString());
    } catch (e) {
      showToast('✗ Failed to open Obsidian', true);
      console.error('Clipper: failed to open obsidian', e);
    }
  }

  // Handle button click
  function onClick() {
    sendToObsidian(location.href);
  }

  // Listen for keyboard shortcut from background
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg?.type === 'send-current-video') {
      sendToObsidian(location.href);
    }
  });

  // Watch for YouTube SPA navigation and add button when player appears
  const observer = new MutationObserver(() => {
    const controls = getVideoControls();
    if (controls && !document.getElementById(BUTTON_ID)) {
      const btn = createButton();
      if (btn) controls.appendChild(btn);
    }
  });

  // Initialize
  function start() {
    const controls = getVideoControls();
    if (controls && !document.getElementById(BUTTON_ID)) {
      const btn = createButton();
      if (btn) controls.appendChild(btn);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Wait for page to load
  if (document.readyState === 'complete') {
    setTimeout(start, 500);
  } else {
    window.addEventListener('load', () => setTimeout(start, 500));
  }
})();
