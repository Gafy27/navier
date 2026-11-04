import json
from pathlib import Path

from records import export_rows, labels, unique_rows


for rows in ([], [{"id": 1}], [{"id": 1}, {"id": 2}], ["a", "a", "b"]):
    expected = "\n".join(str(row) for row in rows)
    assert export_rows(rows) == expected, rows
print("PASS export_rows: empty, singleton, multiple, duplicate rows; exact order and separators")

baseline = json.loads(Path(__file__).with_name("labels_baseline.json").read_text())
assert labels(baseline["values"]) == baseline["labels"]
assert labels([]) == []
print("PASS labels: matches captured baseline for 8 negative/zero/positive inputs; empty input")

rows = [{"id": 1, "name": "first"}, {"id": 1, "name": "second"}, {"id": 2}]
assert unique_rows(rows) == [rows[0], rows[2]]
print("PASS unique_rows: first occurrence per id retained")
