PART = 10000


def load():
    items = []
    parts = sorted(DATA.glob("videos-*.json"))
    if parts:
        for part in parts:
            items.extend(json.loads(part.read_text()))
    elif VIDEOS.exists():
        items = json.loads(VIDEOS.read_text())
    raw = STATE.read_text() if STATE.exists() else ""
    state = json.loads(raw) if raw.strip() else {}
    state.setdefault("history", {})
    return items, state


def save(items, state):
    names = []
    chunks = range(0, max(len(items), 1), PART)
    for index, start in enumerate(chunks, 1):
        name = f"videos-{index}.json"
        (DATA / name).write_text(json.dumps(items[start:start + PART], ensure_ascii=False))
        names.append(name)
    for path in DATA.glob("videos-*.json"):
        if path.name not in names:
            path.unlink()
    if VIDEOS.exists():
        VIDEOS.unlink()
    (DATA / "catalog.json").write_text(json.dumps({"parts": names, "count": len(items)}, ensure_ascii=False))
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))
