#!/usr/bin/env python3
"""Append a markdown operation playbook to a business-domain operations file."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("snippet", help="Markdown snippet file to append")
    parser.add_argument(
        "--domain",
        default="activity-management",
        help="Business domain file name without .md, for example offline-user-manage",
    )
    parser.add_argument(
        "--operations",
        default=None,
        help="Path to a specific operations markdown file",
    )
    args = parser.parse_args()

    snippet_path = Path(args.snippet)
    operations_path = (
        Path(args.operations)
        if args.operations
        else Path(__file__).resolve().parents[1]
        / "references"
        / "operations"
        / f"{args.domain}.md"
    )
    snippet = snippet_path.read_text(encoding="utf-8").strip()
    if not snippet:
        raise SystemExit("Snippet is empty.")
    if "<PASSWORD>" not in snippet and "password" in snippet.lower():
        raise SystemExit("Use <PASSWORD> placeholder instead of real password text.")
    if "<GOOGLE_CODE>" not in snippet and "google" in snippet.lower() and "code" in snippet.lower():
        raise SystemExit("Use <GOOGLE_CODE> placeholder instead of real Google code text.")

    current = operations_path.read_text(encoding="utf-8") if operations_path.exists() else f"# {args.domain.replace('-', ' ').title()} Operations\n"
    separator = "\n\n" if current.endswith("\n") else "\n\n"
    operations_path.write_text(current.rstrip() + separator + snippet + "\n", encoding="utf-8")
    print(f"Appended operation to {operations_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
