// Light / dark mode switch. "auto" follows the device setting; an explicit
// choice is remembered in this browser.

const KEY = 'archeryPro.theme';
const ORDER = ['auto', 'light', 'dark'];
const LABELS = { auto: '🌗 Auto', light: '☀️ Light', dark: '🌙 Dark' };

function savedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return ORDER.includes(t) ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function applyTheme(theme, button) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  button.textContent = LABELS[theme];
  button.setAttribute('aria-label', `Theme: ${theme}. Tap to change.`);
  button.title = 'Switch between automatic, light and dark mode';
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1a19' : '#fcfcfb');
}

export function initTheme(button, onChange) {
  let theme = savedTheme();
  applyTheme(theme, button);
  button.addEventListener('click', () => {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    try {
      if (theme === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {}
    applyTheme(theme, button);
    onChange?.();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme(theme, button);
    onChange?.();
  });
}
