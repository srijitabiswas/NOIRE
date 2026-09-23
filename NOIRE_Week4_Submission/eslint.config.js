const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } },
    rules: { 'no-var': 'error', 'prefer-const': 'error', eqeqeq: 'error' }
  }
];
