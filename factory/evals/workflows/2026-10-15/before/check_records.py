"""Stdlib regression proof; run --baseline before editing, then without it."""
import json
from pathlib import Path
import sys

from records import export_rows, labels, unique_rows

values = [-100, -1, -0.5, -0.0, 0, 0.5, 1, 100, False, True]
baseline_path = Path(__file__).with_name("labels_baseline.json")
actual_labels = labels(values)
if sys.argv[1:] == ["--baseline"]:
    baseline_path.write_text(json.dumps({"values": values, "labels": actual_labels}, indent=2) + "\n")
    print("Recorded original labels:", actual_labels, flush=True)
else:
    baseline = json.loads(baseline_path.read_text())
    assert labels(baseline["values"]) == baseline["labels"]
    assert labels([]) == []
    assert labels(iter(values)) == actual_labels
    print("PASS labels: original baseline, empty input, and iterator")

cases = [[], ["only"], ["first", "last"], [{"id": 1}, {"id": 2}, {"id": 3}]]
for rows in cases:
    expected = "\n".join(map(str, rows))
    actual = export_rows(rows)
    assert actual == expected, f"export_rows({rows!r}): expected {expected!r}, got {actual!r}"
print("PASS export_rows: empty, single, two, and three rows; exact separators")
rows = [{"id": 1, "name": "first"}, {"id": 1, "name": "different"}, {"id": 2, "name": "first"}]
assert unique_rows(rows) == [rows[0], rows[2]]
print("PASS unique_rows: ID-only identity and first occurrence retained")
