/**
 * SWAYAM Solver - Popup Controller with Live .env Loading
 */

document.addEventListener('DOMContentLoaded', async () => {
  const PRESETS = {
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      keyPlaceholder: 'gsk_...',
      keyHelp: 'API key from console.groq.com'
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      keyPlaceholder: 'sk-proj-...',
      keyHelp: 'API key from platform.openai.com'
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      keyPlaceholder: 'sk-or-v1-...',
      keyHelp: 'API key from openrouter.ai'
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      keyPlaceholder: 'sk-...',
      keyHelp: 'API key from platform.deepseek.com'
    },
    ollama: {
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1:latest',
      keyPlaceholder: 'Local endpoint (no key required)',
      keyHelp: 'Requires local Ollama instance with OLLAMA_ORIGINS="*"'
    },
    custom: {
      baseUrl: '',
      model: '',
      keyPlaceholder: 'API key',
      keyHelp: 'Enter OpenAI-compatible endpoint credentials'
    }
  };

  // Helper to parse .env file content
  function parseEnvString(text) {
    const env = {};
    if (!text) return env;
    text.split(/\r?\n/).forEach(line => {
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

  // Load .env dynamically at runtime
  async function loadEnvAtRuntime() {
    let parsedEnv = {};
    try {
      const res = await fetch(chrome.runtime.getURL('.env'));
      if (res.ok) {
        const text = await res.text();
        parsedEnv = parseEnvString(text);
      }
    } catch (e) {}

    const staticEnv = (typeof ENV_CONFIG !== 'undefined' ? ENV_CONFIG : (typeof self !== 'undefined' && self.ENV_CONFIG ? self.ENV_CONFIG : {}));

    return {
      provider: parsedEnv.SWAYAM_PROVIDER || staticEnv.provider || 'groq',
      baseUrl: parsedEnv.SWAYAM_BASE_URL || staticEnv.baseUrl || 'https://api.groq.com/openai/v1',
      apiKey: parsedEnv.SWAYAM_API_KEY || staticEnv.apiKey || '',
      model: parsedEnv.SWAYAM_MODEL || staticEnv.model || 'llama-3.3-70b-versatile',
      temperature: parsedEnv.SWAYAM_TEMPERATURE ? parseFloat(parsedEnv.SWAYAM_TEMPERATURE) : (staticEnv.temperature || 0.1),
      humanPacing: parsedEnv.SWAYAM_HUMAN_PACING !== undefined ? parsedEnv.SWAYAM_HUMAN_PACING === 'true' : (staticEnv.humanPacing !== false),
      stealthMode: parsedEnv.SWAYAM_STEALTH_MODE !== undefined ? parsedEnv.SWAYAM_STEALTH_MODE === 'true' : (staticEnv.stealthMode === true),
      autoScroll: parsedEnv.SWAYAM_AUTO_SCROLL !== undefined ? parsedEnv.SWAYAM_AUTO_SCROLL === 'true' : (staticEnv.autoScroll !== false),
      bypassRestrictions: parsedEnv.SWAYAM_BYPASS_RESTRICTIONS !== undefined ? parsedEnv.SWAYAM_BYPASS_RESTRICTIONS === 'true' : (staticEnv.bypassRestrictions !== false),
      autoSelect: parsedEnv.SWAYAM_AUTO_SELECT !== undefined ? parsedEnv.SWAYAM_AUTO_SELECT === 'true' : (staticEnv.autoSelect !== false),
      highlightOnly: parsedEnv.SWAYAM_HIGHLIGHT_ONLY !== undefined ? parsedEnv.SWAYAM_HIGHLIGHT_ONLY === 'true' : (staticEnv.highlightOnly === true),
      showReasoning: parsedEnv.SWAYAM_SHOW_REASONING !== undefined ? parsedEnv.SWAYAM_SHOW_REASONING === 'true' : (staticEnv.showReasoning !== false),
      autoSubmit: parsedEnv.SWAYAM_AUTO_SUBMIT !== undefined ? parsedEnv.SWAYAM_AUTO_SUBMIT === 'true' : (staticEnv.autoSubmit === true),
      autoSubmitDelay: parsedEnv.SWAYAM_AUTO_SUBMIT_DELAY ? parseInt(parsedEnv.SWAYAM_AUTO_SUBMIT_DELAY, 10) : (staticEnv.autoSubmitDelay || 5000)
    };
  }

  // Elements
  const providerSelect = document.getElementById('provider-select');
  const baseUrlInput = document.getElementById('base-url');
  const apiKeyInput = document.getElementById('api-key');
  const toggleKeyBtn = document.getElementById('toggle-key-visibility');
  const keyHelpText = document.getElementById('key-help');
  const modelNameInput = document.getElementById('model-name');
  const testConnBtn = document.getElementById('test-connection-btn');
  const testResultBadge = document.getElementById('test-result-badge');

  // Stealth & Safety Toggles
  const humanPacingToggle = document.getElementById('human-pacing-toggle');
  const stealthModeToggle = document.getElementById('stealth-mode-toggle');
  const autoScrollToggle = document.getElementById('auto-scroll-toggle');
  const bypassRestrictionsToggle = document.getElementById('bypass-restrictions-toggle');

  // Automation Toggles
  const autoSelectToggle = document.getElementById('auto-select-toggle');
  const highlightOnlyToggle = document.getElementById('highlight-only-toggle');
  const showReasoningToggle = document.getElementById('show-reasoning-toggle');
  const autoSubmitToggle = document.getElementById('auto-submit-toggle');
  const submitDelayGroup = document.getElementById('submit-delay-group');
  const submitDelayInput = document.getElementById('submit-delay');
  const customPromptInput = document.getElementById('custom-prompt');

  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const saveStatusText = document.getElementById('save-status-text');

  const solveNowBtn = document.getElementById('solve-now-btn');
  const clearPageBtn = document.getElementById('clear-page-btn');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // Load environment and storage
  const envDefaults = await loadEnvAtRuntime();
  const stored = await chrome.storage.local.get(null);

  // Priority: if stored has explicit user value, use it; otherwise fallback to .env
  const provider = stored.provider || envDefaults.provider || 'groq';
  const baseUrl = stored.baseUrl || envDefaults.baseUrl || PRESETS[provider]?.baseUrl || '';
  const apiKey = stored.apiKey || envDefaults.apiKey || '';
  const model = stored.model || envDefaults.model || PRESETS[provider]?.model || '';

  providerSelect.value = provider;
  baseUrlInput.value = baseUrl;
  apiKeyInput.value = apiKey;
  modelNameInput.value = model;

  if (envDefaults.apiKey && apiKey === envDefaults.apiKey) {
    keyHelpText.textContent = 'Loaded from local .env configuration';
  }

  humanPacingToggle.checked = stored.humanPacing !== undefined ? stored.humanPacing : envDefaults.humanPacing;
  stealthModeToggle.checked = stored.stealthMode !== undefined ? stored.stealthMode : envDefaults.stealthMode;
  autoScrollToggle.checked = stored.autoScroll !== undefined ? stored.autoScroll : envDefaults.autoScroll;
  bypassRestrictionsToggle.checked = stored.bypassRestrictions !== undefined ? stored.bypassRestrictions : envDefaults.bypassRestrictions;

  autoSelectToggle.checked = stored.autoSelect !== undefined ? stored.autoSelect : envDefaults.autoSelect;
  highlightOnlyToggle.checked = stored.highlightOnly !== undefined ? stored.highlightOnly : envDefaults.highlightOnly;
  showReasoningToggle.checked = stored.showReasoning !== undefined ? stored.showReasoning : envDefaults.showReasoning;
  autoSubmitToggle.checked = stored.autoSubmit !== undefined ? stored.autoSubmit : envDefaults.autoSubmit;
  submitDelayInput.value = Math.round((stored.autoSubmitDelay || envDefaults.autoSubmitDelay || 5000) / 1000);
  if (stored.customPrompt) customPromptInput.value = stored.customPrompt;

  submitDelayGroup.style.display = autoSubmitToggle.checked ? 'flex' : 'none';

  // Automatically persist resolved settings to storage
  if (!stored.apiKey && envDefaults.apiKey) {
    await chrome.storage.local.set({
      provider,
      baseUrl,
      apiKey,
      model
    });
  }

  // Preset switch
  providerSelect.addEventListener('change', () => {
    const selected = providerSelect.value;
    const preset = PRESETS[selected];
    if (preset && selected !== 'custom') {
      baseUrlInput.value = preset.baseUrl;
      modelNameInput.value = preset.model;
      apiKeyInput.placeholder = preset.keyPlaceholder;
      keyHelpText.textContent = preset.keyHelp;
    }
  });

  // Key visibility toggle
  toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyBtn.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyBtn.textContent = 'Show';
    }
  });

  autoSubmitToggle.addEventListener('change', () => {
    submitDelayGroup.style.display = autoSubmitToggle.checked ? 'flex' : 'none';
  });

  highlightOnlyToggle.addEventListener('change', () => {
    if (highlightOnlyToggle.checked) autoSelectToggle.checked = false;
  });
  autoSelectToggle.addEventListener('change', () => {
    if (autoSelectToggle.checked) highlightOnlyToggle.checked = false;
  });

  // Save settings
  async function saveSettings(showFeedback = true) {
    const newSettings = {
      provider: providerSelect.value,
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelNameInput.value.trim(),
      humanPacing: humanPacingToggle.checked,
      stealthMode: stealthModeToggle.checked,
      autoScroll: autoScrollToggle.checked,
      bypassRestrictions: bypassRestrictionsToggle.checked,
      autoSelect: autoSelectToggle.checked,
      highlightOnly: highlightOnlyToggle.checked,
      showReasoning: showReasoningToggle.checked,
      autoSubmit: autoSubmitToggle.checked,
      autoSubmitDelay: (parseInt(submitDelayInput.value, 10) || 5) * 1000,
      customPrompt: customPromptInput.value.trim()
    };

    await chrome.storage.local.set(newSettings);

    if (showFeedback) {
      saveStatusText.textContent = 'Configuration saved';
      setTimeout(() => {
        saveStatusText.textContent = '';
      }, 2000);
    }
  }

  saveSettingsBtn.addEventListener('click', () => saveSettings(true));

  // Connection test
  testConnBtn.addEventListener('click', async () => {
    testResultBadge.className = 'badge loading';
    testResultBadge.textContent = 'Testing...';

    const testPayload = {
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelNameInput.value.trim()
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TEST_CONNECTION',
        config: testPayload
      });

      if (response && response.success) {
        testResultBadge.className = 'badge success';
        testResultBadge.textContent = 'Connected';
      } else {
        testResultBadge.className = 'badge error';
        testResultBadge.textContent = 'Failed';
        alert(`Connection error:\n${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      testResultBadge.className = 'badge error';
      testResultBadge.textContent = 'Failed';
      alert(`Connection error:\n${err.message}`);
    }
  });

  // Multi-frame active tab check
  async function checkActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        statusText.textContent = 'No active tab';
        return;
      }

      chrome.runtime.sendMessage({ action: 'GET_TAB_STATUS', tabId: tab.id }, (bgRes) => {
        if (bgRes && bgRes.success && bgRes.totalCount > 0) {
          statusDot.className = 'status-dot active';
          statusText.textContent = `${bgRes.totalCount} questions found`;
          solveNowBtn.disabled = false;
        } else {
          chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_STATUS' }, (res) => {
            if (chrome.runtime.lastError || !res) {
              statusDot.className = 'status-dot';
              statusText.textContent = 'Open an assignment page';
              solveNowBtn.disabled = false;
            } else if (res.success && res.questionCount > 0) {
              statusDot.className = 'status-dot active';
              statusText.textContent = `${res.questionCount} questions found`;
              solveNowBtn.disabled = false;
            } else {
              statusDot.className = 'status-dot warning';
              statusText.textContent = 'Scanning for questions...';
            }
          });
        }
      });
    } catch (e) {
      console.warn('Tab check failed:', e);
    }
  }

  checkActiveTab();

  // Solve button
  solveNowBtn.addEventListener('click', async () => {
    await saveSettings(false);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    solveNowBtn.disabled = true;
    solveNowBtn.textContent = 'Solving...';

    chrome.runtime.sendMessage({ action: 'TRIGGER_SOLVE_TAB', tabId: tab.id }, () => {
      setTimeout(() => {
        solveNowBtn.disabled = false;
        solveNowBtn.textContent = 'Solve Current Assignment';
      }, 1500);
    });
  });

  // Clear button
  clearPageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.runtime.sendMessage({ action: 'CLEAR_TAB_HIGHLIGHTS', tabId: tab.id });
    }
  });
});
