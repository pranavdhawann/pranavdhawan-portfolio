// Tiny TOML readers shared by the Playwright specs and the header validator.
// Written as CommonJS with named exports so both `require` (specs) and ESM
// `import { ... }` (check-netlify-headers.mjs) can consume it.
function readTomlString(content, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^${escapedKey}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : undefined;
}

function parseCsp(policy) {
  return Object.fromEntries(
    policy.split(';').map((part) => {
      const [directive, ...values] = part.trim().split(/\s+/);
      return [directive, values];
    })
  );
}

module.exports = { readTomlString, parseCsp };
