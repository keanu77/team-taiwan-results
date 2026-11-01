import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("hourly", Path(__file__).parents[1] / "scripts/trigger-hourly.py")
hourly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hourly)
NOW = dt.datetime(2026, 11, 1, 10, 13, tzinfo=dt.timezone.utc)


class TriggerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "state"

    def test_end_date_and_dry_run_do_not_write_or_call_github(self):
        with patch.object(hourly.subprocess, "run") as run:
            self.assertIn("outside", hourly.trigger(self.path, NOW.replace(month=12)))
            self.assertIn("dry-run", hourly.trigger(self.path, NOW, dry_run=True))
            run.assert_not_called()
        self.assertFalse(self.path.exists())

    def test_success_dispatches_fixed_repo_once_per_hour_without_tokens(self):
        with patch.object(hourly.subprocess, "run", side_effect=[subprocess.CompletedProcess([], 0, "[]"), subprocess.CompletedProcess([], 0, "")]) as run:
            self.assertEqual(hourly.trigger(self.path, NOW), "workflow dispatched")
            command = run.call_args_list[1].args[0]
            self.assertEqual(command[-4:], ["--repo", hourly.REPO, "--ref", "main"])
            self.assertIn("already dispatched", hourly.trigger(self.path, NOW.replace(minute=30)))
            self.assertEqual(run.call_count, 2)
        saved = json.loads((self.path / "trigger.json").read_text())
        self.assertEqual(set(saved), {"hour", "dispatchedAt", "repo", "ref"})

    def test_active_workflow_does_not_queue_a_duplicate(self):
        with patch.object(hourly.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, '[{"status":"in_progress"}]')) as run:
            self.assertIn("already active", hourly.trigger(self.path, NOW))
            self.assertEqual(run.call_count, 1)
        self.assertFalse((self.path / "trigger.json").exists())

    def test_failed_dispatch_does_not_record_a_success(self):
        with patch.object(hourly.subprocess, "run", side_effect=[subprocess.CompletedProcess([], 0, "[]"), subprocess.CompletedProcess([], 1, "")]):
            with self.assertRaises(RuntimeError):
                hourly.trigger(self.path, NOW)
        self.assertFalse((self.path / "trigger.json").exists())


if __name__ == "__main__":
    unittest.main()
