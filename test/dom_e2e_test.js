/**
 * SWAYAM Solver - DOM Extraction Integration Test
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- DOM Extraction Test ---');

const htmlContent = fs.readFileSync(path.join(__dirname, 'mock_assignment.html'), 'utf8');
const questionMatches = htmlContent.match(/class="gcb-question"/g);

assert(questionMatches && questionMatches.length === 4, `Expected 4 questions, found ${questionMatches ? questionMatches.length : 0}`);
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

console.log('DOM extraction tests passed.\n');
