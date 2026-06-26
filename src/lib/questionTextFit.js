export const QUESTION_WORD_SAFE_LENGTH = 11;
export const QUESTION_WORD_MIN_SCALE = 0.52;

export function getQuestionWordLength(word) {
  return Array.from(String(word ?? '').normalize('NFC')).length;
}

export function getQuestionWordScale(word, options = {}) {
  const safeLength = Number.isFinite(Number(options.safeLength))
    ? Math.max(1, Number(options.safeLength))
    : QUESTION_WORD_SAFE_LENGTH;
  const minScale = Number.isFinite(Number(options.minScale))
    ? Math.min(1, Math.max(0.1, Number(options.minScale)))
    : QUESTION_WORD_MIN_SCALE;
  const length = getQuestionWordLength(word);
  if (length <= safeLength) return 1;
  return Math.max(minScale, Math.min(1, safeLength / length));
}

export function getQuestionTextFitTokens(text) {
  return String(text ?? '')
    .split(/(\s+)/u)
    .filter((segment) => segment.length > 0)
    .map((segment, index) => {
      const isWhitespace = /^\s+$/u.test(segment);
      const length = isWhitespace ? 0 : getQuestionWordLength(segment);
      const scale = isWhitespace ? 1 : getQuestionWordScale(segment);
      return {
        key: `${index}:${segment}`,
        text: segment,
        isWhitespace,
        length,
        scale,
        shouldFit: !isWhitespace && scale < 1,
      };
    });
}
