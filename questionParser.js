/**
 * Ayurthon Question Parser
 * Parses bulk pasted questions in Hindi/Sanskrit/Devanagari
 * Supports: MCQ, Assertion-Reason, Match the Following
 */

function detectQuestionType(text) {
  const assertionKeywords = ['अभिकथन', 'assertion', 'तर्क', 'reason', 'कथन'];
  const matchKeywords = ['सुमेलित', 'match', 'मिलान', 'column'];

  const lower = text.toLowerCase();
  if (assertionKeywords.some(k => text.includes(k))) return 'assertion_reason';
  if (matchKeywords.some(k => lower.includes(k))) return 'match_following';
  return 'mcq';
}

function parseQuestions(rawText) {
  const questions = [];
  const errors = [];

  // Normalize line endings
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // Split into individual question blocks
  // Split on blank line OR when next question starts
  const blocks = splitIntoBlocks(normalized);

  blocks.forEach((block, index) => {
    try {
      const parsed = parseBlock(block.trim());
      if (parsed) {
        questions.push(parsed);
      }
    } catch (e) {
      errors.push({ block_index: index + 1, error: e.message, text: block.substring(0, 100) });
    }
  });

  return { questions, errors, total: questions.length };
}

function splitIntoBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect start of new question
    const isNewQuestion = (
      /^(Q\d+\.|Q\.\s|\d+\.\s|\d+\))/i.test(line) ||
      (line.length > 10 && currentBlock.length > 0 &&
        hasAnswerLine(currentBlock) && !line.startsWith('A.') &&
        !line.startsWith('B.') && !line.startsWith('C.') &&
        !line.startsWith('D.') && !line.toLowerCase().startsWith('answer') &&
        !line.toLowerCase().startsWith('explanation') &&
        !line.startsWith('Ans') && line.length > 5)
    );

    if (isNewQuestion && currentBlock.length > 0 && hasAnswerLine(currentBlock)) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [line];
    } else if (line === '' && currentBlock.length > 0 && hasAnswerLine(currentBlock)) {
      // Empty line after a complete block
      const nextNonEmpty = lines.slice(i + 1).find(l => l.trim() !== '');
      if (nextNonEmpty && /^(Q\d+\.|Q\.\s|\d+\.\s|\d+\))/i.test(nextNonEmpty.trim())) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      } else {
        currentBlock.push(line);
      }
    } else if (line !== '' || currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0 && hasAnswerLine(currentBlock)) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.filter(b => b.trim().length > 20);
}

function hasAnswerLine(lines) {
  return lines.some(l =>
    /^(Answer|Ans|उत्तर)\s*:/i.test(l.trim()) ||
    /^(Answer|Ans)\s*[:-]\s*[ABCD]/i.test(l.trim())
  );
}

function parseBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);

  let questionLines = [];
  let optionA = '', optionB = '', optionC = '', optionD = '';
  let correctAnswer = '';
  let explanation = '';
  let reference = '';
  let parsingOptions = false;
  let parsingExplanation = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Option lines
    if (/^A[\.\)]\s/.test(line)) { optionA = line.replace(/^A[\.\)]\s*/, '').trim(); parsingOptions = true; parsingExplanation = false; continue; }
    if (/^B[\.\)]\s/.test(line)) { optionB = line.replace(/^B[\.\)]\s*/, '').trim(); continue; }
    if (/^C[\.\)]\s/.test(line)) { optionC = line.replace(/^C[\.\)]\s*/, '').trim(); continue; }
    if (/^D[\.\)]\s/.test(line)) { optionD = line.replace(/^D[\.\)]\s*/, '').trim(); continue; }

    // Answer line
    const answerMatch = line.match(/^(Answer|Ans|उत्तर)\s*[:\-]\s*([ABCD])/i);
    if (answerMatch) {
      correctAnswer = answerMatch[2].toUpperCase();
      // Check if explanation is on same line
      const explPart = line.replace(/^(Answer|Ans|उत्तर)\s*[:\-]\s*[ABCD]\s*/i, '').trim();
      if (explPart) explanation = explPart;
      parsingExplanation = true;
      continue;
    }

    // Explanation line
    if (/^(Explanation|Expl|व्याख्या)\s*[:\-]/i.test(line)) {
      explanation = line.replace(/^(Explanation|Expl|व्याख्या)\s*[:\-]\s*/i, '').trim();
      parsingExplanation = true;
      continue;
    }

    // Reference line
    if (/^(Reference|Ref|संदर्भ)\s*[:\-]/i.test(line)) {
      reference = line.replace(/^(Reference|Ref|संदर्भ)\s*[:\-]\s*/i, '').trim();
      parsingExplanation = false;
      continue;
    }

    // If parsing explanation, append to it
    if (parsingExplanation && correctAnswer && !line.match(/^[ABCD][\.\)]/)) {
      explanation += ' ' + line;
      continue;
    }

    // Otherwise it's part of the question text
    if (!parsingOptions) {
      // Remove question number prefix
      const cleaned = line.replace(/^(Q\d+\.|Q\.\s*|\d+[\.\)]\s*)/, '').trim();
      if (cleaned) questionLines.push(cleaned);
    }
  }

  const questionText = questionLines.join('\n').trim();

  // Validation
  if (!questionText) throw new Error('Question text missing');
  if (!optionA || !optionB || !optionC || !optionD) throw new Error('One or more options missing');
  if (!correctAnswer) throw new Error('Correct answer missing');

  return {
    text: questionText,
    type: detectQuestionType(questionText),
    options: { A: optionA, B: optionB, C: optionC, D: optionD },
    correct_answer: correctAnswer,
    explanation: explanation.trim(),
    reference: reference.trim()
  };
}

module.exports = { parseQuestions };
