## Done

- Read the supplied research/implementer instructions and indexing skill. This exercise explicitly replaces missing factory fixtures and requires this report instead of an index/router change; used no web or external dependencies.
- `unique_rows` uses only `row["id"]` as the duplicate key (`records.py:5-6`). Membership follows Python set hashing/equality; other row fields do not participate. It visits rows in input order (`records.py:4`), appends the first row for each previously unseen id (`records.py:5-7`), and returns those original row objects in first-occurrence order (`records.py:8`). Missing ids raise `KeyError`; unhashable ids raise `TypeError`. Those exceptional cases follow directly from the lookup and set operations and were not separately executed.
- Why the original author chose id: unknown. `README.md:1` explicitly says no decision history is available. The source establishes the chosen key, not its historical rationale. No author motive is inferred.
- Fixed `export_rows` by removing the slice that excluded the final row (`records_before.py.txt:12` → `records.py:12`). Joining every stringified row satisfies the all-rows/order/separator contract in `README.md:1`.
- Refactored `labels` into a list comprehension (`records.py:15-19`) retaining the same ordered comparisons and output strings. Captured its original outputs before editing in `labels_baseline.json`; original source is retained in `records_before.py.txt`.

Verification receipts:

- Before edits, ran a stdlib Python reproduction with two rows and asserted the README result. Exit **1**, expected assertion failure: actual output omitted row 2. Inputs, expected/actual results, and label baseline are in `before.log`.
- After edits, ran `python3 check_records.py > after.log 2>&1`. Exit **0**. Export checks cover empty, singleton, multiple, and duplicate rows with exact output equality. Labels match the pre-edit baseline for `[-100, -1, -0.5, -0.0, 0, 0.5, 1, 100]`, plus empty input. An unchanged-utility check confirms first-row retention for repeated ids. Results are in `after.log`.

## Not done

- Original author intent remains unavailable; no history or external evidence was supplied or consulted.
- Label equivalence was measured over the listed representative inputs, not every possible Python object. The expression preserves comparison order by inspection.
- No factory-wide typecheck/lint/format commands were supplied for this isolated Python fixture. No independent review or approval is claimed.

## Choices the design was silent on

None within the exercise scope and README contract.

## Discovered issues

None beyond the corrected export omission.
