def unique_rows(rows):
    seen = set()
    result = []
    for row in rows:
        if row["id"] not in seen:
            seen.add(row["id"])
            result.append(row)
    return result


def export_rows(rows):
    return "\n".join(str(row) for row in rows)


def labels(values):
    return [
        "negative" if value < 0 else "zero" if value == 0 else "positive"
        for value in values
    ]
