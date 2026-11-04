# Local exercise report

Completed all three bounded tasks. Applied the supplied research/indexing and implementer instructions within the exercise's explicit overrides; no index/router edits, external research, surrounding configuration, or product gates were required.

## Duplicate rows

`unique_rows` starts an empty set and output list, visits input rows in order, and checks only `row["id"]` against the set. It records and appends a row only when that ID has not been seen (`records.py:1–8`). Thus the first row for each ID survives in input order, even if later rows with that ID have different other fields. Rows with different IDs survive even when all other fields match. Membership uses Python set hashing/equality semantics, rather than complete-row equality; missing IDs raise `KeyError` and unhashable IDs raise `TypeError` (`records.py:5–6`).

The original author's reason for choosing ID as the key is **unknown**. The implementation establishes the chosen mechanism, not its motivation; `README.md:1` explicitly states that no decision history is available. No author intent is inferred.

## Changes and proof

- `export_rows` now joins every input row rather than slicing off the final row (`records.py:11–12`), satisfying the all-rows, input-order, newline-separator contract (`README.md:1`). `unique_rows` is unchanged.
- `labels` is now one list comprehension with the same ordered conditional expressions: test `< 0`, then `== 0`, otherwise emit `positive` (`records.py:15–16`). The comparisons, branch order, output order, and list result are preserved.
- Before editing, `python3 check_records.py --baseline > baseline.log 2>&1` recorded the original labels in `labels_baseline.json`, then exited **1**: exporting `['only']` produced `''` instead of `'only'`. See `baseline.log`.
- After editing, `python3 check_records.py > passing.log 2>&1` exited **0**. Checks cover empty, single, two, and three export rows with exact expected output; labels match the captured original for negative/zero/positive integers and floats, negative zero, and booleans. Empty and iterator label inputs also pass. A regression check confirms ID-only deduplication and retention of the first row. See `passing.log` and `check_records.py`.

Artifacts: `records.py`, `check_records.py`, `labels_baseline.json`, `baseline.log`, `passing.log`, and this report. Python also generated a local `__pycache__` during import. All artifacts are inside this project directory.

Unverified: original author motivation; exhaustive behavior for arbitrary user-defined numeric objects. No independent review or approval was performed or claimed. No third-party dependencies or services were used.
