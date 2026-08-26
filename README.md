# SWAYAM Solver

A browser extension that extracts questions from SWAYAM and NPTEL assignment pages, passes them to an OpenAI-compatible API endpoint, and selects the matching answers directly in the page.

---

## Features

- **OpenAI-compatible API support**: Works with Groq, OpenAI, OpenRouter, DeepSeek, and local Ollama instances.
- **Background API proxy**: All LLM requests are executed from the Manifest V3 background service worker. The host webpage never sees outgoing network requests to external AI APIs.
- **Closed Shadow DOM**: The in-page toolbar is mounted inside a closed Shadow Root (`mode: 'closed'`), preventing LMS scripts and anti-cheat observers from discovering extension DOM elements.
- **Human Pacing & Pointer Simulation**: Dispatches authentic pointer event sequences (`pointerdown`, `mousedown`, `focus`, `mouseup`, `click`, `change`) with randomized non-zero coordinate offsets and natural delays (1.2s - 3.2s) between questions.
- **Stealth Mode**: Optional mode that selects inputs directly without injecting any visual classes, outlines, or badges into the webpage DOM.
- **Anti-Detection Shield**: Neutralizes restrictive webpage handlers that attempt to block text selection, copy-paste, and right-click.
- **Dynamic DOM parser**: Handles multiple-choice (MCQ) and multiple-select (MSQ) questions across Google Course Builder, Swayam 2.0, and Canvas layouts while preserving LaTeX/MathJax formulas and code blocks.

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

### Safety & Anti-Detection Settings

- **Human Pacing**: Adds random 1.2s to 3.2s intervals per question to simulate natural reading and answering speed.
- **Stealth Mode**: When enabled, selects inputs silently without adding any badges or classes to the page DOM.
- **Auto-Scroll**: Smoothly scrolls each question into the center of the viewport as it is being solved.
- **Bypass Restrictions**: Prevents assignment scripts from blocking copy, paste, or right-clicking.

---

## Usage

1. Open any graded assignment or quiz on the SWAYAM / NPTEL portal.
2. Click **Solve** on the in-page toolbar or click **Solve Current Assignment** from the extension popup.
3. You can also use the keyboard shortcut `Alt+S` to trigger solving.
4. The extension extracts question text and options, queries your configured model, and selects the corresponding radio buttons or checkboxes.
5. In standard mode, hover over the `Answer` badge on any question to inspect the reasoning and confidence percentage.

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
│   └── background.js          # Background service worker (API proxy)
├── content/
│   ├── content.js             # Content script (Shadow DOM, human pacing, anti-detection)
│   └── content.css            # Stylesheet for fallback styles
├── popup/
│   ├── popup.html             # Extension settings modal
│   ├── popup.js               # Settings controller and connection test
│   └── popup.css              # Minimalist popup styling
├── test/
│   ├── mock_assignment.html   # Local test assignment page
│   ├── unit_tests.js          # Unit tests
│   └── dom_e2e_test.js        # DOM extraction integration tests
└── README.md                  # Documentation
```

---

## License

MIT
