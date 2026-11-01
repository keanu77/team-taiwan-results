#!/usr/bin/env python3
"""Hourly Dakar workflow trigger; reuses gh login and never reads or stores tokens."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import subprocess

REPO = "keanu77/team-taiwan-results"
WORKFLOW = "sync-and-deploy.yml"


def trigger(state_dir: Path, now: dt.datetime, gh: str = "/opt/homebrew/bin/gh", dry_run: bool = False) -> str:
    now = now.astimezone(dt.timezone.utc)
    day, hour = now.strftime("%Y-%m-%d"), now.strftime("%Y-%m-%dT%H")
    if not "2026-10-29" <= day <= "2026-11-20":
        return "outside Dakar sync window"
    if dry_run:
        return f"dry-run: hourly dispatch {REPO} {WORKFLOW} main"
    state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state_dir / "trigger.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "another trigger is running"
        state_path = state_dir / "trigger.json"
        previous = json.loads(state_path.read_text()) if state_path.exists() else {}
        if previous.get("hour") == hour:
            return "already dispatched this hour"
        env = {**os.environ, "GH_PROMPT_DISABLED": "1", "GH_NO_UPDATE_NOTIFIER": "1"}
        # Do not accumulate dispatches while a previous sync/deploy is still active.
        result = subprocess.run([gh, "run", "list", "--repo", REPO, "--workflow", WORKFLOW, "--branch", "main", "--limit", "10", "--json", "status"], capture_output=True, text=True, timeout=45, env=env)
        if result.returncode:
            raise RuntimeError(f"Cannot check workflow status (exit {result.returncode}); no dispatch sent")
        active = {"queued", "in_progress", "waiting", "pending", "requested"}
        if any(run.get("status") in active for run in json.loads(result.stdout)):
            return "workflow already active; no duplicate dispatch"
        result = subprocess.run([gh, "workflow", "run", WORKFLOW, "--repo", REPO, "--ref", "main"], capture_output=True, text=True, timeout=45, env=env)
        if result.returncode:
            raise RuntimeError(f"Workflow dispatch failed (exit {result.returncode}); retry next hour")
        temp = state_path.with_suffix(".tmp")
        temp.write_text(json.dumps({"hour": hour, "dispatchedAt": now.isoformat(), "repo": REPO, "ref": "main"}) + "\n")
        temp.replace(state_path)
        return "workflow dispatched"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    try:
        print(f"{now.isoformat()} {trigger(args.state_dir, now, dry_run=args.dry_run)}", flush=True)
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"{now.isoformat()} {type(error).__name__}: {error}", flush=True)
        raise SystemExit(1)
