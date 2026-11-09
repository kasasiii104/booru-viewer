import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_posts as fetch


class FetchPostsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1])
        self.addCleanup(self.tmp.cleanup)
        self.data = Path(self.tmp.name)
        for name, value in (("DATA", self.data), ("STATE", self.data / "state.json"),
                            ("VIDEOS", self.data / "videos.json"), ("PART", 2),
                            ("DANBOORU_TAGS", ("test",)), ("GEL_TAGS", ("test",)), ("STEP", 2)):
            mock = patch.object(fetch, name, value)
            mock.start()
            self.addCleanup(mock.stop)
        for mock in (patch.dict(os.environ, {}, clear=True), patch.object(fetch.time, "sleep"),
                     patch.object(fetch.urllib.request, "urlopen", side_effect=AssertionError("network forbidden"))):
            mock.start()
            self.addCleanup(mock.stop)
        self.state = {"history": {}}

    def items(self, count):
        return [{"source": "danbooru", "source_id": i, "tags": ["3d", "video"],
                 "rating": "e", "file_url": f"https://example.invalid/{i}.mp4",
                 "character_tags": ["日本語"]} for i in range(count)]

    def test_F3_numeric_roundtrip_and_no_writes(self):
        items = self.items(25)
        fetch.save(items, self.state)
        before = {p.name: p.read_bytes() for p in self.data.iterdir()}
        mtimes = {p.name: p.stat().st_mtime_ns for p in self.data.iterdir()}
        loaded, state = fetch.load()
        self.assertEqual(loaded, items)
        self.assertEqual(fetch.save(loaded, state), [])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.data.iterdir()})
        self.assertEqual(mtimes, {p.name: p.stat().st_mtime_ns for p in self.data.iterdir()})

    def test_F3_append_changes_tail_and_catalog_only(self):
        fetch.save(self.items(25), self.state)
        self.assertEqual(set(fetch.save(self.items(26), self.state)),
                         {"videos-13.json", "cards-13.json", "catalog.json"})

    def test_F3_versions_match_serialized_cards(self):
        fetch.save(self.items(25), self.state)
        catalog = json.loads((self.data / "catalog.json").read_text())
        self.assertEqual(catalog["parts"], [f"cards-{i}.json" for i in range(1, 14)])
        for name in catalog["parts"]:
            self.assertEqual(catalog["versions"][name],
                             hashlib.sha1((self.data / name).read_bytes()).hexdigest()[:12])

    def test_F4_danbooru_failed_responses_keep_numeric_and_done(self):
        for cursor in (7, "done"):
            for payload in (None, {"error": "bad request"}):
                with self.subTest(cursor=cursor, payload=payload):
                    state = {"history": {"danbooru": {"test": cursor}}}
                    with patch.object(fetch, "get", return_value=payload):
                        self.assertEqual(fetch.danbooru(state), [])
                    self.assertEqual(state["history"]["danbooru"]["test"], cursor)

    def test_F4_empty_list_completes_history(self):
        with patch.object(fetch, "get", return_value=[]):
            fetch.danbooru(self.state)
        self.assertEqual(self.state["history"]["danbooru"]["test"], "done")

    def test_F4_partial_results_survive_failure(self):
        row = {"id": 1, "file_ext": "mp4", "tag_string": "3d video", "rating": "e",
               "file_url": "https://example.invalid/a.mp4"}
        state = {"history": {"danbooru": {"test": 5}}}
        with patch.object(fetch, "get", side_effect=[[row], None]), patch.object(fetch, "wanted", return_value=True):
            found = fetch.danbooru(state)
        self.assertEqual(len(found), 1)
        self.assertEqual(state["history"]["danbooru"]["test"], 5)

    def test_F4_gelbooru_failure_keeps_cursor(self):
        with patch.dict(os.environ, {"USER": "u", "KEY": "k"}):
            for cursor in (5, "done"):
                state = {"history": {"gelbooru": {"test": cursor}}}
                with patch.object(fetch, "get", return_value=None):
                    fetch.gelbooru_like("gelbooru", "https://example.invalid", "USER", "KEY", state)
                self.assertEqual(state["history"]["gelbooru"]["test"], cursor)

    def run_main(self, payload, credentials=True):
        summary = self.data / "summary.md"
        summary.write_text("existing summary\n")
        env = {"GITHUB_STEP_SUMMARY": str(summary)}
        if credentials:
            env.update({"GELBOORU_USER_ID": "u", "GELBOORU_API_KEY": "k",
                        "RULE34_USER_ID": "u", "RULE34_API_KEY": "k"})
        output = io.StringIO()
        code = 0
        with patch.dict(os.environ, env), patch.object(fetch, "get", side_effect=payload), \
                patch.object(fetch, "cache_thumbs"), contextlib.redirect_stdout(output):
            try:
                fetch.main()
            except SystemExit as exc:
                code = exc.code
        return code, output.getvalue(), summary.read_text()

    def test_F3_main_logs_changed_filenames(self):
        with patch.object(fetch, "save", return_value=["cards-27.json", "videos-27.json"]):
            code, output, _ = self.run_main([[], [], []])
        self.assertEqual(code, 0)
        self.assertIn("saved 2 changed files: cards-27.json, videos-27.json", output)

    def test_F5_all_failed_exits_after_save(self):
        code, output, summary = self.run_main([None, None, None])
        self.assertEqual(code, 1)
        self.assertTrue(fetch.STATE.exists())
        for source in ("danbooru", "gelbooru", "rule34"):
            self.assertIn(f"{source}: ok=0 failed=1 skipped=0", output)
        self.assertNotIn("failed", fetch.STATE.read_text())

    def test_F5_partial_success_warning_and_summary(self):
        code, output, summary = self.run_main([[], None, None])
        self.assertEqual(code, 0)
        self.assertIn("::warning::", output)
        self.assertIn("danbooru: ok=1 failed=0 skipped=0", output)
        self.assertTrue(summary.startswith("existing summary\n"))
        self.assertIn("| danbooru | 1 | 0 | 0 |", summary)
        self.assertIn("| gelbooru | 0 | 1 | 0 |", summary)

    def test_F5_missing_credentials_skipped_per_query(self):
        with patch.object(fetch, "GEL_TAGS", ("first", "second")):
            code, output, summary = self.run_main([None], credentials=False)
        self.assertEqual(code, 1)
        self.assertIn("gelbooru: ok=0 failed=0 skipped=2", output)
        self.assertIn("rule34: ok=0 failed=0 skipped=1", output)
        self.assertIn("| rule34 | 0 | 0 | 1 |", summary)

    def test_F5_all_success_no_warning(self):
        code, output, summary = self.run_main([[], [], []])
        self.assertEqual(code, 0)
        self.assertNotIn("::warning::", output)

    def test_F6_thumb_budget_preserves_cached_previews(self):
        thumbs = self.data / "thumbs"
        thumbs.mkdir()
        for key in ("cached_before", "cached_after", "other_host"):
            (thumbs / f"{key}.jpg").write_bytes(b"x" * 201)
        keys = ["cached_before", "failed", "unattempted", "cached_after", "other_host"]
        items = [{"source": "gelbooru", "md5": key,
                  "preview_url": f"https://gelbooru.com/{key}.jpg"} for key in keys]
        items[-1]["preview_url"] = "https://example.invalid/image.jpg"
        output = io.StringIO()
        with patch.object(fetch.time, "monotonic", side_effect=[100, 100, 701]), \
                patch.object(fetch.urllib.request, "urlopen", side_effect=OSError("offline")) as request, \
                contextlib.redirect_stdout(output):
            fetch.cache_thumbs(items)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(request.call_args.args[0].full_url, "https://gelbooru.com/failed.jpg")
        self.assertIn("thumb budget exhausted after 1 attempts", output.getvalue())
        for index in (0, 3, 4):
            self.assertEqual(items[index]["preview_url"], f"data/thumbs/{keys[index]}.jpg")
        self.assertEqual(items[2]["preview_url"], "https://gelbooru.com/unattempted.jpg")

    def test_F3_workflow_push_only_after_commit(self):
        text = (Path(__file__).resolve().parents[1] / ".github/workflows/update.yml").read_text()
        step = text.split("- name: commit catalog", 1)[1].split("      - name:", 1)[0]
        self.assertIn('if ! git diff --staged --quiet; then', step)
        conditional = step.split('if ! git diff --staged --quiet; then', 1)[1].split('fi', 1)[0]
        self.assertLess(conditional.index('git commit'), conditional.index('git pull --rebase origin main'))
        self.assertLess(conditional.index('git pull'), conditional.index('git push'))
        self.assertEqual(step.count('git push'), 1)


if __name__ == "__main__":
    unittest.main()
