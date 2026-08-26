/**
 * SWAYAM Solver - Content Script Engine with Anti-Detection Architecture
 */

(() => {
  if (typeof window === 'undefined') return;
  if (window.__swayamSolverInitialized) return;
  window.__swayamSolverInitialized = true;

  let isSolving = false;
  let lastEvaluatedUrl = window.location.href;
  let shadowRootRef = null;

  // --- 1. ANTI-DETECTION & RESTRICTIONS BYPASS ---
  function initAntiDetectionShield() {
    try {
      // Prevent websites from blocking copy, paste, select, and context menu
      const bypassEvents = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'];
      bypassEvents.forEach(evtName => {
        window.addEventListener(evtName, (e) => {
          e.stopPropagation();
        }, true);
      });

      // Prevent canvas / DOM tampering detection loops
      document.addEventListener('keydown', (e) => {
        // Protect developer shortcuts like F12 or Ctrl+Shift+I if blocked
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))) {
          e.stopPropagation();
        }
      }, true);
    } catch (e) {}
  }

  initAntiDetectionShield();

  // --- 2. STRING & DOM EXTRACTION ---
  function cleanText(str) {
    if (!str) return '';
    return str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s*(?:\([a-zA-Z0-9]+\)|\[[a-zA-Z0-9]+\]|[a-zA-Z0-9]+[.)])\s*/, '')
      .trim();
  }

  function extractRichText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);

    clone.querySelectorAll('button, input, select, textarea, .qt-choices, script, style, .swayam-ai-badge').forEach(el => el.remove());

    clone.querySelectorAll('script[type="math/tex"], annotation[encoding="application/x-tex"]').forEach(math => {
      const tex = math.textContent || '';
      const textNode = document.createTextNode(` \\( ${tex} \\) `);
      math.parentNode.replaceChild(textNode, math);
    });

    clone.querySelectorAll('img').forEach(img => {
      const alt = img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('src') || '';
      const textNode = document.createTextNode(alt ? ` [Image: ${alt}] ` : ' [Image] ');
      img.parentNode.replaceChild(textNode, img);
    });

    clone.querySelectorAll('pre, code').forEach(code => {
      const formatted = `\n\`\`\`\n${code.innerText || code.textContent}\n\`\`\`\n`;
      const textNode = document.createTextNode(formatted);
      code.parentNode.replaceChild(textNode, code);
    });

    return cleanText(clone.innerText || clone.textContent || '');
  }

  function extractQuestions() {
    const questions = [];

    let qContainers = Array.from(document.querySelectorAll(
      '.gcb-question, .qt-question, fieldset.gcb-question-fieldset, div[id^="qt-"], .assessment-question, .quiz-question-container, .qt-mc-question, .qt-sa-question'
    ));

    qContainers = qContainers.filter(container => {
      return !qContainers.some(other => other !== container && other.contains(container));
    });

    if (qContainers.length === 0) {
      const inputs = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      const groups = new Map();

      inputs.forEach(input => {
        const parent = input.closest('fieldset, .card, form, .form-group, div') || input.parentElement;
        if (!groups.has(parent)) {
          groups.set(parent, []);
        }
        groups.get(parent).push(input);
      });

      groups.forEach((inputList, container) => {
        if (inputList.length >= 2) {
          qContainers.push(container);
        }
      });
    }

    qContainers.forEach((container, index) => {
      const qId = container.id || container.getAttribute('name') || `q_${index + 1}`;
      const inputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
      if (inputs.length === 0) return;

      const isCheckbox = inputs.some(i => i.type === 'checkbox');
      const qType = isCheckbox ? 'msq' : 'mcq';

      const options = [];
      inputs.forEach((input, optIdx) => {
        let labelText = '';
        let labelEl = null;

        if (input.id) {
          labelEl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        }
        if (!labelEl) {
          labelEl = input.closest('label');
        }
        if (!labelEl && input.nextElementSibling && input.nextElementSibling.tagName === 'LABEL') {
          labelEl = input.nextElementSibling;
        }

        if (labelEl) {
          labelText = extractRichText(labelEl);
        } else if (input.parentElement) {
          labelText = extractRichText(input.parentElement);
        }

        options.push({
          index: optIdx,
          id: input.id || `opt_${index}_${optIdx}`,
          text: labelText || `Option ${optIdx + 1}`,
          inputElement: input,
          labelElement: labelEl || input.parentElement
        });
      });

      let qText = '';
      const bodyEl = container.querySelector('.qt-question-body, .qt-question-description, .question-text, .question-title, legend, .gcb-question-header');
      if (bodyEl) {
        qText = extractRichText(bodyEl);
      } else {
        qText = extractRichText(container);
      }

      if (!qText) {
        qText = `Question ${index + 1}`;
      }

      questions.push({
        index: index,
        id: qId,
        type: qType,
        text: qText,
        options: options,
        containerElement: container
      });
    });

    return questions;
  }

  // --- 3. HUMANIZED EXECUTION & SOLUTION INJECTION ---
  async function applySolutions(parsedQuestions, solutions, config) {
    let appliedCount = 0;
    const isStealth = config.stealthMode === true;
    const isHumanPaced = config.humanPacing !== false;

    for (let idx = 0; idx < parsedQuestions.length; idx++) {
      const q = parsedQuestions[idx];
      const sol = solutions.find(s => s.questionIndex === idx || s.questionId === q.id) || solutions[idx];
      if (!sol || !sol.selectedOptionIndices || sol.selectedOptionIndices.length === 0) continue;

      // Natural auto-scroll to current question
      if (config.autoScroll !== false && q.containerElement) {
        q.containerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const indicesToSelect = sol.selectedOptionIndices;

      q.options.forEach(opt => {
        const shouldSelect = indicesToSelect.includes(opt.index);
        const inputEl = opt.inputElement;

        // In non-stealth mode, clear previous highlight classes
        if (!isStealth && opt.labelElement) {
          opt.labelElement.classList.remove('swayam-solved-option');
        }

        if (config.highlightOnly) {
          if (shouldSelect && opt.labelElement && !isStealth) {
            opt.labelElement.classList.add('swayam-solved-option');
          }
        } else {
          if (q.type === 'mcq') {
            if (shouldSelect) {
              selectInputElementRealistic(inputEl, opt.labelElement);
              if (opt.labelElement && !isStealth) opt.labelElement.classList.add('swayam-solved-option');
            }
          } else {
            if (shouldSelect && !inputEl.checked) {
              selectInputElementRealistic(inputEl, opt.labelElement);
            } else if (!shouldSelect && inputEl.checked) {
              selectInputElementRealistic(inputEl, opt.labelElement);
            }
            if (shouldSelect && opt.labelElement && !isStealth) {
              opt.labelElement.classList.add('swayam-solved-option');
            }
          }
        }
      });

      // Inject badge only if not in stealth mode
      if (!isStealth && config.showReasoning !== false) {
        injectRationaleBadge(q.containerElement, sol);
      }

      appliedCount++;

      // Human-like reading & answering delay between questions
      if (isHumanPaced && idx < parsedQuestions.length - 1) {
        const minD = config.minDelay || 1200;
        const maxD = config.maxDelay || 3200;
        const delay = Math.floor(minD + Math.random() * (maxD - minD));
        showToast(`Solving question ${idx + 1} of ${parsedQuestions.length}...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        await new Promise(r => setTimeout(r, 60));
      }
    }

    // Optional Auto-Submit
    if (config.autoSubmit && !config.highlightOnly && appliedCount > 0) {
      const submitDelay = config.autoSubmitDelay || 5000;
      showToast(`Auto-submitting in ${Math.round(submitDelay / 1000)}s...`, 'success');
      setTimeout(() => {
        triggerAutoSubmit();
      }, submitDelay);
    }

    return appliedCount;
  }

  /**
   * Realistic pointer and input dispatching with natural coordinates
   */
  function selectInputElementRealistic(input, label) {
    if (!input) return;

    try {
      const target = label || input;
      const rect = target.getBoundingClientRect();

      // Compute randomized natural coordinates inside target element
      const clientX = Math.round(rect.left + rect.width * (0.25 + Math.random() * 0.5));
      const clientY = Math.round(rect.top + rect.height * (0.25 + Math.random() * 0.5));
      const screenX = window.screenX + clientX;
      const screenY = window.screenY + clientY;

      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        screenX: screenX,
        screenY: screenY,
        button: 0,
        buttons: 1
      };

      // Natural browser interaction sequence
      target.dispatchEvent(new PointerEvent('pointerover', eventInit));
      target.dispatchEvent(new PointerEvent('pointerenter', eventInit));
      target.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));

      if (typeof input.focus === 'function') {
        input.focus({ preventScroll: true });
      }

      input.checked = true;

      target.dispatchEvent(new PointerEvent('pointerup', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));
      target.dispatchEvent(new MouseEvent('click', eventInit));

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      input.checked = true;
    }
  }

  function injectRationaleBadge(container, solution) {
    const existing = container.querySelector('.swayam-ai-badge');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.className = 'swayam-ai-badge';
    const confidencePct = Math.round((solution.confidence || 0.95) * 100);
    badge.innerHTML = `
      Answer (${confidencePct}%)
      <div class="swayam-ai-tooltip">
        <div class="tooltip-title">
          <span>Explanation</span>
          <span class="tooltip-confidence">${confidencePct}% confidence</span>
        </div>
        ${solution.reasoning || 'Identified as the correct answer based on assessment analysis.'}
      </div>
    `;

    const targetHeader = container.querySelector('.qt-question-body, .question-text, .gcb-question-header, legend, h3, h4') || container.firstElementChild || container;
    targetHeader.appendChild(badge);
  }

  function triggerAutoSubmit() {
    const submitBtn = document.querySelector(
      'input[type="submit"], button.gcb-submit-button, input.gcb-submit-button, #gcb-submit-answers, button[type="submit"], .submit-assignment-button'
    );

    if (submitBtn) {
      submitBtn.click();
      showToast('Assignment submitted.', 'success');
    } else {
      showToast('Submit button not found. Please submit manually.', 'error');
    }
  }

  function clearAllHighlights() {
    document.querySelectorAll('.swayam-solved-option').forEach(el => el.classList.remove('swayam-solved-option'));
    document.querySelectorAll('.swayam-ai-badge').forEach(el => el.remove());
    showToast('Selections and highlights cleared.', 'success');
  }

  // --- 4. SOLVE TRIGGER ---
  async function solveCurrentAssignment() {
    if (isSolving) return;
    isSolving = true;
    updateWidgetState('solving');

    try {
      const questions = extractQuestions();
      if (questions.length === 0) {
        throw new Error('No questions found on the active page.');
      }

      showToast(`Found ${questions.length} questions. Requesting solutions...`);

      const payload = questions.map(q => ({
        index: q.index,
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options.map(o => ({ index: o.index, id: o.id, text: o.text }))
      }));

      const configRes = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      const config = configRes.config || {};

      const response = await chrome.runtime.sendMessage({
        action: 'SOLVE_ASSIGNMENT',
        questions: payload
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate solutions.');
      }

      const appliedCount = await applySolutions(questions, response.solutions, config);
      showToast(`Solved ${appliedCount} of ${questions.length} questions.`, 'success');
      updateWidgetState('idle');
    } catch (err) {
      showToast(err.message, 'error');
      updateWidgetState('idle');
    } finally {
      isSolving = false;
    }
  }

  // --- 5. ISOLATED CLOSED SHADOW DOM WIDGET ---
  function initFloatingWidget() {
    if (document.getElementById('swayam-solver-host')) return;

    const host = document.createElement('div');
    host.id = 'swayam-solver-host';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.right = '24px';
    host.style.zIndex = '2147483647';

    // Create closed shadow root to completely hide extension DOM from page scripts
    const shadow = host.attachShadow({ mode: 'closed' });
    shadowRootRef = shadow;

    // Restore position
    try {
      const savedPos = JSON.parse(localStorage.getItem('swayam_solver_pos'));
      if (savedPos && savedPos.x && savedPos.y) {
        host.style.left = `${savedPos.x}px`;
        host.style.top = `${savedPos.y}px`;
        host.style.bottom = 'auto';
        host.style.right = 'auto';
      }
    } catch (e) {}

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .wrapper {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        user-select: none;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 8px;
        padding: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      .handle {
        cursor: grab;
        color: #71717a;
        font-size: 11px;
        padding: 4px 6px;
        display: flex;
        align-items: center;
        letter-spacing: -1px;
      }
      .handle:active { cursor: grabbing; }
      .btn {
        background: #fafafa;
        color: #09090b;
        border: 1px solid #fafafa;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        outline: none;
        transition: background-color 0.15s ease;
      }
      .btn:hover { background: #e4e4e7; }
      .btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .mini-btn {
        background: transparent;
        color: #a1a1aa;
        border: none;
        padding: 6px 8px;
        font-size: 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .mini-btn:hover { color: #fafafa; background: #27272a; }
      .pill {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: #18181b;
        border: 1px solid #27272a;
        display: none;
        align-items: center;
        justify-content: center;
        color: #fafafa;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      .pill:hover { background: #27272a; }
      .toast {
        background: #18181b;
        color: #f4f4f5;
        border: 1px solid #27272a;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        max-width: 320px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        display: none;
      }
      .toast.visible { display: flex; align-items: center; }
      .toast.error { border-color: #ef4444; color: #fca5a5; }
      .toast.success { border-color: #10b981; color: #86efac; }
      .spinner {
        width: 11px;
        height: 11px;
        border: 2px solid rgba(0, 0, 0, 0.2);
        border-top-color: #09090b;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        display: inline-block;
        vertical-align: middle;
        margin-right: 4px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;

    const container = document.createElement('div');
    container.className = 'wrapper';
    container.innerHTML = `
      <div id="toast" class="toast"></div>
      <div class="toolbar" id="toolbar">
        <div class="handle" id="handle" title="Drag toolbar">::</div>
        <button id="solve-btn" class="btn">
          <span id="btn-text">Solve</span>
        </button>
        <button id="clear-btn" class="mini-btn" title="Clear highlights">Clear</button>
        <button id="min-btn" class="mini-btn" title="Minimize">_</button>
      </div>
      <div class="pill" id="pill" title="Open SWAYAM Solver">S</div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);
    document.body.appendChild(host);

    // Event listeners inside shadow root
    shadow.getElementById('solve-btn').addEventListener('click', solveCurrentAssignment);
    shadow.getElementById('clear-btn').addEventListener('click', clearAllHighlights);

    const toolbar = shadow.getElementById('toolbar');
    const pill = shadow.getElementById('pill');
    const minBtn = shadow.getElementById('min-btn');

    minBtn.addEventListener('click', () => {
      toolbar.style.display = 'none';
      pill.style.display = 'flex';
    });

    pill.addEventListener('click', () => {
      pill.style.display = 'none';
      toolbar.style.display = 'flex';
    });

    makeDraggable(host, shadow.getElementById('handle'));
  }

  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      const newTop = Math.max(10, Math.min(window.innerHeight - 60, element.offsetTop - pos2));
      const newLeft = Math.max(10, Math.min(window.innerWidth - 200, element.offsetLeft - pos1));

      element.style.top = `${newTop}px`;
      element.style.left = `${newLeft}px`;
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      try {
        localStorage.setItem('swayam_solver_pos', JSON.stringify({
          x: element.offsetLeft,
          y: element.offsetTop
        }));
      } catch (e) {}
    }
  }

  function updateWidgetState(state) {
    if (!shadowRootRef) return;
    const btn = shadowRootRef.getElementById('solve-btn');
    const text = shadowRootRef.getElementById('btn-text');
    if (!btn || !text) return;

    if (state === 'solving') {
      btn.disabled = true;
      text.innerHTML = '<span class="spinner"></span> Solving';
    } else {
      btn.disabled = false;
      text.textContent = 'Solve';
    }
  }

  function showToast(message, type = 'normal') {
    if (!shadowRootRef) return;
    const toast = shadowRootRef.getElementById('toast');
    if (!toast) return;

    toast.className = `toast visible ${type}`;
    toast.textContent = message;

    clearTimeout(toast.__timeout);
    toast.__timeout = setTimeout(() => {
      toast.className = 'toast';
    }, 4000);
  }

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      solveCurrentAssignment();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TRIGGER_SOLVE') {
      solveCurrentAssignment()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'CLEAR_HIGHLIGHTS') {
      clearAllHighlights();
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'GET_PAGE_STATUS') {
      const questions = extractQuestions();
      sendResponse({
        success: true,
        questionCount: questions.length,
        url: window.location.href
      });
      return true;
    }
  });

  function checkUrlChange() {
    if (window.location.href !== lastEvaluatedUrl) {
      lastEvaluatedUrl = window.location.href;
      clearAllHighlights();
    }
  }

  const originalPush = history.pushState;
  history.pushState = function(...args) {
    originalPush.apply(this, args);
    checkUrlChange();
  };

  const originalReplace = history.replaceState;
  history.replaceState = function(...args) {
    originalReplace.apply(this, args);
    checkUrlChange();
  };

  window.addEventListener('popstate', checkUrlChange);
  window.addEventListener('hashchange', checkUrlChange);
  setInterval(checkUrlChange, 1000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingWidget);
  } else {
    initFloatingWidget();
  }
})();
