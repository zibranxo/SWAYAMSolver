/**
 * SWAYAM Solver - Unit Tests
 */

const assert = require('assert');
const {
  cleanBaseUrl,
  buildPromptForQuestions,
  extractAndParseJson,
  normalizeSolutions
} = require('../background/background.js');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

console.log('--- 1. String Sanitization Tests ---');

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

test('Removes option prefixes like (a), (A), [1], 1., D)', () => {
  assert.strictEqual(cleanText('(A) Binary Search Tree'), 'Binary Search Tree');
  assert.strictEqual(cleanText('(b) Linear Search'), 'Linear Search');
  assert.strictEqual(cleanText('[1] Quick Sort'), 'Quick Sort');
  assert.strictEqual(cleanText('1. Depth First Search'), 'Depth First Search');
  assert.strictEqual(cleanText('D) Dijkstra Algorithm'), 'Dijkstra Algorithm');
});

test('Normalizes quotes, non-breaking spaces, and whitespace', () => {
  const input = '“Smart”\u00A0quotes—and    tabs\t\nand dashes';
  assert.strictEqual(cleanText(input), '"Smart" quotes-and tabs and dashes');
});

console.log('\n--- 2. Base URL Normalization Tests ---');

test('Normalizes base URL and adds https protocol if missing', () => {
  assert.strictEqual(cleanBaseUrl('api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1');
  assert.strictEqual(cleanBaseUrl('https://api.openai.com/v1///'), 'https://api.openai.com/v1');
  assert.strictEqual(cleanBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
});

console.log('\n--- 3. JSON Extraction & Fallback Tests ---');

test('Parses raw JSON string', () => {
  const raw = '{"solutions":[{"questionIndex":0,"selectedOptionIndices":[1]}]}';
  const parsed = extractAndParseJson(raw);
  assert.strictEqual(parsed.solutions[0].selectedOptionIndices[0], 1);
});

test('Extracts JSON from markdown code blocks', () => {
  const markdown = 'Here is the result:\n```json\n{\n  "solutions": [\n    {"questionIndex": 0, "selectedOptionIndices": [2], "reasoning": "Logarithmic time complexity."}\n  ]\n}\n```';
  const parsed = extractAndParseJson(markdown);
  assert.strictEqual(parsed.solutions[0].selectedOptionIndices[0], 2);
  assert.strictEqual(parsed.solutions[0].reasoning, 'Logarithmic time complexity.');
});

test('Extracts JSON within regular text', () => {
  const text = 'Response: {"solutions":[{"questionIndex":0,"selectedOptionIndices":[3]}]} finished.';
  const parsed = extractAndParseJson(text);
  assert.strictEqual(parsed.solutions[0].selectedOptionIndices[0], 3);
});

test('Wraps array JSON format into solutions object', () => {
  const arrayJson = '[{"questionIndex":0,"selectedOptionIndices":[0,1]}]';
  const parsed = extractAndParseJson(arrayJson);
  assert(Array.isArray(parsed.solutions));
  assert.deepStrictEqual(parsed.solutions[0].selectedOptionIndices, [0, 1]);
});

console.log('\n--- 4. Solution Normalization Tests ---');

test('Maps standard solutions array to questions', () => {
  const questions = [
    { id: 'q1', type: 'mcq', text: 'Q1', options: [{ text: 'OptA' }, { text: 'OptB' }] },
    { id: 'q2', type: 'msq', text: 'Q2', options: [{ text: 'OptA' }, { text: 'OptB' }, { text: 'OptC' }] }
  ];

  const parsed = {
    solutions: [
      { questionIndex: 0, questionId: 'q1', selectedOptionIndices: [1], confidence: 0.99, reasoning: 'Reason 1' },
      { questionIndex: 1, questionId: 'q2', selectedOptionIndices: [0, 2], confidence: 0.95, reasoning: 'Reason 2' }
    ]
  };

  const normalized = normalizeSolutions(parsed, questions);
  assert.strictEqual(normalized.length, 2);
  assert.deepStrictEqual(normalized[0].selectedOptionIndices, [1]);
  assert.deepStrictEqual(normalized[1].selectedOptionIndices, [0, 2]);
  assert.strictEqual(normalized[0].confidence, 0.99);
});

test('Handles answerIndex and option text fallback', () => {
  const questions = [
    { id: 'q1', type: 'mcq', text: 'Q1', options: [{ text: 'Python' }, { text: 'Java' }] },
    { id: 'q2', type: 'mcq', text: 'Q2', options: [{ text: 'O(1)' }, { text: 'O(N)' }] }
  ];

  const parsed = {
    solutions: [
      { questionId: 'q1', answerIndex: 0 },
      { questionId: 'q2', selectedOptionTexts: ['O(1)'] }
    ]
  };

  const normalized = normalizeSolutions(parsed, questions);
  assert.deepStrictEqual(normalized[0].selectedOptionIndices, [0]);
  assert.deepStrictEqual(normalized[1].selectedOptionIndices, [0]);
});

console.log('\n--- 5. Prompt Generation Tests ---');

test('Formats prompt with indices, question types, and option items', () => {
  const questions = [
    {
      id: 'qt-1',
      type: 'mcq',
      text: 'What is 2+2?',
      options: [{ text: '3' }, { text: '4' }, { text: '5' }]
    }
  ];

  const prompt = buildPromptForQuestions(questions);
  assert(prompt.includes('=== Question 1 (Index: 0) ==='));
  assert(prompt.includes('Single Select (MCQ - exactly one correct option)'));
  assert(prompt.includes('[Option 1]: 4'));
});

console.log(`\nTests completed: ${passedTests} / ${totalTests} passed.`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
