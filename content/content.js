/**
 * SWAYAM Solver - Universal DOM Scraper & Content Engine
 * Supports iframes, Shadow DOM piercing, Multimodal Vision Image Extraction,
 * Google Course Builder, Canvas, and Swayam 2.0 / NPTEL portals.
 */

(() => {
  if (typeof window === 'undefined') return;
  if (window.__swayamSolverInitialized) return;
  window.__swayamSolverInitialized = true;

  let isSolving = false;
  let lastEvaluatedUrl = window.location.href;
  let shadowRootRef = null;

  // --- 1. ANTI-DETECTION SHIELD ---
  function initAntiDetectionShield() {
    try {
      const bypassEvents = ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'];
      bypassEvents.forEach(evtName => {
        window.addEventListener(evtName, (e) => {
          e.stopPropagation();
        }, true);
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))) {
          e.stopPropagation();
        }
      }, true);
    } catch (e) {}
  }

  initAntiDetectionShield();

  // --- 2. DEEP DOM QUERY (SHADOW DOM PIERCING & SAME-ORIGIN IFRAMES) ---
  function deepQuerySelectorAll(selector, root = document) {
    let results = [];
    try {
      if (root.querySelectorAll) {
        results = Array.from(root.querySelectorAll(selector));
      }
      const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (const el of allElements) {
        if (el.shadowRoot) {
          results = results.concat(deepQuerySelectorAll(selector, el.shadowRoot));
        }
        if (el.tagName && el.tagName.toLowerCase() === 'iframe') {
          try {
            const iframeDoc = el.contentDocument || (el.contentWindow && el.contentWindow.document);
            if (iframeDoc) {
              results = results.concat(deepQuerySelectorAll(selector, iframeDoc));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return results;
  }

  function deepQuerySelector(selector, root = document) {
    const list = deepQuerySelectorAll(selector, root);
    return list.length > 0 ? list[0] : null;
  }

  // --- 3. MULTIMODAL VISION IMAGE EXTRACTION ---
  async function imageSrcToDataUrl(imgEl, src) {
    if (!src) return '';
    if (src.startsWith('data:image/')) return src;

    // 1. Try offscreen canvas extraction if image is already loaded in DOM
    try {
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
        const canvas = document.createElement('canvas');
        let width = imgEl.naturalWidth;
        let height = imgEl.naturalHeight;
        const maxDim = 1280;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          return dataUrl;
        }
      }
    } catch (e) {}

    // 2. Fetch blob & convert to Data URL
    try {
      const res = await fetch(src, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || src);
          reader.onerror = () => resolve(src);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {}

    // Fallback: return raw src URL
    return src;
  }

  async function getElementImages(element) {
    if (!element) return [];
    const mediaElements = Array.from(element.querySelectorAll('img, svg, canvas'));
    const images = [];

    for (let i = 0; i < mediaElements.length; i++) {
      const el = mediaElements[i];
      try {
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'img') {
          const src = el.currentSrc || el.src || el.getAttribute('src');
          if (!src || src.includes('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')) continue;

          const dataUrl = await imageSrcToDataUrl(el, src);
          if (dataUrl) {
            const alt = el.getAttribute('alt') || el.getAttribute('title') || `Image ${i + 1}`;
            images.push({
              type: 'image',
              dataUrl: dataUrl,
              alt: cleanText(alt)
            });
          }
        } else if (tagName === 'canvas') {
          try {
            const dataUrl = el.toDataURL('image/jpeg', 0.85);
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              images.push({
                type: 'canvas',
                dataUrl: dataUrl,
                alt: `Canvas Diagram ${i + 1}`
              });
            }
          } catch (e) {}
        } else if (tagName === 'svg') {
          try {
            const svgStr = new XMLSerializer().serializeToString(el);
            const encoded = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
            images.push({
              type: 'svg',
              dataUrl: encoded,
              alt: `Vector SVG ${i + 1}`
            });
          } catch (e) {}
        }
      } catch (e) {}
    }
    return images;
  }

  // --- 4. STRING & TEXT CLEANING ---
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

    // Remove interactive choices, inputs, scripts, styles, badges
    clone.querySelectorAll(
      'button, input, select, textarea, .qt-choices, .choices, .options, .mat-radio-group, .answer-options, .answers, script, style, .swayam-ai-badge'
    ).forEach(el => el.remove());

    // Convert MathJax / TeX annotation scripts to LaTeX
    clone.querySelectorAll('script[type="math/tex"], annotation[encoding="application/x-tex"]').forEach(math => {
      const tex = math.textContent || '';
      const textNode = document.createTextNode(` \\( ${tex} \\) `);
      math.parentNode.replaceChild(textNode, math);
    });

    // Replace images and diagrams with indexed labels
    let imgIdx = 1;
    clone.querySelectorAll('img, svg, canvas').forEach(img => {
      const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
      const textNode = document.createTextNode(alt ? ` [Image ${imgIdx}: ${alt}] ` : ` [Image ${imgIdx}] `);
      img.parentNode.replaceChild(textNode, img);
      imgIdx++;
    });

    // Format pre and code blocks
    clone.querySelectorAll('pre, code').forEach(code => {
      const formatted = `\n\`\`\`\n${code.innerText || code.textContent}\n\`\`\`\n`;
      const textNode = document.createTextNode(formatted);
      code.parentNode.replaceChild(textNode, code);
    });

    return cleanText(clone.innerText || clone.textContent || '');
  }

  // --- 5. UNIVERSAL INPUT-CENTRIC QUESTION EXTRACTOR ---
  async function extractQuestions(includeImages = false, root = document) {
    const questions = [];

    // 1. Find all choice inputs across root, shadow DOM, and same-origin frames
    const inputSelector = 'input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], mat-radio-button, paper-radio-button, mat-checkbox';
    const allInputs = deepQuerySelectorAll(inputSelector, root);

    if (allInputs.length === 0) {
      return questions;
    }

    // 2. Check for explicit question containers
    const containerSelectors = [
      '.gcb-question',
      'fieldset.gcb-question-fieldset',
      '.assessment-question',
      '.quiz-question-container',
      '.quiz_question',
      '.question_holder',
      '.display_question',
      '.qt-mc-question',
      '.qt-sa-question',
      '.quiz-question',
      'div[class*="question-row"]',
      'mat-card.question-card',
      'fieldset.question-fieldset',
      '.form-group.question'
    ].join(', ');

    let rawContainers = deepQuerySelectorAll(containerSelectors, root);

    // Keep only containers that DIRECTLY contain choice inputs
    rawContainers = rawContainers.filter(container => {
      const inputsInContainer = deepQuerySelectorAll(inputSelector, container);
      return inputsInContainer.length > 0;
    });

    // Remove outer wrappers if smaller child containers also match
    rawContainers = rawContainers.filter(container => {
      return !rawContainers.some(other => other !== container && container.contains(other));
    });

    let questionGroups = [];
    if (rawContainers.length > 0) {
      rawContainers.forEach((container, idx) => {
        const inputs = deepQuerySelectorAll(inputSelector, container);
        if (inputs.length > 0) {
          questionGroups.push({
            container: container,
            inputs: inputs,
            id: container.id || `q_${idx + 1}`
          });
        }
      });
    }

    // 3. Fallback: Group by input name or distinct question wrapper
    if (questionGroups.length === 0) {
      const nameGroups = new Map();
      const unnamedInputs = [];

      allInputs.forEach(input => {
        const name = input.name || input.getAttribute('name') || '';
        if (name) {
          if (!nameGroups.has(name)) nameGroups.set(name, []);
          nameGroups.get(name).push(input);
        } else {
          unnamedInputs.push(input);
        }
      });

      nameGroups.forEach((inputs, name) => {
        if (inputs.length > 0) {
          let container = inputs[0].closest('.gcb-question, fieldset, .mat-radio-group, [role="radiogroup"], .card, .form-group, tr, li, div[class*="question"], div') || inputs[0].parentElement;
          questionGroups.push({
            container: container,
            inputs: inputs,
            id: name
          });
        }
      });

      if (unnamedInputs.length > 0) {
        const parentMap = new Map();
        unnamedInputs.forEach(input => {
          const parent = input.closest('fieldset, [role="radiogroup"], .mat-radio-group, .choice-group, tr, div[class*="question"], .form-group') || input.parentElement?.parentElement || input.parentElement;
          if (parent) {
            if (!parentMap.has(parent)) parentMap.set(parent, []);
            parentMap.get(parent).push(input);
          }
        });

        parentMap.forEach((inputs, parent) => {
          if (inputs.length >= 1) {
            questionGroups.push({
              container: parent,
              inputs: inputs,
              id: parent.id || `q_unnamed_${questionGroups.length + 1}`
            });
          }
        });
      }
    }

    // 4. Build structured questions from questionGroups
    for (let index = 0; index < questionGroups.length; index++) {
      const group = questionGroups[index];
      const container = group.container;
      const inputs = group.inputs;
      const qId = group.id || `q_${index + 1}`;

      const isCheckbox = inputs.some(i => i.type === 'checkbox' || i.getAttribute('role') === 'checkbox' || (i.tagName && i.tagName.toLowerCase().includes('checkbox')));
      const qType = isCheckbox ? 'msq' : 'mcq';

      const options = [];
      for (let optIdx = 0; optIdx < inputs.length; optIdx++) {
        const input = inputs[optIdx];
        let labelText = '';
        let labelEl = null;

        if (input.id) {
          labelEl = deepQuerySelector(`label[for="${CSS.escape(input.id)}"]`, container.ownerDocument || document) || container.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        }
        if (!labelEl) {
          labelEl = input.closest('label, .mat-radio-label, .choice, li, tr, .option, .mat-checkbox-layout');
        }
        if (!labelEl && input.nextElementSibling) {
          labelEl = input.nextElementSibling;
        }

        const optTarget = labelEl || input.parentElement;
        if (optTarget) {
          labelText = extractRichText(optTarget);
        }

        const optImages = includeImages && optTarget ? await getElementImages(optTarget) : [];

        options.push({
          index: optIdx,
          id: input.id || `opt_${index}_${optIdx}`,
          text: labelText || `Option ${optIdx + 1}`,
          images: optImages,
          inputElement: input,
          labelElement: optTarget
        });
      }

      let qText = '';
      const bodyEl = container.querySelector(
        '.qt-question-body, .qt-question-description, .question-text, .question-title, .question_text, legend, .gcb-question-header, h2, h3, h4, p, span.question-title, div.prompt'
      );
      if (bodyEl) {
        qText = extractRichText(bodyEl);
      } else {
        qText = extractRichText(container);
      }

      if (!qText) {
        qText = `Question ${index + 1}`;
      }

      const qImages = includeImages ? await getElementImages(bodyEl || container) : [];

      questions.push({
        index: index,
        id: qId,
        type: qType,
        text: qText,
        images: qImages,
        options: options,
        containerElement: container
      });
    }

    return questions;
  }

  // --- 6. REPORT QUESTIONS TO BACKGROUND ---
  async function notifyBackgroundOfQuestions() {
    try {
      const questions = await extractQuestions(false);
      chrome.runtime.sendMessage({
        action: 'REPORT_FRAME_QUESTIONS',
        count: questions.length,
        url: window.location.href,
        isTopFrame: window === window.top
      }, () => {
        if (chrome.runtime.lastError) {}
      });

      // Always initialize floating widget so user can trigger solve from any frame
      initFloatingWidget();
    } catch (e) {}
  }

  // --- 7. APPLY SOLUTIONS ---
  async function applySolutions(parsedQuestions, solutions, config) {
    let appliedCount = 0;
    const isStealth = config.stealthMode === true;
    const isHumanPaced = config.humanPacing !== false;

    for (let idx = 0; idx < parsedQuestions.length; idx++) {
      const q = parsedQuestions[idx];
      const sol = solutions.find(s => s.questionIndex === idx || s.questionId === q.id) || solutions[idx];
      if (!sol || !sol.selectedOptionIndices || sol.selectedOptionIndices.length === 0) continue;

      if (config.autoScroll !== false && q.containerElement) {
        q.containerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const indicesToSelect = sol.selectedOptionIndices;

      q.options.forEach(opt => {
        const shouldSelect = indicesToSelect.includes(opt.index);
        const inputEl = opt.inputElement;

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

      if (!isStealth && config.showReasoning !== false) {
        injectRationaleBadge(q.containerElement, sol);
      }

      appliedCount++;

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

    if (config.autoSubmit && !config.highlightOnly && appliedCount > 0) {
      const submitDelay = config.autoSubmitDelay || 5000;
      showToast(`Auto-submitting in ${Math.round(submitDelay / 1000)}s...`, 'success');
      setTimeout(() => {
        triggerAutoSubmit();
      }, submitDelay);
    }

    return appliedCount;
  }

  function selectInputElementRealistic(input, label) {
    if (!input) return;

    try {
      const target = label || input;
      const rect = target.getBoundingClientRect();

      const clientX = Math.round(rect.left + Math.max(5, rect.width * (0.25 + Math.random() * 0.5)));
      const clientY = Math.round(rect.top + Math.max(5, rect.height * (0.25 + Math.random() * 0.5)));
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

      target.dispatchEvent(new PointerEvent('pointerover', eventInit));
      target.dispatchEvent(new PointerEvent('pointerenter', eventInit));
      target.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));

      if (typeof input.focus === 'function') {
        input.focus({ preventScroll: true });
      }

      if ('checked' in input) {
        input.checked = true;
      }

      target.dispatchEvent(new PointerEvent('pointerup', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));
      target.dispatchEvent(new MouseEvent('click', eventInit));

      if (typeof target.click === 'function' && target !== input) {
        target.click();
      } else if (typeof input.click === 'function') {
        input.click();
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      if ('checked' in input) input.checked = true;
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

    const targetHeader = container.querySelector('.qt-question-body, .question-text, .gcb-question-header, legend, h2, h3, h4, p') || container.firstElementChild || container;
    targetHeader.appendChild(badge);
  }

  function triggerAutoSubmit() {
    const submitBtn = document.querySelector(
      'input[type="submit"], button.gcb-submit-button, input.gcb-submit-button, #gcb-submit-answers, button[type="submit"], .submit-assignment-button, button:not([disabled])'
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

  // --- 8. SOLVE TRIGGER ORCHESTRATION ---
  async function solveCurrentAssignment(userInitiated = true) {
    if (isSolving) return;
    isSolving = true;
    updateWidgetState('solving');

    try {
      const questions = await extractQuestions(true);

      // If this frame has 0 questions, delegate solve across frames in the active tab!
      if (questions.length === 0) {
        const delegateRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'GET_TAB_STATUS_AND_SOLVE' }, res => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(res);
          });
        });

        if (delegateRes && delegateRes.success && delegateRes.solved) {
          showToast(`Solved ${delegateRes.count || ''} questions in assessment frame.`, 'success');
          updateWidgetState('idle');
          return;
        }

        if (userInitiated) {
          throw new Error('No questions found on the active page.');
        } else {
          updateWidgetState('idle');
          return;
        }
      }

      const totalImages = questions.reduce((acc, q) => acc + (q.images ? q.images.length : 0), 0);
      const imgInfo = totalImages > 0 ? ` (${totalImages} image${totalImages > 1 ? 's' : ''} captured)` : '';
      showToast(`Found ${questions.length} questions${imgInfo}. Solving with AI...`);

      const payload = questions.map(q => ({
        index: q.index,
        id: q.id,
        type: q.type,
        text: q.text,
        images: q.images || [],
        options: q.options.map(o => ({
          index: o.index,
          id: o.id,
          text: o.text,
          images: o.images || []
        }))
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
      if (userInitiated) {
        showToast(err.message, 'error');
      }
      updateWidgetState('idle');
    } finally {
      isSolving = false;
    }
  }

  // --- 9. CLOSED SHADOW DOM FLOATING WIDGET ---
  function initFloatingWidget() {
    if (document.getElementById('swayam-solver-host')) return;

    const host = document.createElement('div');
    host.id = 'swayam-solver-host';
    host.style.position = 'fixed';
    host.style.bottom = '24px';
    host.style.right = '24px';
    host.style.zIndex = '2147483647';

    const shadow = host.attachShadow({ mode: 'closed' });
    shadowRootRef = shadow;

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

    shadow.getElementById('solve-btn').addEventListener('click', () => solveCurrentAssignment(true));
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
      solveCurrentAssignment(true);
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TRIGGER_SOLVE') {
      solveCurrentAssignment(false)
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
      extractQuestions(false).then(questions => {
        sendResponse({
          success: true,
          questionCount: questions.length,
          url: window.location.href
        });
      }).catch(() => {
        sendResponse({ success: false, questionCount: 0, url: window.location.href });
      });
      return true;
    }
  });

  function checkUrlChange() {
    if (window.location.href !== lastEvaluatedUrl) {
      lastEvaluatedUrl = window.location.href;
      clearAllHighlights();
      notifyBackgroundOfQuestions();
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
  setInterval(notifyBackgroundOfQuestions, 2000);

  // Initial detection & report
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyBackgroundOfQuestions);
  } else {
    notifyBackgroundOfQuestions();
  }
})();
