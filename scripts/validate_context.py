import argparse
from pathlib import Path


REQUIRED_FILES = [
    ".context/README.md",
    ".context/master-plan.md",
    ".context/current-status.md",
    ".context/task-breakdown.md",
    ".context/work-log.md",
    ".context/bug-log.md",
    ".context/decisions.md",
    ".context/risk-register.md",
]


def main():
    parser = argparse.ArgumentParser(description="Validate the project .context files.")
    parser.add_argument("--project-root", default=".", help="Project root directory")
    args = parser.parse_args()

    project_root = Path(args.project_root)
    missing = [path for path in REQUIRED_FILES if not (project_root / path).is_file()]

    if missing:
        raise SystemExit(f"missing context files: {', '.join(missing)}")

    empty = [path for path in REQUIRED_FILES if not (project_root / path).read_text(encoding="utf-8").strip()]

    if empty:
        raise SystemExit(f"empty context files: {', '.join(empty)}")

    print("context is valid")


if __name__ == "__main__":
    main()
