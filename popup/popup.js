/**
 * SWAYAMSolver - Popup Logic & Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Provider Presets
  const PRESETS = {
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      keyPlaceholder: 'gsk_...',
      keyHelp: 'Free high-speed tier available at console.groq.com'
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      keyPlaceholder: 'sk-proj-...',
      keyHelp: 'OpenAI API key from platform.openai.com'
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      keyPlaceholder: 'sk-or-v1-...',
      keyHelp: 'OpenRouter API key from openrouter.ai'
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      keyPlaceholder: 'sk-...',
      keyHelp: 'DeepSeek API key from platform.deepseek.com'
    },
    ollama: {
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1:latest',
      keyPlaceholder: 'No key needed for local Ollama',
      keyHelp: 'Make sure Ollama is running locally with OLLAMA_ORIGINS="*"'
    },
    custom: {
      baseUrl: '',
      model: '',
      keyPlaceholder: 'API Key',
      keyHelp: 'Enter your custom OpenAI-compatible credentials'
    }
  };

  // DOM Elements
  const providerSelect = document.getElementById('provider-select');
  const baseUrlInput = document.getElementById('base-url');
  const apiKeyInput = document.getElementById('api-key');
  const toggleKeyBtn = document.getElementById('toggle-key-visibility');
  const keyHelpText = document.getElementById('key-help');
  const modelNameInput = document.getElementById('model-name');
  const testConnBtn = document.getElementById('test-connection-btn');
  const testResultBadge = document.getElementById('test-result-badge');

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

  // 1. Load Saved Settings
  const config = await chrome.storage.local.get(null);
  if (config.provider) providerSelect.value = config.provider;
  baseUrlInput.value = config.baseUrl || PRESETS.groq.baseUrl;
  apiKeyInput.value = config.apiKey || '';
  modelNameInput.value = config.model || PRESETS.groq.model;

  autoSelectToggle.checked = config.autoSelect !== false;
  highlightOnlyToggle.checked = config.highlightOnly === true;
  showReasoningToggle.checked = config.showReasoning !== false;
  autoSubmitToggle.checked = config.autoSubmit === true;
  submitDelayInput.value = Math.round((config.autoSubmitDelay || 3000) / 1000);
  if (config.customPrompt) customPromptInput.value = config.customPrompt;

  submitDelayGroup.style.display = autoSubmitToggle.checked ? 'flex' : 'none';

  // 2. Provider Preset Switcher
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

  // 3. Toggle Key Visibility
  toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyBtn.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyBtn.textContent = '👁';
    }
  });

  // 4. Auto-submit delay field toggle
  autoSubmitToggle.addEventListener('change', () => {
    submitDelayGroup.style.display = autoSubmitToggle.checked ? 'flex' : 'none';
  });

  // 5. Highlight-only vs Auto-select mutual handling
  highlightOnlyToggle.addEventListener('change', () => {
    if (highlightOnlyToggle.checked) {
      autoSelectToggle.checked = false;
    }
  });
  autoSelectToggle.addEventListener('change', () => {
    if (autoSelectToggle.checked) {
      highlightOnlyToggle.checked = false;
    }
  });

  // 6. Save Settings Function
  async function saveSettings(showNotification = true) {
    const newSettings = {
      provider: providerSelect.value,
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelNameInput.value.trim(),
      autoSelect: autoSelectToggle.checked,
      highlightOnly: highlightOnlyToggle.checked,
      showReasoning: showReasoningToggle.checked,
      autoSubmit: autoSubmitToggle.checked,
      autoSubmitDelay: (parseInt(submitDelayInput.value, 10) || 3) * 1000,
      customPrompt: customPromptInput.value.trim()
    };

    await chrome.storage.local.set(newSettings);

    if (showNotification) {
      saveStatusText.textContent = '✓ Settings saved successfully!';
      setTimeout(() => {
        saveStatusText.textContent = '';
      }, 2500);
    }
  }

  saveSettingsBtn.addEventListener('click', () => saveSettings(true));

  // 7. Test Connection
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
        testResultBadge.textContent = '✓ Connected';
      } else {
        testResultBadge.className = 'badge error';
        testResultBadge.textContent = '✕ Error';
        alert(`Connection Failed:\n${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      testResultBadge.className = 'badge error';
      testResultBadge.textContent = '✕ Error';
      alert(`Connection Error:\n${err.message}`);
    }
  });

  // 8. Active Tab Check & Status Update
  async function checkActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        statusText.textContent = 'No active tab';
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          statusDot.className = 'dot';
          statusText.textContent = 'Open an assignment page';
          solveNowBtn.disabled = false; // still allow user to attempt
        } else if (res.success && res.questionCount > 0) {
          statusDot.className = 'dot active';
          statusText.textContent = `Ready (${res.questionCount} questions detected)`;
          solveNowBtn.disabled = false;
        } else {
          statusDot.className = 'dot warning';
          statusText.textContent = 'No questions detected on this page';
        }
      });
    } catch (e) {
      console.warn('[SWAYAMSolver] Tab check failed:', e);
    }
  }

  checkActiveTab();

  // 9. Trigger Solve from Popup
  solveNowBtn.addEventListener('click', async () => {
    await saveSettings(false);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    solveNowBtn.disabled = true;
    solveNowBtn.textContent = 'Solving...';

    chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_SOLVE' }, (res) => {
      solveNowBtn.disabled = false;
      solveNowBtn.innerHTML = '<span class="btn-icon">⚡</span> Solve Assignment';
      if (chrome.runtime.lastError) {
        alert('Could not trigger solver. Please refresh the Swayam assignment tab and try again.');
      }
    });
  });

  // 10. Clear Page Highlights
  clearPageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_HIGHLIGHTS' });
    }
  });
});
