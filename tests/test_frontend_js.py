"""F1 JavaScript syntax, loader contract, and actual script-chain integration."""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FrontendTests(unittest.TestCase):
    def node(self, *args):
        result = subprocess.run(["node", *args], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, (result.stdout + result.stderr)[-4000:])

    def test_F1_all_javascript_syntax(self):
        for path in sorted((ROOT / "js").glob("*.js")):
            with self.subTest(path=path.name):
                self.node("--check", str(path))

    def test_F1_loader(self):
        self.node("tests/js/loader.cjs")

    def test_F1_script_chain(self):
        self.node("tests/js/frontend.cjs")

    def test_F1_all_initial_failures_require_reload(self):
        self.node("tests/js/frontend.cjs", "--all-fail")

    def test_F1_taxonomy_failure_disables_loading(self):
        self.node("tests/js/frontend.cjs", "--taxonomy-fail")

    def test_F1_catalog_failure_disables_loading(self):
        self.node("tests/js/frontend.cjs", "--catalog-fail")

    def test_F1_tag_names_failure_continues(self):
        self.node("tests/js/frontend.cjs", "--names-fail")
