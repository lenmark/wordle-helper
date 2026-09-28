# Wordle Word Finder v1.8.0

Version 1.8.0 adds automatic inferred-information refresh by default. The Inferred information section is read-only/greyed out unless **Allow manual editing of inferred information** is checked. In automatic mode, **Find matches** recalculates the three inferred fields before searching. In manual mode, search uses the fields exactly as shown and only **Update inferred fields** recalculates them. Matching rules are otherwise unchanged from v1.7.0.

# Wordle Word Finder

Current app version: **1.8.0**

A local, dependency-free Wordle word finder. The application is plain HTML/CSS/JavaScript and uses Python 3 only to download the word lists and serve the files locally.

## Install

```bash
unzip wordle-helper.zip
cd wordle-helper
./setup.sh
```

`setup.sh` downloads two English word lists:

- Google 10,000 English list: used as a rough common-word ranking.
- `dwyl/english-words` alphabetic list: used as the larger search dictionary.

The lists are cleaned to lower-case ASCII alphabetic words of 2–20 letters and stored locally under `data/`.

## Run

```bash
./start.sh
```

Then open:

http://127.0.0.1:8000

To use another port:

```bash
./start.sh 8080
```

Stop the server with `Ctrl+C`.

## Search behavior

- **Number of letters**: exact word length.
- **Known letter positions**: fixed/green letters.
- **Known letters, unknown position**: additional required occurrences whose positions are unknown. These occurrences are additive with fixed-position letters; for example, a fixed `P` plus `P` here means at least two `P`s.
- **Letters ruled out**: candidates containing any of these letters are rejected.
- **Letters not tried yet**: not a hard constraint. Valid candidates are ranked by how many different untried letters they would test.
- Common words are ranked before words found only in the extended dictionary when the other ranking factors are equal.
- **Words already tried**: exact words entered here are excluded from results. Their positions are also used by the position-aware result list to infer known non-positions when the positive feedback is complete.
- **Clear inputs**: resets the word length to 5, clears all constraint fields and position boxes, and removes the previous search output.
- The number of database words for the selected length is shown above the matches.
- Every search attempt reports a visible success, no-match, input-conflict, loading, or unexpected-error status.
- The footer shows the app version and local word-database statistics.
- Two result sets are shown: a stricter position-aware list and the previous baseline list that ignores positional information from tried words.
- Up to 500 matches are displayed per result set; the total number of matches is shown.

## Why a local HTTP server?

Opening `index.html` directly as `file://` can block JavaScript from loading the local word-list files in modern browsers. `python3 -m http.server` avoids that without adding a web framework or package dependency.

## Word-list sources

- https://github.com/first20hours/google-10000-english
- https://github.com/dwyl/english-words

The word-list projects have their own licensing terms; review those repositories if you redistribute the downloaded lists.


## Version 1.3.0 additions

- Letter-box navigation note for **Tab / Shift+Tab**.
- **Letters known not to occur multiple times**: letters entered here may appear at most once in a result.
- **Update untried** beside *Words already tried*: recalculates A-Z letters not yet represented by tried words or current known/ruled-out constraints.
- **Update singles** beside *Words already tried*: conservatively adds a single-occurrence letter only when a tried word repeats that letter and the current positive constraints establish exactly one occurrence.

The second helper is intentionally conservative. A repeated letter in a guess is not, by itself, proof that the answer contains only one occurrence; Wordle feedback plus the entered positive constraints are needed for that inference.


## Version 1.4.0 additions

- Added **Update ruled out** beside *Words already tried*. It adds letters seen in tried words that are absent from the complete positive-feedback fields.
- Added an explicit warning that **Update untried**, **Update singles**, and **Update ruled out** rely on **Known letter positions** and **Known letters** containing complete positive feedback from the tried words. If those fields are incomplete, inferred data can be wrong.
- Added matching tooltips to all three helper buttons.


## Version 1.5.0 additions

- Replaced the three separate inference buttons with one **Update inferred fields** button.
- Before recalculation, the app clears **Letters not tried yet**, **Letters known not to occur multiple times**, and **Letters ruled out**. This prevents stale inferred values from surviving after the positive feedback changes.
- The single update operation then rebuilds all three fields from **Words already tried**, **Known letter positions**, and **Known letters**.
- The on-page warning now explicitly states that the three inferred fields are replaced and that reliable inference requires complete positive feedback in the two known-letter inputs.


## Version 1.6.0 additions

- Fixed duplicate-letter handling across matching, validation, and inference. A letter entered once in **Known letter positions** and again in **Known letters, unknown position** now means at least two occurrences.
- The duplicate-letter rule prevents such letters from being incorrectly inferred as single-occurrence.
- Added a boxed **Known information** section for the two direct-known inputs and a **Clear known information** button that clears only those two inputs.
- Added a boxed **Inferred information** section for single-occurrence, ruled-out, and untried letters.
- Moved **Update inferred fields** and its explanatory warning into the inferred section.


## Version 1.7.0 additions

- Added **known non-position inference** from **Words already tried** plus the complete **Known information** section.
- The inference is conservative. A tried position is excluded only when the aggregate information proves that the letter was present in that guess and was not a known fixed/green letter in that position.
- Duplicate-letter guesses are not over-interpreted. If a guess contains more copies of a letter than the Known information proves are present, the app does not guess which duplicate was yellow and which was gray.
- Search results are now split into two lists:
  - **Position-aware matches**: existing constraints plus safely inferred known non-positions.
  - **Matches ignoring tried-word positions**: the previous v1.6 logic for comparison and as a safety check when Known information may be incomplete.
- Above the strict list, the app displays the inferred positional rules, for example `A ≠ position 1 · D ≠ position 3 · E ≠ positions 2, 4`.
- The comparison summary reports how many baseline candidates were removed by the positional inference.

Example: if `REFER` and `AUDIO` were tried, no positions are fixed, and the known letters are `A D E E`, the app can infer that `A` is not in position 1, `D` is not in position 3, and `E` is not in positions 2 or 4. `EVADE` satisfies those positional constraints.

## GitHub Pages deployment

This repository includes `.github/workflows/pages.yml` for GitHub Pages.
The workflow downloads and cleans the word lists with `setup.sh`, builds a static `_site`, and deploys it with GitHub Pages whenever `main` changes.

To enable it for a new repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` or run the workflow manually from **Actions**.

The public URL will normally be:

`https://<github-user>.github.io/<repository>/`

Local usage is unchanged: run `./setup.sh` once and then `./start.sh`.
