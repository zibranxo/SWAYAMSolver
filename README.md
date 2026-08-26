# SWAYAM Solver

A browser extension that extracts questions from SWAYAM and NPTEL assignment pages, passes them to an OpenAI-compatible API endpoint, and selects the matching answers directly in the page.

---

## Features

- **OpenAI-compatible API support**: Works with Groq, OpenAI, OpenRouter, DeepSeek, and local Ollama instances.
- **Background API proxy**: Requests are routed through the extension's Manifest V3 background service worker, avoiding webpage Content Security Policy (CSP) and CORS restrictions.
- **Dynamic DOM parser**: Handles multiple-choice (MCQ) and multiple-select (MSQ) questions across Google Course Builder, Swayam 2.0, and Canvas layouts while preserving LaTeX/MathJax formulas and code blocks.
- **Event dispatching**: Dispatches standard browser pointer and form events so reactive frameworks (React, Angular, Polymer) register selection changes correctly.
- **In-page controls**: A minimal draggable toolbar on assignment pages with options to solve, clear selections, or minimize.
- **Explanations and confidence ratings**: Injects subtle answer indicators and tooltips with confidence scores and reasoning.

---

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/zibranxo/SWAYAMSolver.git
   ```
2. Open your Chromium browser (Chrome, Brave, Edge, Arc) and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `SWAYAMSolver` folder.

---

## Configuration

Click the extension icon in your browser toolbar to open the settings popup and choose your provider:

| Provider | Base URL | Default Model | Notes |
| :--- | :--- | :--- | :--- |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Fast inference with a free tier at console.groq.com |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | Standard API key from platform.openai.com |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | Aggregator with free and paid models |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | Standard API key from platform.deepseek.com |
| **Local Ollama** | `http://localhost:11434/v1` | `llama3.1:latest` | Run locally with `OLLAMA_ORIGINS="*" ollama run llama3.1` |
| **Custom** | User defined | User defined | Any endpoint supporting `/v1/chat/completions` |

After configuring your credentials, click **Test Connection** to verify endpoint availability.

---

## Usage

1. Open any graded assignment or quiz on the SWAYAM / NPTEL portal.
2. Click **Solve** on the floating in-page toolbar or click **Solve Current Assignment** from the extension popup.
3. You can also use the keyboard shortcut `Alt+S` to trigger solving.
4. The extension extracts question text and options, queries your configured model, and selects the corresponding radio buttons or checkboxes.
5. Hover over the injected `Answer` badge on any question to inspect the reasoning and confidence percentage.

---

## Testing

A local test file and unit test suite are included:

```bash
# Run automated unit and DOM extraction tests
npm test

# Run syntax linting
npm run lint
```

To test in the browser, open `test/mock_assignment.html` directly in Chrome after installing the extension.

---

## Project Structure

```
SWAYAMSolver/
├── manifest.json              # Manifest V3 configuration
├── package.json               # Test scripts and metadata
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── background.js          # Background service worker (API caller)
├── content/
│   ├── content.js             # Content script (DOM scraper, injector, toolbar)
│   └── content.css            # Styles for in-page controls and tooltips
├── popup/
│   ├── popup.html             # Extension settings modal
│   ├── popup.js               # Settings controller and connection test
│   └── popup.css              # Popup styling
├── test/
│   ├── mock_assignment.html   # Local test assignment page
│   ├── unit_tests.js          # Unit tests
│   └── dom_e2e_test.js        # DOM extraction integration tests
└── README.md                  # Documentation
```

---

## License

MIT
