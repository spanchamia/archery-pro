// Light / dark mode switch. Until the user picks one, the app follows the
// device setting; once they tap the switch, their choice is remembered in
// this browser.

const KEY = 'archeryPro.theme';
const media = matchMedia('(prefers-color-scheme: dark)');

let chosen = null;
try {
  const t = localStorage.getItem(KEY);
  if (t === 'light' || t === 'dark') chosen = t;
} catch {}

const currentTheme = () => chosen || (media.matches ? 'dark' : 'light');

function applyTheme(button) {
  const dark = currentTheme() === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  button.textContent = dark ? '🌙 Dark' : '☀️ Light';
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', 'Dark mode');
  button.title = `Switch to ${dark ? 'light' : 'dark'} mode`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1a19' : '#fcfcfb');
}

export function initTheme(button) {
  applyTheme(button);
  button.addEventListener('click', () => {
    chosen = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, chosen);
    } catch {}
    applyTheme(button);
  });
  media.addEventListener('change', () => applyTheme(button));
}
