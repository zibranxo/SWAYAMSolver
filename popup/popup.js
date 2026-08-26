/**
 * SWAYAM Solver - Popup Controller with Multi-Frame Support
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

  // Load existing settings
  const config = await chrome.storage.local.get(null);
  if (config.provider) providerSelect.value = config.provider;
  baseUrlInput.value = config.baseUrl || PRESETS.groq.baseUrl;
  apiKeyInput.value = config.apiKey || '';
  modelNameInput.value = config.model || PRESETS.groq.model;

  humanPacingToggle.checked = config.humanPacing !== false;
  stealthModeToggle.checked = config.stealthMode === true;
  autoScrollToggle.checked = config.autoScroll !== false;
  bypassRestrictionsToggle.checked = config.bypassRestrictions !== false;

  autoSelectToggle.checked = config.autoSelect !== false;
  highlightOnlyToggle.checked = config.highlightOnly === true;
  showReasoningToggle.checked = config.showReasoning !== false;
  autoSubmitToggle.checked = config.autoSubmit === true;
  submitDelayInput.value = Math.round((config.autoSubmitDelay || 5000) / 1000);
  if (config.customPrompt) customPromptInput.value = config.customPrompt;

  submitDelayGroup.style.display = autoSubmitToggle.checked ? 'flex' : 'none';

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

      // First query background coordinator for aggregated frame counts
      chrome.runtime.sendMessage({ action: 'GET_TAB_STATUS', tabId: tab.id }, (bgRes) => {
        if (bgRes && bgRes.success && bgRes.totalCount > 0) {
          statusDot.className = 'status-dot active';
          statusText.textContent = `${bgRes.totalCount} questions found`;
          solveNowBtn.disabled = false;
        } else {
          // Direct fallback check
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

  // Solve button (routed through background coordinator for multi-frame support)
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
