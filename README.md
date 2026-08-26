# SWAYAMSolver - AI-Powered NPTEL & SWAYAM Auto-Solver ⚡

**SWAYAMSolver** is a Chromium browser extension (Manifest V3) designed to automatically extract multiple-choice (MCQ) and multiple-select (MSQ) questions from SWAYAM / NPTEL assignment pages, query an OpenAI-compatible Large Language Model (LLM) API, and automatically select the most accurate answers directly on the webpage with real-time visual feedback and confidence badges.

---

## 🌟 Key Features

- 🧠 **Bring Your Own LLM (OpenAI-Compatible)**: Seamlessly connect with **Groq (Free & Ultra Fast)**, **OpenAI (GPT-4o, GPT-4o-mini)**, **OpenRouter**, **DeepSeek**, or **Local Ollama** (`localhost:11434`).
- ⚡ **Zero-CSP-Block Architecture**: Uses a Manifest V3 background service worker proxy for network requests, completely bypassing host webpage Content Security Policies (CSP) and CORS restrictions.
- 🎯 **Universal DOM Scraper**: Accurately extracts questions, options, LaTeX/MathJax expressions, and distinguishes Single-Choice (Radio) from Multi-Select (Checkbox) across Google Course Builder (GCB), Swayam 2.0, Canvas, and Angular/React portals.
- 🖱️ **Authentic Event Simulation**: Programmatically clicks radio/checkbox options with simulated `pointerdown`, `mousedown`, `mouseup`, `click`, `input`, and `change` events so modern reactive LMS frameworks update their internal state.
- 💡 **AI Rationale & Confidence Badges**: Displays confidence percentages (`⚡ AI: 98%`) and hoverable explanation tooltips directly on the webpage for each question.
- 🚀 **In-Page Floating Widget**: A sleek, non-intrusive floating action button (`⚡ Solve with AI`) on assignment pages with live progress status and a one-click solve trigger.
- ⚙️ **Configurable Preferences**:
  - Auto-select vs Highlight-only mode.
  - Show/hide AI reasoning tooltips.
  - Optional automated submission with customizable delay timer.
  - Customizable system prompt and temperature.

---

## 🛠️ Installation Guide

1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/your-username/SWAYAMSolver.git
   ```
2. Open any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Arc, etc.).
3. Navigate to `chrome://extensions/` in the address bar.
4. Enable **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** and select the `SWAYAMSolver` project folder.
6. The extension is now installed and ready!

---

## 🔑 LLM Provider Setup & Recommended Configurations

Click on the SWAYAMSolver extension icon in your browser toolbar to open the settings popup and select your preferred provider:

### 1. Groq (Recommended - Free Tier & Ultra Fast ⚡)
- **Provider**: `Groq`
- **Base URL**: `https://api.groq.com/openai/v1`
- **Model**: `llama-3.3-70b-versatile`
- **API Key**: Get a free API key at [console.groq.com](https://console.groq.com)

### 2. OpenAI
- **Provider**: `OpenAI`
- **Base URL**: `https://api.openai.com/v1`
- **Model**: `gpt-4o-mini` or `gpt-4o`
- **API Key**: Your `sk-proj-...` key from [platform.openai.com](https://platform.openai.com)

### 3. OpenRouter
- **Provider**: `OpenRouter`
- **Base URL**: `https://openrouter.ai/api/v1`
- **Model**: `meta-llama/llama-3.3-70b-instruct:free` or `anthropic/claude-3.5-sonnet`
- **API Key**: Get a key from [openrouter.ai](https://openrouter.ai)

### 4. DeepSeek
- **Provider**: `DeepSeek`
- **Base URL**: `https://api.deepseek.com/v1`
- **Model**: `deepseek-chat` or `deepseek-reasoner`
- **API Key**: Get a key from [platform.deepseek.com](https://platform.deepseek.com)

### 5. Local Ollama (100% Offline & Private)
- Run Ollama locally with CORS allowed:
  ```bash
  OLLAMA_ORIGINS="*" ollama run llama3.1
  ```
- **Provider**: `Local Ollama`
- **Base URL**: `http://localhost:11434/v1`
- **Model**: `llama3.1:latest`
- **API Key**: *Not required*

After configuring your credentials, click **"Test Connection"** to verify that your endpoint and API key are working.

---

## 🚀 How to Use

1. Open your **SWAYAM / NPTEL** course and navigate to any graded assessment or assignment page.
2. You will see a floating **"⚡ Solve with AI"** button at the bottom-right corner of the page (or you can click **"Solve Assignment"** from the extension popup).
3. Click the button. SWAYAMSolver will:
   - Extract all questions and answer options from the DOM.
   - Send the parsed assignment to your configured LLM via the background service worker.
   - Receive the structured JSON response.
   - Automatically check the radio/checkbox options on the webpage and highlight them in green.
   - Attach confidence percentage badges with hoverable step-by-step reasoning next to each question.
   - (Optional) Automatically submit the assignment after the configured delay if enabled in settings.

---

## 🧪 Local Verification / Test Page

A built-in test page is included to test the extension without requiring an active NPTEL session:
1. In Chrome, press `Ctrl+O` (or `Cmd+O`) and open `test/mock_assignment.html`.
2. Notice the floating **"⚡ Solve with AI"** button in the bottom right corner.
3. Ensure your API key is saved in the extension popup.
4. Click **"Solve with AI"** to see the scraper, LLM processing, option selection, and AI rationale tooltips in action!

---

## 📁 Repository Structure

```
SWAYAMSolver/
├── manifest.json                  # Manifest V3 configuration & permissions
├── icons/                         # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── background.js              # Background service worker (LLM API caller & message dispatcher)
├── content/
│   ├── content.js                 # Content script: Scraper, injector, SPA observer, UI widget
│   └── content.css                # In-page widget, highlights, and rationale tooltips styling
├── popup/
│   ├── popup.html                 # Settings & control center popup UI
│   ├── popup.js                   # Popup logic: presets, credentials, connection testing
│   └── popup.css                  # Modern dark-mode popup styling
├── test/
│   └── mock_assignment.html       # Local mock assignment test page
└── README.md                      # Documentation
```

---

## ⚖️ License
Distributed under the MIT License.
