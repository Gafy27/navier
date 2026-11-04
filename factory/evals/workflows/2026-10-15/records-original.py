def unique_rows(rows):
    seen = set()
    result = []
    for row in rows:
        if row["id"] not in seen:
            seen.add(row["id"])
            result.append(row)
    return result


def export_rows(rows):
    return "\n".join(str(row) for row in rows[:-1])


def labels(values):
    result = []
    for value in values:
        if value < 0:
            result.append("negative")
        elif value == 0:
            result.append("zero")
        else:
            result.append("positive")
    return result
