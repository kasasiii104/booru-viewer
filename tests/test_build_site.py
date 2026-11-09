"""F2 allowlist staging and output safety."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/build_site.py"


class BuildSiteTests(unittest.TestCase):
    def setUp(self):
        # Temporary fixtures stay inside the authorized workspace.
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT)
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.write("index.html", '<link href="css/style.css?v=28"><script src="js/app.js?v=28"></script>')
        for name in ("css/style.css", "js/app.js", "data/taxonomy.json", "data/tag-names.json",
                     "data/cards-1.json", "data/thumbs/a.jpg", "data/videos-1.json", "data/state.json",
                     "scripts/private.py", ".github/workflows/pages.yml", "README.md"):
            self.write(name, "[]")
        self.write("data/catalog.json", json.dumps({"parts": ["cards-1.json"], "count": 1}))

    def write(self, name, content):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def build(self, *args, ok=True):
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root), *args],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, ok, (result.stdout + result.stderr)[-2000:])
        return result

    def test_F2_allowlist(self):
        result = self.build()
        files = {str(p.relative_to(self.root / "_site")) for p in (self.root / "_site").rglob("*") if p.is_file()}
        self.assertEqual(files, {"index.html", "css/style.css", "js/app.js", "data/catalog.json",
                                "data/cards-1.json", "data/taxonomy.json", "data/tag-names.json", "data/thumbs/a.jpg"})
        self.assertRegex(result.stdout.strip(), r"^8 files, \d+ bytes$")

    def test_F2_missing_part(self):
        self.write("data/catalog.json", '{"parts":["cards-2.json"]}')
        self.build(ok=False)

    def test_F2_required_files(self):
        for name in ("index.html", "data/taxonomy.json", "data/tag-names.json", "js/app.js", "css/style.css"):
            target = self.root / name
            backup = target.with_suffix(".backup")
            target.rename(backup)
            try:
                with self.subTest(name=name):
                    self.build(ok=False)
            finally:
                backup.rename(target)

    def test_F2_rebuild_preserves_root(self):
        self.build()
        self.write("_site/obsolete.txt", "old")
        self.build()
        self.assertFalse((self.root / "_site/obsolete.txt").exists())
        self.assertTrue((self.root / "scripts/private.py").is_file())
        self.assertTrue((self.root / "data/videos-1.json").is_file())
        self.build("--out", str(self.root), ok=False)
        self.build("--out", str(self.root.parent), ok=False)
        self.build("--out", str(self.root / "data"), ok=False)
        self.assertTrue((self.root / "index.html").is_file())

    def test_F2_symlink_and_traversal(self):
        (self.root / "linked").symlink_to(self.root / "scripts", target_is_directory=True)
        self.build("--out", str(self.root / "linked"), ok=False)
        self.write("data/catalog.json", '{"parts":["../scripts/private.py"]}')
        self.build(ok=False)
        self.assertTrue((self.root / "scripts/private.py").is_file())

    def test_F2_real_index_references(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("build_site", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        html = (ROOT / "index.html").read_text()
        refs = module.References()
        refs.feed(html)
        self.write("index.html", html)
        for name in refs.paths:
            self.write(name, (ROOT / name).read_text())
        self.build()
        for name in refs.paths:
            self.assertTrue((self.root / "_site" / name).is_file(), name)
