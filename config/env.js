/**
 * SWAYAM Solver - Static Environment Config
 * Generated automatically from .env via `npm run sync-env`
 */

const ENV_DEFAULTS = {
  "provider": "custom",
  "baseUrl": "https://api.mistral.ai/v1",
  "apiKey": "w4Vj8uQzsx0nBTfyUFaW5EGc4uBMkEoR",
  "model": "mistral-medium-latest",
  "temperature": 0.1,
  "humanPacing": true,
  "stealthMode": true,
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
