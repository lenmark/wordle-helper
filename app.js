'use strict';

const APP_VERSION = '1.8.0';
const DISPLAY_LIMIT = 500;

const els = {
  wordLength: document.querySelector('#wordLength'),
  letterBoxes: document.querySelector('#letterBoxes'),
  required: document.querySelector('#requiredLetters'),
  singles: document.querySelector('#singleOccurrenceLetters'),
  excluded: document.querySelector('#excludedLetters'),
  untried: document.querySelector('#untriedLetters'),
  triedWords: document.querySelector('#triedWords'),
  updateInferred: document.querySelector('#updateInferredButton'),
  manualInferred: document.querySelector('#manualInferredMode'),
  inferredGroup: document.querySelector('#inferredGroup'),
  inferredModeStatus: document.querySelector('#inferredModeStatus'),
  clearKnown: document.querySelector('#clearKnownButton'),
  search: document.querySelector('#searchButton'),
  clear: document.querySelector('#clearButton'),
  message: document.querySelector('#message'),
  loading: document.querySelector('#loading'),
  strictResults: document.querySelector('#strictResults'),
  baselineResults: document.querySelector('#baselineResults'),
  strictCount: document.querySelector('#strictCount'),
  baselineCount: document.querySelector('#baselineCount'),
  comparisonSummary: document.querySelector('#comparisonSummary'),
  positionRuleSummary: document.querySelector('#positionRuleSummary'),
  lengthCount: document.querySelector('#lengthCount'),
  footerStats: document.querySelector('#footerStats')
};

let words = [];
let commonRanks = new Map();
let wordsByLength = new Map();
let wordListsReady = false;
let wordListError = '';
let searchSequence = 0;

function lettersOnly(value) {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function uniqueLetters(value) {
  return [...new Set(lettersOnly(value))].join('');
}

function parseTriedWords(value) {
  return [...new Set(
    value
      .split(/[\s,;]+/)
      .map(word => lettersOnly(word))
      .filter(Boolean)
  )];
}

function selectedLength() {
  const requested = Number.parseInt(els.wordLength.value, 10);
  return Number.isFinite(requested) ? Math.min(20, Math.max(2, requested)) : 5;
}

function renderLetterBoxes() {
  const length = selectedLength();
  els.wordLength.value = length;

  const previous = [...els.letterBoxes.querySelectorAll('input')].map(i => i.value);
  els.letterBoxes.innerHTML = '';

  for (let i = 0; i < length; i++) {
    const input = document.createElement('input');
    input.className = 'letter-box';
    input.type = 'text';
    input.maxLength = 1;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.inputMode = 'text';
    input.setAttribute('aria-label', `Letter ${i + 1}`);
    input.placeholder = ' ';
    input.value = previous[i] || '';
    input.addEventListener('input', () => {
      input.value = lettersOnly(input.value).slice(-1).toUpperCase();
      if (input.value) {
        const next = input.nextElementSibling;
        if (next) next.focus();
      }
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value && input.previousElementSibling) {
        input.previousElementSibling.focus();
      }
    });
    els.letterBoxes.appendChild(input);
  }

  updateLengthCount();
}

function normalizeFields() {
  els.required.value = lettersOnly(els.required.value).toUpperCase();
  els.singles.value = uniqueLetters(els.singles.value).toUpperCase();
  els.excluded.value = uniqueLetters(els.excluded.value).toUpperCase();
  els.untried.value = uniqueLetters(els.untried.value).toUpperCase();
  els.triedWords.value = parseTriedWords(els.triedWords.value)
    .map(word => word.toUpperCase())
    .join(', ');
}

function fixedPattern() {
  return [...els.letterBoxes.querySelectorAll('input')]
    .map(input => lettersOnly(input.value).slice(0, 1));
}

function countLetters(text) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) || 0) + 1);
  return counts;
}

function validate(pattern, required, singles, excluded, untried, triedWords) {
  const errors = [];
  const excludedSet = new Set(excluded);
  const singlesSet = new Set(singles);
  const requiredSet = new Set(required);
  const fixedSet = new Set(pattern.filter(Boolean));
  const untriedSet = new Set(untried);

  const fixedExcluded = [...fixedSet].filter(ch => excludedSet.has(ch));
  if (fixedExcluded.length) {
    errors.push(`Fixed letter${fixedExcluded.length > 1 ? 's' : ''} ${fixedExcluded.map(x => x.toUpperCase()).join(', ')} also appear${fixedExcluded.length === 1 ? 's' : ''} in ruled-out letters.`);
  }

  const requiredExcluded = [...requiredSet].filter(ch => excludedSet.has(ch));
  if (requiredExcluded.length) {
    errors.push(`Required letter${requiredExcluded.length > 1 ? 's' : ''} ${requiredExcluded.map(x => x.toUpperCase()).join(', ')} also appear${requiredExcluded.length === 1 ? 's' : ''} in ruled-out letters.`);
  }

  const impossibleUntried = [...untriedSet]
    .filter(ch => excludedSet.has(ch) || requiredSet.has(ch) || fixedSet.has(ch) || singlesSet.has(ch));
  if (impossibleUntried.length) {
    errors.push(`Letter${impossibleUntried.length > 1 ? 's' : ''} ${impossibleUntried.map(x => x.toUpperCase()).join(', ')} cannot be both “not tried” and already known or ruled out.`);
  }

  const wrongLengthTried = triedWords.filter(word => word.length !== pattern.length);
  if (wrongLengthTried.length) {
    errors.push(`Tried word${wrongLengthTried.length > 1 ? 's' : ''} ${wrongLengthTried.map(word => word.toUpperCase()).join(', ')} ${wrongLengthTried.length === 1 ? 'does' : 'do'} not have ${pattern.length} letters.`);
  }

  const requiredCounts = countLetters(required);
  const fixedCounts = countLetters(pattern.filter(Boolean).join(''));

  // Known-position occurrences and known-unknown-position occurrences are additive.
  // Example: fixed A + required A means the answer contains at least two As.
  const knownCounts = new Map(fixedCounts);
  for (const [ch, count] of requiredCounts) {
    knownCounts.set(ch, (knownCounts.get(ch) || 0) + count);
  }

  for (const [ch, needed] of knownCounts) {
    if (needed > pattern.length) {
      errors.push(`Your known information requires ${needed} occurrences of ${ch.toUpperCase()}, which is impossible in a ${pattern.length}-letter word.`);
    }
  }

  const totalKnownOccurrences = pattern.filter(Boolean).length + required.length;
  if (totalKnownOccurrences > pattern.length) {
    errors.push(`Your known-position and unknown-position letters describe at least ${totalKnownOccurrences} letter occurrences, but the word has only ${pattern.length} positions.`);
  }

  const repeatedSingles = [...singlesSet].filter(ch => (knownCounts.get(ch) || 0) > 1);
  if (repeatedSingles.length) {
    errors.push(`Letter${repeatedSingles.length > 1 ? 's' : ''} ${repeatedSingles.map(x => x.toUpperCase()).join(', ')} ${repeatedSingles.length === 1 ? 'is' : 'are'} marked as single-occurrence but your known-letter constraints require multiple occurrences.`);
  }

  return errors;
}

function matchesWord(word, pattern, required, singles, excluded) {
  if (word.length !== pattern.length) return false;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] && word[i] !== pattern[i]) return false;
  }

  for (const ch of excluded) {
    if (word.includes(ch)) return false;
  }

  const wordCounts = countLetters(word);
  for (const ch of singles) {
    if ((wordCounts.get(ch) || 0) > 1) return false;
  }

  const fixedCounts = countLetters(pattern.filter(Boolean).join(''));
  const requiredCounts = countLetters(required);
  for (const [ch, count] of requiredCounts) {
    const minimumOccurrences = (fixedCounts.get(ch) || 0) + count;
    if ((wordCounts.get(ch) || 0) < minimumOccurrences) return false;
  }

  return true;
}

function scoreWord(word, untried) {
  const untriedSet = new Set(untried);
  const unique = new Set(word);
  let coverage = 0;
  for (const ch of unique) if (untriedSet.has(ch)) coverage++;
  const commonRank = commonRanks.has(word) ? commonRanks.get(word) : Number.MAX_SAFE_INTEGER;
  return { coverage, commonRank };
}

function getLengthTotal(length = selectedLength()) {
  return wordsByLength.get(length)?.length || 0;
}

function updateLengthCount(length = selectedLength()) {
  if (!wordListsReady) {
    els.lengthCount.textContent = 'Words of this length in database: —';
    return;
  }
  const total = getLengthTotal(length);
  els.lengthCount.textContent = `${length}-letter words in database: ${total.toLocaleString()}`;
}

function updateFooterStats() {
  const status = wordListsReady ? 'database loaded' : (wordListError ? 'database unavailable' : 'loading database');
  const total = wordListsReady ? words.length.toLocaleString() : '—';
  const common = wordListsReady ? commonRanks.size.toLocaleString() : '—';
  els.footerStats.textContent = `Version ${APP_VERSION} · ${total} total words · ${common} common-ranked words · lengths 2–20 · ${status}`;
}

function clearResults() {
  els.strictResults.innerHTML = '';
  els.baselineResults.innerHTML = '';
  els.strictCount.textContent = '';
  els.baselineCount.textContent = '';
  els.comparisonSummary.textContent = '';
  els.positionRuleSummary.textContent = '';
}

function knownMinimumCounts(pattern, required) {
  const counts = countLetters(pattern.filter(Boolean).join(''));
  for (const [ch, count] of countLetters(required)) {
    counts.set(ch, (counts.get(ch) || 0) + count);
  }
  return counts;
}

function inferKnownNonPositions(pattern, required, triedWords) {
  const knownMinimum = knownMinimumCounts(pattern, required);
  const nonPositions = new Map();

  for (const guess of triedWords) {
    if (guess.length !== pattern.length) continue;
    const guessCounts = countLetters(guess);

    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const knownCount = knownMinimum.get(ch) || 0;

      // Only infer a yellow/non-position when every occurrence of this letter
      // in this guess is accounted for by the complete positive information.
      // If the guess contains more copies than we know are present, some of
      // those tiles may have been gray and the aggregate inputs do not tell us
      // which occurrence was the positive one.
      if (!knownCount || guessCounts.get(ch) > knownCount) continue;

      // A known fixed position is either the green tile itself (same letter) or
      // already excludes this letter (different fixed letter). In either case
      // there is no additional non-position rule to infer for this position.
      if (pattern[i]) continue;

      if (!nonPositions.has(ch)) nonPositions.set(ch, new Set());
      nonPositions.get(ch).add(i);
    }
  }

  return nonPositions;
}

function matchesKnownNonPositions(word, nonPositions) {
  for (const [ch, positions] of nonPositions) {
    for (const index of positions) {
      if (word[index] === ch) return false;
    }
  }
  return true;
}

function describeKnownNonPositions(nonPositions) {
  const parts = [...nonPositions.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ch, positions]) => {
      const listed = [...positions].sort((a, b) => a - b).map(i => i + 1);
      return `${ch.toUpperCase()} \u2260 position${listed.length === 1 ? '' : 's'} ${listed.join(', ')}`;
    });
  return parts.join(' \u00b7 ');
}

function renderMatchList(target, matches, untried) {
  target.innerHTML = '';
  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'no-results-item';
    li.textContent = 'No matches';
    target.appendChild(li);
    return;
  }

  const visible = matches.slice(0, DISPLAY_LIMIT);
  const fragment = document.createDocumentFragment();
  for (const item of visible) {
    const li = document.createElement('li');
    li.className = 'result-word';
    li.textContent = item.word.toUpperCase();
    if (untried.length) {
      const small = document.createElement('span');
      small.className = 'score';
      small.textContent = `${item.coverage} new unique letter${item.coverage === 1 ? '' : 's'}`;
      li.appendChild(small);
    }
    fragment.appendChild(li);
  }
  target.appendChild(fragment);
}

function searchWords() {
  searchSequence += 1;
  const searchId = searchSequence;
  clearResults();
  clearMessage();

  try {
    normalizeFields();

    // In the default automatic mode, derived fields are refreshed immediately
    // before every search. Manual mode deliberately leaves them untouched.
    if (!els.manualInferred.checked) {
      updateInferredFields({ silent: true });
    }

    const length = selectedLength();
    updateLengthCount(length);

    if (!wordListsReady) {
      const detail = wordListError
        ? `The word lists could not be loaded: ${wordListError}. Run ./setup.sh, then reload this page.`
        : 'The word lists are still loading. Try again after the loading message disappears.';
      showMessage(`Search ${searchId}: ${detail}`, 'error');
      els.strictCount.textContent = 'Search not run';
      els.baselineCount.textContent = 'Search not run';
      return;
    }

    const pattern = fixedPattern();
    const required = lettersOnly(els.required.value);
    const singles = uniqueLetters(els.singles.value);
    const excluded = uniqueLetters(els.excluded.value);
    const untried = uniqueLetters(els.untried.value);
    const triedWords = parseTriedWords(els.triedWords.value);
    const triedSet = new Set(triedWords);
    const errors = validate(pattern, required, singles, excluded, untried, triedWords);

    if (errors.length) {
      showMessage(`Search ${searchId}: ${errors.join(' ')}`, 'error');
      els.strictCount.textContent = 'Input conflict';
      els.baselineCount.textContent = 'Input conflict';
      return;
    }

    const candidates = wordsByLength.get(length) || [];
    const sortMatches = list => list
      .map(word => ({ word, ...scoreWord(word, untried) }))
      .sort((a, b) =>
        b.coverage - a.coverage ||
        a.commonRank - b.commonRank ||
        a.word.localeCompare(b.word)
      );

    // Baseline = v1.6 behavior: the tried words are excluded as exact guesses,
    // but the positions of their letters do not constrain candidate positions.
    const baselineWords = candidates
      .filter(word => !triedSet.has(word) && matchesWord(word, pattern, required, singles, excluded));
    const baselineMatches = sortMatches(baselineWords);

    // Position-aware = baseline plus conservative known non-position rules
    // inferred from the tried words and complete positive information.
    const nonPositions = inferKnownNonPositions(pattern, required, triedWords);
    const strictMatches = sortMatches(
      baselineWords.filter(word => matchesKnownNonPositions(word, nonPositions))
    );

    els.strictCount.textContent = `${strictMatches.length.toLocaleString()} match${strictMatches.length === 1 ? '' : 'es'}`;
    els.baselineCount.textContent = `${baselineMatches.length.toLocaleString()} match${baselineMatches.length === 1 ? '' : 'es'}`;

    const removed = baselineMatches.length - strictMatches.length;
    els.comparisonSummary.textContent = nonPositions.size
      ? `Using tried-word positions removes ${removed.toLocaleString()} of the ${baselineMatches.length.toLocaleString()} baseline candidate${baselineMatches.length === 1 ? '' : 's'}. The stricter list assumes the Known information section completely reflects all positive feedback from the tried words.`
      : 'No additional non-position constraints could be inferred safely from the current tried words and Known information. The two result sets are therefore identical.';

    const ruleDescription = describeKnownNonPositions(nonPositions);
    els.positionRuleSummary.textContent = ruleDescription
      ? `Inferred known non-positions: ${ruleDescription}.`
      : 'Inferred known non-positions: none.';

    renderMatchList(els.strictResults, strictMatches, untried);
    renderMatchList(els.baselineResults, baselineMatches, untried);

    const strictShown = strictMatches.length > DISPLAY_LIMIT
      ? ` The position-aware list shows the first ${DISPLAY_LIMIT.toLocaleString()}.`
      : '';
    const baselineShown = baselineMatches.length > DISPLAY_LIMIT
      ? ` The baseline list shows the first ${DISPLAY_LIMIT.toLocaleString()}.`
      : '';

    if (!baselineMatches.length) {
      showMessage(`Search ${searchId}: No matches were found under the existing constraints among ${candidates.length.toLocaleString()} ${length}-letter words.`, 'info');
    } else if (!strictMatches.length) {
      showMessage(`Search ${searchId}: The existing logic finds ${baselineMatches.length.toLocaleString()} match${baselineMatches.length === 1 ? '' : 'es'}, but the inferred tried-word non-position rules reduce that to zero. Check that Known information is complete before relying on the stricter result.`, 'info');
    } else {
      showMessage(`Search ${searchId}: Found ${strictMatches.length.toLocaleString()} position-aware match${strictMatches.length === 1 ? '' : 'es'} versus ${baselineMatches.length.toLocaleString()} when tried-word positions are ignored.${strictShown}${baselineShown}`, 'success');
    }
  } catch (error) {
    console.error('Word search failed:', error);
    showMessage(`Search ${searchId}: An unexpected error occurred: ${error?.message || String(error)}`, 'error');
    els.strictCount.textContent = 'Search failed';
    els.baselineCount.textContent = 'Search failed';
  }
}

function clearInputs() {
  els.wordLength.value = 5;
  els.required.value = '';
  els.singles.value = '';
  els.excluded.value = '';
  els.untried.value = '';
  els.triedWords.value = '';
  els.manualInferred.checked = false;
  setInferredManualMode(false);

  // Rebuild the position boxes at the default length with no carried-over values.
  els.letterBoxes.innerHTML = '';
  renderLetterBoxes();

  clearResults();
  clearMessage();
  els.strictCount.textContent = '';
  els.baselineCount.textContent = '';
  updateLengthCount(5);
  els.wordLength.focus();
}

function clearKnownSection() {
  for (const input of els.letterBoxes.querySelectorAll('input')) input.value = '';
  els.required.value = '';
  clearResults();
  els.strictCount.textContent = '';
  els.baselineCount.textContent = '';
  showMessage('Cleared Known information. Inferred fields were left unchanged; use Update inferred fields to recalculate them.', 'info');
  const firstBox = els.letterBoxes.querySelector('input');
  if (firstBox) firstBox.focus();
}

function updateInferredFields({ silent = false } = {}) {
  normalizeFields();
  const triedWords = parseTriedWords(els.triedWords.value);

  // These are derived fields. Always discard their previous contents before
  // recalculating so stale inference can never survive changed positive data.
  els.untried.value = '';
  els.singles.value = '';
  els.excluded.value = '';

  if (!triedWords.length) {
    if (!silent) showMessage('Cleared the three inferred fields. No tried words are available to recalculate them.', 'info');
    return;
  }

  const pattern = fixedPattern();
  const required = lettersOnly(els.required.value);
  const knownPresent = new Set([
    ...pattern.filter(Boolean),
    ...required
  ]);

  const triedLetters = new Set();
  const repeatedInGuess = new Set();
  for (const word of triedWords) {
    const counts = countLetters(word);
    for (const [ch, count] of counts) {
      triedLetters.add(ch);
      if (count > 1) repeatedInGuess.add(ch);
    }
  }

  // A tried letter absent from all complete positive-feedback fields is ruled out.
  const inferredExcluded = [...triedLetters]
    .filter(ch => !knownPresent.has(ch))
    .sort();
  els.excluded.value = inferredExcluded.join('').toUpperCase();

  // Conservatively infer a single-occurrence letter only when it was repeated in
  // a guess but the complete positive information establishes exactly one occurrence.
  // Fixed-position and unknown-position occurrences are additive: fixed A + required A
  // explicitly means at least two As, so A must never be inferred as single-occurrence.
  const fixedCounts = countLetters(pattern.filter(Boolean).join(''));
  const requiredCounts = countLetters(required);
  const inferredSingles = [...repeatedInGuess]
    .filter(ch => {
      const knownMinimum = (fixedCounts.get(ch) || 0) + (requiredCounts.get(ch) || 0);
      return knownMinimum === 1;
    })
    .sort();
  els.singles.value = inferredSingles.join('').toUpperCase();

  // Anything represented in a tried word or in the current known constraints has
  // already been tried. Newly derived singles/exclusions are included explicitly
  // for clarity, even though most will also be represented by tried words.
  const alreadyTried = new Set(triedLetters);
  for (const ch of pattern.filter(Boolean)) alreadyTried.add(ch);
  for (const ch of required) alreadyTried.add(ch);
  for (const ch of inferredSingles) alreadyTried.add(ch);
  for (const ch of inferredExcluded) alreadyTried.add(ch);

  els.untried.value = [...'abcdefghijklmnopqrstuvwxyz']
    .filter(ch => !alreadyTried.has(ch))
    .join('')
    .toUpperCase();

  const parts = [
    `${els.untried.value.length} untried letter${els.untried.value.length === 1 ? '' : 's'}`,
    `${inferredSingles.length} single-occurrence letter${inferredSingles.length === 1 ? '' : 's'}`,
    `${inferredExcluded.length} ruled-out letter${inferredExcluded.length === 1 ? '' : 's'}`
  ];
  if (!silent) {
    showMessage(`Recalculated inferred fields from ${triedWords.length} tried word${triedWords.length === 1 ? '' : 's'}: ${parts.join(', ')}. Previous inferred values were cleared first.`, 'info');
  }
}
function setInferredManualMode(manual) {
  els.manualInferred.checked = manual;
  for (const input of [els.singles, els.excluded, els.untried]) {
    input.disabled = !manual;
  }
  els.updateInferred.disabled = !manual;
  els.inferredGroup.classList.toggle('automatic-mode', !manual);
  els.inferredGroup.classList.toggle('manual-mode', manual);
  els.inferredModeStatus.textContent = manual ? 'Manual mode' : 'Automatic mode';
}

function showMessage(text, type) {
  els.message.textContent = text;
  els.message.className = `message ${type}`;
}

function clearMessage() {
  els.message.textContent = '';
  els.message.className = 'message';
}

function indexWordsByLength() {
  wordsByLength = new Map();
  for (const word of words) {
    if (!wordsByLength.has(word.length)) wordsByLength.set(word.length, []);
    wordsByLength.get(word.length).push(word);
  }
}

async function loadWordLists() {
  wordListsReady = false;
  wordListError = '';
  updateFooterStats();

  try {
    const [allResponse, commonResponse] = await Promise.all([
      fetch('data/words.txt', { cache: 'no-store' }),
      fetch('data/common.txt', { cache: 'no-store' })
    ]);
    if (!allResponse.ok || !commonResponse.ok) throw new Error('one or more local word-list files are missing');

    const [allText, commonText] = await Promise.all([allResponse.text(), commonResponse.text()]);
    words = [...new Set(allText.split(/\r?\n/).map(lettersOnly).filter(word => word.length >= 2 && word.length <= 20))];
    const common = [...new Set(commonText.split(/\r?\n/).map(lettersOnly).filter(Boolean))];
    commonRanks = new Map(common.map((word, index) => [word, index]));
    indexWordsByLength();
    wordListsReady = true;

    els.loading.textContent = `Loaded ${words.length.toLocaleString()} words.`;
    els.loading.className = 'loading loaded';
    updateLengthCount();
    updateFooterStats();
  } catch (error) {
    wordListError = error?.message || String(error);
    els.loading.textContent = 'Word lists are missing or could not be loaded. Run ./setup.sh, then reload this page.';
    els.loading.className = 'loading load-error';
    updateLengthCount();
    updateFooterStats();
  }
}

els.wordLength.addEventListener('change', renderLetterBoxes);
els.wordLength.addEventListener('input', renderLetterBoxes);
for (const input of [els.required, els.singles, els.excluded, els.untried, els.triedWords]) {
  input.addEventListener('blur', normalizeFields);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchWords();
  });
}
els.search.addEventListener('click', searchWords);
els.clear.addEventListener('click', clearInputs);
els.updateInferred.addEventListener('click', () => updateInferredFields());
els.manualInferred.addEventListener('change', () => {
  setInferredManualMode(els.manualInferred.checked);
  showMessage(
    els.manualInferred.checked
      ? 'Manual inferred-information mode enabled. Find matches will no longer recalculate these fields; use Update inferred fields when you want to refresh them.'
      : 'Automatic inferred-information mode enabled. Find matches will recalculate the inferred fields before every search.',
    'info'
  );
});
els.clearKnown.addEventListener('click', clearKnownSection);

setInferredManualMode(false);
renderLetterBoxes();
updateFooterStats();
loadWordLists();
