/**
 * Helper script to parse .env and update config/env.js
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');
const outPath = path.join(__dirname, '..', 'config', 'env.js');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });

  return env;
}

const parsed = fs.existsSync(envPath) ? parseEnvFile(envPath) : parseEnvFile(examplePath);

function toBool(val, fallback) {
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return fallback;
}

function toNum(val, fallback) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

const config = {
  provider: parsed.SWAYAM_PROVIDER || 'groq',
  baseUrl: parsed.SWAYAM_BASE_URL || 'https://api.groq.com/openai/v1',
  apiKey: parsed.SWAYAM_API_KEY || '',
  model: parsed.SWAYAM_MODEL || 'llama-3.3-70b-versatile',
  temperature: toNum(parsed.SWAYAM_TEMPERATURE, 0.1),
  humanPacing: toBool(parsed.SWAYAM_HUMAN_PACING, true),
  stealthMode: toBool(parsed.SWAYAM_STEALTH_MODE, false),
  autoScroll: toBool(parsed.SWAYAM_AUTO_SCROLL, true),
  bypassRestrictions: toBool(parsed.SWAYAM_BYPASS_RESTRICTIONS, true),
  autoSelect: toBool(parsed.SWAYAM_AUTO_SELECT, true),
  highlightOnly: toBool(parsed.SWAYAM_HIGHLIGHT_ONLY, false),
  showReasoning: toBool(parsed.SWAYAM_SHOW_REASONING, true),
  autoSubmit: toBool(parsed.SWAYAM_AUTO_SUBMIT, false),
  autoSubmitDelay: toNum(parsed.SWAYAM_AUTO_SUBMIT_DELAY, 5000)
};

const output = `/**
 * SWAYAM Solver - Static Environment Config
 * Generated automatically from .env via \`npm run sync-env\`
 */

const ENV_DEFAULTS = ${JSON.stringify(config, null, 2)};

if (typeof self !== 'undefined') {
  self.ENV_CONFIG = ENV_DEFAULTS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ENV_DEFAULTS;
}
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output, 'utf8');
console.log('[sync-env] config/env.js updated from ' + (fs.existsSync(envPath) ? '.env' : '.env.example'));
