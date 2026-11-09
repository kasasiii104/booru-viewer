"""Stage only browser assets for GitHub Pages (F2)."""
import argparse
import json
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if (tag == "script" and key == "src") or (tag == "link" and key == "href"):
                url = urlsplit(value)
                if not url.scheme and not url.netloc:
                    path = unquote(url.path)
                    if path.endswith((".css", ".js")):
                        self.paths.append(path)


def build(root, out):
    root = root.resolve()
    # Never clear root, its ancestors, external paths, or symlink destinations.
    if out.is_symlink():
        raise ValueError("Output must not be a symlink")
    out = out.resolve()
    if out == root or root not in out.parents:
        raise ValueError("Output must be strictly inside root")
    if out.relative_to(root).parts[0] in {"data", "js", "css", "scripts", "tests", ".github", ".git"}:
        raise ValueError("Output overlaps repository sources")
    catalog = json.loads((root / "data/catalog.json").read_text())
    parts = catalog["parts"]
    if not isinstance(parts, list) or any(not isinstance(p, str) or not re.fullmatch(r"cards-[0-9]+\.json", p) for p in parts):
        raise ValueError("Invalid cards parts")
    files = ["index.html", "data/catalog.json", "data/taxonomy.json", "data/tag-names.json"]
    files += ["data/" + p for p in parts]
    for directory in ("css", "js", "data/thumbs"):
        source = root / directory
        if source.exists():
            files += [str(p.relative_to(root)) for p in source.rglob("*") if p.is_file()]
    files = sorted(set(files))
    for name in files:
        source = root / name
        if not source.is_file() or root not in source.resolve().parents:
            raise ValueError("Missing or unsafe source: " + name)
    refs = References()
    refs.feed((root / "index.html").read_text())
    for name in refs.paths:
        target = (out / name).resolve()
        if out not in target.parents or str(target.relative_to(out)) not in files:
            raise ValueError("Missing referenced asset: " + name)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    total = 0
    for name in files:
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / name, target)
        total += target.stat().st_size
    print(f"{len(files)} files, {total} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    try:
        build(args.root, args.out if args.out is not None else args.root / "_site")
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(1, f"build_site: {exc}\n")


if __name__ == "__main__":
    main()
