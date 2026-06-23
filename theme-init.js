// Set the colour theme before first paint to avoid a flash. Kept as a separate
// blocking script (not inline) so it complies with the site's CSP.
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    /* localStorage unavailable — fall back to the default light theme */
  }
})();
