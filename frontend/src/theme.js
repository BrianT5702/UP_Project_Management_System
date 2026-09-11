export const THEME_KEY = 'up-theme';

export const getStoredTheme = () =>
  (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY) === 'dark')
    ? 'dark'
    : 'light';

export const applyTheme = (theme) => {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}
  return next;
};

export const toggleThemeValue = (theme) => (theme === 'dark' ? 'light' : 'dark');

applyTheme(getStoredTheme());
