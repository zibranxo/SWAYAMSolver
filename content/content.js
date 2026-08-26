/**
 * SWAYAM Solver - Content Script Engine
 */

(() => {
  if (typeof window === 'undefined') return;
  if (window.__swayamSolverInitialized) return;
  window.__swayamSolverInitialized = true;

  let isSolving = false;
  let lastEvaluatedUrl = window.location.href;

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

  async function applySolutions(parsedQuestions, solutions, config) {
    let appliedCount = 0;

    for (let idx = 0; idx < parsedQuestions.length; idx++) {
      const q = parsedQuestions[idx];
      const sol = solutions.find(s => s.questionIndex === idx || s.questionId === q.id) || solutions[idx];
      if (!sol || !sol.selectedOptionIndices || sol.selectedOptionIndices.length === 0) continue;

      const indicesToSelect = sol.selectedOptionIndices;

      q.options.forEach(opt => {
        const shouldSelect = indicesToSelect.includes(opt.index);
        const inputEl = opt.inputElement;

        if (opt.labelElement) {
          opt.labelElement.classList.remove('swayam-solved-option');
        }

        if (config.highlightOnly) {
          if (shouldSelect && opt.labelElement) {
            opt.labelElement.classList.add('swayam-solved-option');
          }
        } else {
          if (q.type === 'mcq') {
            if (shouldSelect) {
              selectInputElement(inputEl, opt.labelElement);
              if (opt.labelElement) opt.labelElement.classList.add('swayam-solved-option');
            }
          } else {
            if (shouldSelect && !inputEl.checked) {
              selectInputElement(inputEl, opt.labelElement);
            } else if (!shouldSelect && inputEl.checked) {
              selectInputElement(inputEl, opt.labelElement);
            }
            if (shouldSelect && opt.labelElement) {
              opt.labelElement.classList.add('swayam-solved-option');
            }
          }
        }
      });

      if (config.showReasoning !== false) {
        injectRationaleBadge(q.containerElement, sol);
      }

      appliedCount++;
      await new Promise(r => setTimeout(r, 40));
    }

    if (config.autoSubmit && !config.highlightOnly && appliedCount > 0) {
      showToast(`Auto-submitting in ${Math.round((config.autoSubmitDelay || 3000) / 1000)}s...`, 'success');
      setTimeout(() => {
        triggerAutoSubmit();
      }, config.autoSubmitDelay || 3000);
    }

    return appliedCount;
  }

  function selectInputElement(input, label) {
    if (!input) return;

    try {
      input.checked = true;

      const events = ['pointerdown', 'mousedown', 'mouseup', 'click', 'input', 'change'];
      events.forEach(evtName => {
        const evt = new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window });
        input.dispatchEvent(evt);
      });

      if (label && label !== input) {
        label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
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

  function initFloatingWidget() {
    if (document.getElementById('swayam-solver-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'swayam-solver-widget';

    try {
      const savedPos = JSON.parse(localStorage.getItem('swayam_solver_pos'));
      if (savedPos && savedPos.x && savedPos.y) {
        widget.style.left = `${savedPos.x}px`;
        widget.style.top = `${savedPos.y}px`;
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
      }
    } catch (e) {}

    widget.innerHTML = `
      <div id="swayam-toast" class="swayam-solver-toast"></div>
      <div class="swayam-solver-main-bar" id="swayam-main-bar">
        <div class="swayam-solver-drag-handle" id="swayam-drag-handle" title="Drag toolbar">::</div>
        <button id="swayam-solve-btn" class="swayam-solver-btn">
          <span id="swayam-btn-text">Solve</span>
        </button>
        <button id="swayam-clear-btn" class="swayam-solver-mini-btn" title="Clear highlights">
          Clear
        </button>
        <button id="swayam-minimize-btn" class="swayam-solver-mini-btn" title="Minimize toolbar">
          _
        </button>
      </div>
      <div class="swayam-solver-collapsed" id="swayam-collapsed-pill" style="display: none;" title="Open SWAYAM Solver">
        S
      </div>
    `;

    document.body.appendChild(widget);

    document.getElementById('swayam-solve-btn').addEventListener('click', solveCurrentAssignment);
    document.getElementById('swayam-clear-btn').addEventListener('click', clearAllHighlights);

    const mainBar = document.getElementById('swayam-main-bar');
    const collapsedPill = document.getElementById('swayam-collapsed-pill');
    const minimizeBtn = document.getElementById('swayam-minimize-btn');

    minimizeBtn.addEventListener('click', () => {
      mainBar.style.display = 'none';
      collapsedPill.style.display = 'flex';
    });

    collapsedPill.addEventListener('click', () => {
      collapsedPill.style.display = 'none';
      mainBar.style.display = 'flex';
    });

    makeDraggable(widget, document.getElementById('swayam-drag-handle'));
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
    const btn = document.getElementById('swayam-solve-btn');
    const text = document.getElementById('swayam-btn-text');
    if (!btn || !text) return;

    if (state === 'solving') {
      btn.disabled = true;
      text.innerHTML = '<span class="swayam-spinner"></span> Solving';
    } else {
      btn.disabled = false;
      text.textContent = 'Solve';
    }
  }

  function showToast(message, type = 'normal') {
    const toast = document.getElementById('swayam-toast');
    if (!toast) return;

    toast.className = `swayam-solver-toast visible ${type}`;
    toast.textContent = message;

    clearTimeout(toast.__timeout);
    toast.__timeout = setTimeout(() => {
      toast.className = 'swayam-solver-toast';
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
