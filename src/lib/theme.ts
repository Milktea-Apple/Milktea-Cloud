export const THEME_STORAGE_KEY = "milktea-theme";

export const themeScript = `(function(){try{var key='${THEME_STORAGE_KEY}';var saved=localStorage.getItem(key);var theme=saved==='light'||saved==='dark'?saved:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){}})();`;
