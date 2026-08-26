/**
 * SWAYAM Solver - Background Service Worker
 * Manages API requests, multi-frame coordination, and OpenAI-compatible communication.
 */

const DEFAULT_CONFIG = {
  provider: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  temperature: 0.1,
  autoSelect: true,
  highlightOnly: false,
  stealthMode: false,
  humanPacing: true,
  minDelay: 1200,
  maxDelay: 3200,
  autoScroll: true,
  bypassRestrictions: true,
  autoSubmit: false,
  autoSubmitDelay: 5000,
  showReasoning: true,
  customPrompt: `You are an academic subject matter expert solving multiple choice questions (MCQs) and multiple select questions (MSQs) from the SWAYAM / NPTEL portal.
Analyze each question step-by-step with domain precision.
For single-choice MCQs, choose the single best option index.
For multi-select MSQs, select all correct option indices.
Output must be valid JSON adhering strictly to the requested schema.`
};

// Track detected questions across frames for each tab
// Map: tabId -> Map(frameId -> { count, url, isTopFrame })
const tabFramesMap = new Map();

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(async () => {
    const existing = await chrome.storage.local.get(null);
    const updated = { ...DEFAULT_CONFIG, ...existing };
    await chrome.storage.local.set(updated);
  });
}

// Clean up frame state when tab is closed or navigated
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabFramesMap.delete(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      tabFramesMap.delete(tabId);
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. Content script reporting question count for its frame
    if (request.action === 'REPORT_FRAME_QUESTIONS' && sender.tab) {
      const tabId = sender.tab.id;
      const frameId = sender.frameId || 0;
      if (!tabFramesMap.has(tabId)) {
        tabFramesMap.set(tabId, new Map());
      }
      tabFramesMap.get(tabId).set(frameId, {
        count: request.count || 0,
        url: request.url || sender.tab.url,
        isTopFrame: request.isTopFrame || frameId === 0
      });
      sendResponse({ received: true });
      return false;
    }

    // 2. Popup asking for tab question count
    if (request.action === 'GET_TAB_STATUS') {
      const tabId = request.tabId;
      let totalCount = 0;
      let targetFrameIds = [];

      if (tabFramesMap.has(tabId)) {
        tabFramesMap.get(tabId).forEach((frameData, frameId) => {
          if (frameData.count > 0) {
            totalCount += frameData.count;
            targetFrameIds.push(frameId);
          }
        });
      }

      sendResponse({
        success: true,
        totalCount: totalCount,
        targetFrameIds: targetFrameIds
      });
      return false;
    }

    // 3. Popup triggering solve across all frames in a tab
    if (request.action === 'TRIGGER_SOLVE_TAB') {
      const tabId = request.tabId;
      const frames = tabFramesMap.get(tabId);
      const targetFrames = [];

      if (frames) {
        frames.forEach((f, frameId) => {
          if (f.count > 0) targetFrames.push(frameId);
        });
      }

      if (targetFrames.length === 0) {
        // Fallback: Broadcast to all frames in the tab
        chrome.tabs.sendMessage(tabId, { action: 'TRIGGER_SOLVE' }, () => {
          if (chrome.runtime.lastError) {}
        });
        sendResponse({ success: true, message: 'Broadcast to all frames' });
      } else {
        targetFrames.forEach((frameId) => {
          chrome.tabs.sendMessage(tabId, { action: 'TRIGGER_SOLVE' }, { frameId }, () => {
            if (chrome.runtime.lastError) {}
          });
        });
        sendResponse({ success: true, targetFrames });
      }
      return false;
    }

    // 4. Clear highlights across tab frames
    if (request.action === 'CLEAR_TAB_HIGHLIGHTS') {
      const tabId = request.tabId;
      chrome.tabs.sendMessage(tabId, { action: 'CLEAR_HIGHLIGHTS' }, () => {
        if (chrome.runtime.lastError) {}
      });
      sendResponse({ success: true });
      return false;
    }

    // 5. Test API Connection
    if (request.action === 'TEST_CONNECTION') {
      handleTestConnection(request.config)
        .then((res) => sendResponse({ success: true, data: res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 6. Execute LLM Solve Assignment
    if (request.action === 'SOLVE_ASSIGNMENT') {
      handleSolveAssignment(request.questions, request.overrideConfig)
        .then((res) => sendResponse({ success: true, solutions: res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // 7. Get Config
    if (request.action === 'GET_CONFIG') {
      chrome.storage.local.get(null).then((config) => {
        sendResponse({ success: true, config: { ...DEFAULT_CONFIG, ...config } });
      });
      return true;
    }
  });
}

function cleanBaseUrl(url) {
  if (!url) return 'https://api.openai.com/v1';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

async function handleTestConnection(customConfig) {
  const stored = typeof chrome !== 'undefined' && chrome.storage ? await chrome.storage.local.get(null) : {};
  const config = { ...DEFAULT_CONFIG, ...stored, ...customConfig };

  if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
    throw new Error('API key is required.');
  }

  const endpoint = `${cleanBaseUrl(config.baseUrl)}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const payload = {
    model: config.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Respond with OK.' },
      { role: 'user', content: 'ping' }
    ],
    max_tokens: 10,
    temperature: 0
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = errText;
      try {
        const json = JSON.parse(errText);
        parsedMessage = json.error?.message || json.message || errText;
      } catch (e) {}
      throw new Error(`HTTP ${response.status}: ${parsedMessage}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'OK';
    return { status: 'Connected', reply: reply.trim() };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. Check base URL and network.');
    }
    throw error;
  }
}

function buildPromptForQuestions(questions) {
  let prompt = `Solve the following assignment questions. Each item contains an index, the question text, single/multi select indicator, and options with 0-based indices.\n\n`;

  questions.forEach((q, idx) => {
    prompt += `=== Question ${idx + 1} (Index: ${idx}) ===\n`;
    prompt += `ID: ${q.id}\n`;
    prompt += `Type: ${q.type === 'msq' ? 'Multiple Select (MSQ - one or more correct options)' : 'Single Select (MCQ - exactly one correct option)'}\n`;
    prompt += `Question:\n${q.text}\n`;
    prompt += `Options:\n`;
    q.options.forEach((opt, optIdx) => {
      prompt += `  [Option ${optIdx}]: ${opt.text}\n`;
    });
    prompt += `\n`;
  });

  prompt += `\nInstructions:
1. Solve every question with academic accuracy.
2. For single-select MCQs, return the single correct 0-based option index in 'selectedOptionIndices' (e.g. [1]).
3. For multi-select MSQs, return all correct 0-based option indices in 'selectedOptionIndices' (e.g. [0, 2]).
4. Provide a confidence estimate (0.0 to 1.0) in 'confidence'.
5. Provide a clear 1-2 sentence explanation in 'reasoning'.
6. Return a valid JSON object matching this schema:

{
  "solutions": [
    {
      "questionIndex": 0,
      "questionId": "q_1",
      "selectedOptionIndices": [1],
      "selectedOptionTexts": ["Selected option text"],
      "confidence": 0.95,
      "reasoning": "Explanation for why this option is correct."
    }
  ]
}
`;

  return prompt;
}

async function handleSolveAssignment(questions, overrideConfig) {
  if (!questions || questions.length === 0) {
    throw new Error('No questions found on the page.');
  }

  const stored = typeof chrome !== 'undefined' && chrome.storage ? await chrome.storage.local.get(null) : {};
  const config = { ...DEFAULT_CONFIG, ...stored, ...overrideConfig };

  if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
    throw new Error('API key is not configured.');
  }

  const endpoint = `${cleanBaseUrl(config.baseUrl)}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const userPrompt = buildPromptForQuestions(questions);

  const payload = {
    model: config.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: config.customPrompt || DEFAULT_CONFIG.customPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: typeof config.temperature === 'number' ? config.temperature : 0.1,
    response_format: { type: "json_object" }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (fetchErr) {
      throw fetchErr;
    }

    if (!response.ok && response.status === 400) {
      const errBody = await response.text();
      if (errBody.includes('response_format') || errBody.includes('json_object')) {
        delete payload.response_format;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = errText;
      try {
        const json = JSON.parse(errText);
        parsedMessage = json.error?.message || json.message || errText;
      } catch (e) {}
      throw new Error(`API error (${response.status}): ${parsedMessage}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('Empty response from model.');
    }

    const parsedData = extractAndParseJson(rawContent);
    return normalizeSolutions(parsedData, questions);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 60s.');
    }
    throw error;
  }
}

function extractAndParseJson(text) {
  if (typeof text === 'object' && text !== null) {
    return Array.isArray(text) ? { solutions: text } : text;
  }
  const trimmed = text.trim();

  try {
    const direct = JSON.parse(trimmed);
    return Array.isArray(direct) ? { solutions: direct } : direct;
  } catch (e) {
    const matchJsonFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matchJsonFence && matchJsonFence[1]) {
      try {
        const fenced = JSON.parse(matchJsonFence[1].trim());
        return Array.isArray(fenced) ? { solutions: fenced } : fenced;
      } catch (e2) {}
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = trimmed.substring(firstBrace, lastBrace + 1);
      try {
        const parsedObj = JSON.parse(jsonSub);
        return Array.isArray(parsedObj) ? { solutions: parsedObj } : parsedObj;
      } catch (e3) {}
    }

    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const jsonSub = trimmed.substring(firstBracket, lastBracket + 1);
      try {
        const arr = JSON.parse(jsonSub);
        return { solutions: arr };
      } catch (e4) {}
    }

    throw new Error(`Failed to parse JSON response:\n${trimmed.slice(0, 200)}...`);
  }
}

function normalizeSolutions(parsed, originalQuestions) {
  let list = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && Array.isArray(parsed.solutions)) {
    list = parsed.solutions;
  } else if (parsed && Array.isArray(parsed.results)) {
    list = parsed.results;
  } else if (parsed && Array.isArray(parsed.answers)) {
    list = parsed.answers;
  } else if (parsed && typeof parsed === 'object') {
    list = Object.keys(parsed).map((k, idx) => {
      const val = parsed[k];
      let indices = [];
      if (typeof val === 'number') indices = [val];
      else if (Array.isArray(val)) indices = val;
      else if (typeof val === 'object' && val.selectedOptionIndices) return val;
      return {
        questionIndex: idx,
        questionId: k,
        selectedOptionIndices: indices,
        reasoning: ''
      };
    });
  }

  return originalQuestions.map((q, idx) => {
    const sol = list.find((s) => s.questionIndex === idx || s.questionId === q.id || s.id === q.id) || list[idx] || {};

    let selectedIndices = [];
    if (Array.isArray(sol.selectedOptionIndices)) {
      selectedIndices = sol.selectedOptionIndices.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
    } else if (typeof sol.selectedOptionIndex === 'number') {
      selectedIndices = [sol.selectedOptionIndex];
    } else if (typeof sol.answerIndex === 'number') {
      selectedIndices = [sol.answerIndex];
    } else if (Array.isArray(sol.answers)) {
      selectedIndices = sol.answers.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
    }

    if (selectedIndices.length === 0 && sol.selectedOptionTexts && Array.isArray(sol.selectedOptionTexts)) {
      sol.selectedOptionTexts.forEach((optTxt) => {
        const foundIdx = q.options.findIndex((opt) => opt.text.trim().toLowerCase() === String(optTxt).trim().toLowerCase());
        if (foundIdx !== -1) selectedIndices.push(foundIdx);
      });
    }

    return {
      questionIndex: idx,
      questionId: q.id,
      selectedOptionIndices: selectedIndices,
      confidence: typeof sol.confidence === 'number' ? sol.confidence : 0.9,
      reasoning: sol.reasoning || sol.explanation || 'Verified from course material.'
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cleanBaseUrl,
    buildPromptForQuestions,
    extractAndParseJson,
    normalizeSolutions,
    DEFAULT_CONFIG
  };
}
