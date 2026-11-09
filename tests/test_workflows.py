"""F2/F6/F7 workflow and documentation contracts."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WorkflowTests(unittest.TestCase):
    def test_F2_pages(self):
        text = (ROOT / ".github/workflows/pages.yml").read_text()
        self.assertIn("python scripts/build_site.py", text)
        self.assertRegex(text, r"path: +_site\s")
        self.assertIn('python-version: "3.12"', text)
        self.assertLess(text.index("actions/checkout"), text.index("actions/setup-python"))
        self.assertLess(text.index("python scripts/build_site.py"), text.index("actions/upload-pages-artifact"))

    def test_F6_update_limits(self):
        text = (ROOT / ".github/workflows/update.yml").read_text()
        self.assertRegex(text, r"(?m)^concurrency:\n  group: update-catalog\n  cancel-in-progress: false$")
        self.assertRegex(text, r"(?m)^    timeout-minutes: 30$")
        self.assertIn('cron: "0,30 * * * *"', text)

    def test_F7_readme(self):
        text = (ROOT / "README.md").read_text()
        for stale in ("1 時間ごと", "data/videos.json", "最大500件"):
            self.assertNotIn(stale, text)
        for current in ("30分", "分割 JSON", "data/videos-N.json", "data/cards-N.json", "data/catalog.json",
                        "26.5万件", "27パート", "最新ページ（100件）", "未完了の履歴ページ", "段階的", "build_site.py", "部分失敗"):
            self.assertIn(current, text)
