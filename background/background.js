/**
 * SWAYAMSolver - Background Service Worker
 * Handles OpenAI-compatible API calls, connectivity testing, and LLM communication.
 */

// Default configuration constants
const DEFAULT_CONFIG = {
  provider: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  temperature: 0.1,
  autoSelect: true,
  highlightOnly: false,
  autoSubmit: false,
  autoSubmitDelay: 3000,
  showReasoning: true,
  customPrompt: `You are an elite academic professor and subject-matter expert solving multiple-choice questions (MCQs) and multiple-select questions (MSQs) from the SWAYAM / NPTEL platform.
Analyze each question with extreme academic precision, step-by-step logic, and domain expertise.
For MCQs, pick the SINGLE best/correct option index.
For MSQs (marked as multi-select), pick ALL valid option indices.
Output MUST be strict JSON in the specified schema without any markdown wrapping or additional commentary outside the JSON.`
};

// Initialize default settings on extension installation
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    const existing = await chrome.storage.local.get(null);
    const updated = { ...DEFAULT_CONFIG, ...existing };
    await chrome.storage.local.set(updated);
    console.log('[SWAYAMSolver] Initialized with config:', updated);
  });
}

// Listener for messages from popup or content script
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TEST_CONNECTION') {
      handleTestConnection(request.config)
        .then((res) => sendResponse({ success: true, data: res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    }

    if (request.action === 'SOLVE_ASSIGNMENT') {
      handleSolveAssignment(request.questions, request.overrideConfig)
        .then((res) => sendResponse({ success: true, solutions: res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    }

    if (request.action === 'GET_CONFIG') {
      chrome.storage.local.get(null).then((config) => {
        sendResponse({ success: true, config: { ...DEFAULT_CONFIG, ...config } });
      });
      return true;
    }
  });
}

/**
 * Normalizes user-supplied base URL
 */
function cleanBaseUrl(url) {
  if (!url) return 'https://api.openai.com/v1';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

/**
 * Tests API connection by requesting a fast completion
 */
async function handleTestConnection(customConfig) {
  const stored = typeof chrome !== 'undefined' && chrome.storage ? await chrome.storage.local.get(null) : {};
  const config = { ...DEFAULT_CONFIG, ...stored, ...customConfig };

  if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
    throw new Error('API Key is required for remote providers.');
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
      { role: 'system', content: 'You are a test ping agent. Answer in one word.' },
      { role: 'user', content: 'Ping! Reply with "PONG".' }
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
      } catch (e) {
        // use raw text
      }
      throw new Error(`HTTP ${response.status}: ${parsedMessage}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'OK';
    return { status: 'Connected successfully', reply: reply.trim() };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out (15s). Check your Base URL or network connection.');
    }
    throw error;
  }
}

/**
 * Builds user prompt containing all scraped questions
 */
function buildPromptForQuestions(questions) {
  let prompt = `Here are the assignment questions to solve. Each question has an index, question text, whether it is single-choice (MCQ) or multiple-choice (MSQ), and an array of options with their 0-based indices.\n\n`;

  questions.forEach((q, idx) => {
    prompt += `=== QUESTION ${idx + 1} (Index: ${idx}) ===\n`;
    prompt += `ID: ${q.id}\n`;
    prompt += `Type: ${q.type === 'msq' ? 'MULTIPLE SELECT (MSQ - one or more correct options)' : 'SINGLE SELECT (MCQ - exactly one correct option)'}\n`;
    prompt += `Question Text:\n${q.text}\n`;
    prompt += `Options:\n`;
    q.options.forEach((opt, optIdx) => {
      prompt += `  [Option ${optIdx}]: ${opt.text}\n`;
    });
    prompt += `\n`;
  });

  prompt += `\nINSTRUCTIONS:
1. Carefully solve every question.
2. For single-choice MCQs, provide the single best 0-based option index in 'selectedOptionIndices' (e.g. [2]).
3. For multiple-choice MSQs, provide all correct 0-based option indices in 'selectedOptionIndices' (e.g. [0, 2]).
4. Provide a confidence score between 0.0 and 1.0.
5. Provide a short 1-2 sentence academic explanation in 'reasoning'.
6. Return a valid JSON object matching this EXACT JSON schema:

{
  "solutions": [
    {
      "questionIndex": 0,
      "questionId": "q_1",
      "selectedOptionIndices": [1],
      "selectedOptionTexts": ["Text of selected option"],
      "confidence": 0.95,
      "reasoning": "Brief explanation why this option is correct."
    }
  ]
}
`;

  return prompt;
}

/**
 * Sends questions to LLM and parses JSON response
 */
async function handleSolveAssignment(questions, overrideConfig) {
  if (!questions || questions.length === 0) {
    throw new Error('No questions found on the current page.');
  }

  const stored = typeof chrome !== 'undefined' && chrome.storage ? await chrome.storage.local.get(null) : {};
  const config = { ...DEFAULT_CONFIG, ...stored, ...overrideConfig };

  if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
    throw new Error('API Key is missing. Please configure it in the extension popup.');
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
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for large quizzes

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

    // Some models/providers reject response_format: { type: "json_object" }
    if (!response.ok && response.status === 400) {
      const errBody = await response.text();
      if (errBody.includes('response_format') || errBody.includes('json_object')) {
        console.warn('[SWAYAMSolver] Provider rejected json_object response_format, retrying without it...');
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
      } catch (e) {
        // use raw text
      }
      throw new Error(`LLM API Error (${response.status}): ${parsedMessage}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('LLM returned an empty response.');
    }

    // Parse JSON from content
    const parsedData = extractAndParseJson(rawContent);
    const solutions = normalizeSolutions(parsedData, questions);

    return solutions;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LLM request timed out after 60 seconds.');
    }
    console.error('[SWAYAMSolver] Error in handleSolveAssignment:', error);
    throw error;
  }
}

/**
 * Extracts and parses JSON from LLM output string
 */
function extractAndParseJson(text) {
  if (typeof text === 'object' && text !== null) {
    return Array.isArray(text) ? { solutions: text } : text;
  }
  const trimmed = text.trim();

  // Try direct parse
  try {
    const direct = JSON.parse(trimmed);
    return Array.isArray(direct) ? { solutions: direct } : direct;
  } catch (e) {
    // Markdown code fence extraction
    const matchJsonFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matchJsonFence && matchJsonFence[1]) {
      try {
        const fenced = JSON.parse(matchJsonFence[1].trim());
        return Array.isArray(fenced) ? { solutions: fenced } : fenced;
      } catch (e2) {}
    }

    // First { to last }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = trimmed.substring(firstBrace, lastBrace + 1);
      try {
        const parsedObj = JSON.parse(jsonSub);
        return Array.isArray(parsedObj) ? { solutions: parsedObj } : parsedObj;
      } catch (e3) {}
    }

    // First [ to last ]
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const jsonSub = trimmed.substring(firstBracket, lastBracket + 1);
      try {
        const arr = JSON.parse(jsonSub);
        return { solutions: arr };
      } catch (e4) {}
    }

    throw new Error(`Failed to parse structured JSON from LLM response:\n${trimmed.slice(0, 300)}...`);
  }
}

/**
 * Normalizes and validates solutions array to ensure matching with DOM questions
 */
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
      reasoning: sol.reasoning || sol.explanation || 'Solution determined by AI.'
    };
  });
}

// Export for unit tests if running in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cleanBaseUrl,
    buildPromptForQuestions,
    extractAndParseJson,
    normalizeSolutions,
    DEFAULT_CONFIG
  };
}
