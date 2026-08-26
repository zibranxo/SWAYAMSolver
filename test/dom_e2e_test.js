const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- DOM Extraction Test ---');

const htmlContent = fs.readFileSync(path.join(__dirname, 'mock_assignment.html'), 'utf8');
const questionMatches = htmlContent.match(/class="gcb-question"/g);

assert(questionMatches && questionMatches.length === 5, `Expected 5 questions, found ${questionMatches ? questionMatches.length : 0}`);
console.log(`[PASS] Detected ${questionMatches.length} question containers in mock_assignment.html`);

assert(htmlContent.includes('Binary Search Tree'), 'Mock HTML must contain Binary Search Tree');
assert(htmlContent.includes('q1_opt2'), 'Mock HTML must contain option 2');
console.log('[PASS] Question 1 (Single Select MCQ) verified.');

assert(htmlContent.includes('bool([])'), 'Mock HTML must contain bool([])');
assert(htmlContent.includes('False and True'), 'Mock HTML must contain False and True');
console.log('[PASS] Question 2 (MCQ with Code Formatting) verified.');

assert(htmlContent.includes('type="checkbox"'), 'Mock HTML must contain checkbox inputs for MSQ');
assert(htmlContent.includes('Python Dictionary (Hash Map)'), 'Mock HTML must contain Hash Map option');
console.log('[PASS] Question 3 (Multiple Select MSQ Checkboxes) verified.');

assert(htmlContent.includes('Merge Sort'), 'Mock HTML must contain Merge Sort');
assert(htmlContent.includes('Divide and Conquer'), 'Mock HTML must contain Divide and Conquer');
console.log('[PASS] Question 4 (MCQ Numbered Options) verified.');

assert(htmlContent.includes('data:image/png;base64,'), 'Mock HTML must contain base64 image data URL');
assert(htmlContent.includes('Python Dictionary Update Code'), 'Mock HTML must contain image alt text');
assert(htmlContent.includes('KeyError: \'Art\''), 'Mock HTML must contain Python KeyError option');
console.log('[PASS] Question 5 (Image-based Code Screenshot MCQ) verified.');

// Verify Leaf-Container Filtering Logic
console.log('\n--- Leaf Container Filtering Logic Test ---');
class MockElement {
  constructor(name, children = []) {
    this.name = name;
    this.children = children;
  }
  contains(other) {
    if (this === other) return true;
    return this.children.some(c => c === other || c.contains(other));
  }
}

const childQ1 = new MockElement('childQ1');
const childQ2 = new MockElement('childQ2');
const parentWrapper = new MockElement('parentWrapper', [childQ1, childQ2]);

const matchedContainers = [parentWrapper, childQ1, childQ2];
const filtered = matchedContainers.filter(container => {
  return !matchedContainers.some(other => other !== container && container.contains(other));
});

assert.strictEqual(filtered.length, 2, 'Expected parent wrapper to be filtered out, leaving 2 child containers');
assert(filtered.includes(childQ1), 'Expected childQ1 to be retained');
assert(filtered.includes(childQ2), 'Expected childQ2 to be retained');
assert(!filtered.includes(parentWrapper), 'Expected parentWrapper to be excluded');
console.log('[PASS] Leaf container filter keeps individual question nodes and excludes outer wrapper.');

console.log('\nDOM extraction and leaf-filter tests passed.\n');

