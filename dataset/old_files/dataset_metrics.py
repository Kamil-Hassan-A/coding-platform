import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Summarize problem counts by skill, level, and difficulty",
    )
    parser.add_argument(
        "--path",
        default=Path(__file__).with_name("problem_dataset.json"),
        type=Path,
        help="Path to problem_dataset.json",
    )
    return parser.parse_args()


def normalize_key(value: str) -> str:
    return str(value or "").strip()


def main() -> None:
    args = parse_args()
    if not args.path.exists():
        raise FileNotFoundError(f"Dataset not found: {args.path}")

    data = json.loads(args.path.read_text(encoding="utf-8"))
    skills = data.get("skills", [])

    # Collect global ordering based on first appearance
    level_order: list[str] = []
    difficulty_order: list[str] = []

    def remember(order: list[str], key: str) -> None:
        if key and key not in order:
            order.append(key)

    metrics: dict[str, dict[str, dict[str, int]]] = {}

    for skill_entry in skills:
        skill_name = normalize_key(skill_entry.get("skill")) or "(unknown)"
        levels = skill_entry.get("levels") or {}
        skill_bucket = metrics.setdefault(skill_name, {})

        for level_name, difficulties in levels.items():
            level_key = normalize_key(level_name) or "(unknown)"
            remember(level_order, level_key)
            level_bucket = skill_bucket.setdefault(level_key, {})

            for difficulty_name, problems in (difficulties or {}).items():
                diff_key = normalize_key(difficulty_name) or "(unknown)"
                remember(difficulty_order, diff_key)
                count = len(problems or [])
                level_bucket[diff_key] = level_bucket.get(diff_key, 0) + count

    # Print summary
    skill_rows = []
    for skill_name in metrics.keys():
        skill_total = sum(
            sum(diffs.values()) for diffs in metrics[skill_name].values()
        )
        skill_rows.append((skill_name, skill_total))

    for skill_name, skill_total in sorted(
        skill_rows,
        key=lambda row: (-row[1], row[0].lower()),
    ):
        print(f"\nSkill: {skill_name} (total: {skill_total})")

        headers = ["Level", "Total", *difficulty_order]
        rows: list[list[str]] = []
        for level_name in level_order:
            if level_name not in metrics[skill_name]:
                continue
            diffs = metrics[skill_name][level_name]
            total = sum(diffs.values())
            row = [
                level_name,
                str(total),
                *[str(diffs.get(diff, 0)) for diff in difficulty_order],
            ]
            rows.append(row)

        if not rows:
            print("  (no levels found)")
            continue

        col_widths = [
            max(len(headers[i]), *(len(row[i]) for row in rows))
            for i in range(len(headers))
        ]

        header_line = "  " + " | ".join(
            headers[i].ljust(col_widths[i]) for i in range(len(headers))
        )
        divider = "  " + "-+-".join("-" * col_widths[i] for i in range(len(headers)))
        print(header_line)
        print(divider)
        for row in rows:
            print(
                "  "
                + " | ".join(
                    row[i].ljust(col_widths[i]) for i in range(len(headers))
                )
            )


if __name__ == "__main__":
    main()
