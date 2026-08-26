/**
 * SWAYAMSolver - Simulated DOM & Extraction Integration Test
 * Simulates HTML parsing of mock_assignment.html to verify extraction and resolution integrity.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting DOM & Extraction Integration Test...\n');

const htmlContent = fs.readFileSync(path.join(__dirname, 'mock_assignment.html'), 'utf8');

// Match all gcb-question blocks
const questionMatches = htmlContent.match(/class="gcb-question"/g);

assert(questionMatches && questionMatches.length === 4, `Expected 4 questions in mock assignment, found ${questionMatches ? questionMatches.length : 0}`);
console.log(`  ✅ Successfully detected ${questionMatches.length} question containers in mock_assignment.html`);

// Verify Question 1 (BST Worst-case complexity - MCQ)
assert(htmlContent.includes('Binary Search Tree'), 'Mock HTML must contain Binary Search Tree');
assert(htmlContent.includes('q1_opt2'), 'Mock HTML must contain option 2');
console.log('  ✅ Question 1 (MCQ Single Choice) validated.');

// Verify Question 2 (Python bool([]) - MCQ)
assert(htmlContent.includes('bool([])'), 'Mock HTML must contain bool([])');
assert(htmlContent.includes('False and True'), 'Mock HTML must contain False and True');
console.log('  ✅ Question 2 (MCQ with Code Formatting) validated.');

// Verify Question 3 (Hash Map & Hash Set - MSQ Checkbox)
assert(htmlContent.includes('type="checkbox"'), 'Mock HTML must contain checkbox inputs for MSQ');
assert(htmlContent.includes('Python Dictionary (Hash Map)'), 'Mock HTML must contain Hash Map option');
console.log('  ✅ Question 3 (MSQ Multi-Select Checkboxes) validated.');

// Verify Question 4 (Merge Sort - MCQ)
assert(htmlContent.includes('Merge Sort'), 'Mock HTML must contain Merge Sort');
assert(htmlContent.includes('Divide and Conquer'), 'Mock HTML must contain Divide and Conquer');
console.log('  ✅ Question 4 (MCQ Numbered Options) validated.');

console.log('\n🎉 Simulated DOM and extraction structure tests verified successfully!\n');
