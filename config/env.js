/**
 * SWAYAM Solver - Static Environment Config
 * Generated automatically from .env via `npm run sync-env`
 */

const ENV_DEFAULTS = {
  "provider": "groq",
  "baseUrl": "https://api.groq.com/openai/v1",
  "apiKey": "",
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.1,
  "humanPacing": true,
  "stealthMode": false,
  "autoScroll": true,
  "bypassRestrictions": true,
  "autoSelect": true,
  "highlightOnly": false,
  "showReasoning": true,
  "autoSubmit": false,
  "autoSubmitDelay": 5000
};

if (typeof self !== 'undefined') {
  self.ENV_CONFIG = ENV_DEFAULTS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ENV_DEFAULTS;
}
