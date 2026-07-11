#!/usr/bin/env python3
"""Apply the remaining reviewed PR #40 fixes as one validated transaction."""

from pathlib import Path
from textwrap import dedent


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        if new in text:
            print(f"already fixed: {path}")
            return
        raise SystemExit(f"marker not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"updated: {path}")


replace_once(
    ".github/workflows/install-claude-data-skills-once.yml",
    """permissions:
  contents: write""",
    """# This workflow commits generated files back to its source branch, so runs
# must queue rather than race at the final push.
concurrency:
  group: install-claude-data-skills-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write""",
)

replace_once(
    "apps/business-skill-studio/.claude/skills/build-dashboard/SKILL.md",
    """                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                      const pct = ((context.parsed / total) * 100).toFixed(1);
                                      return `${context.label}: ${formatValue(context.parsed, 'number')} (${pct}%)`;""",
    """                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                      const pct = total > 0
                                          ? ((context.parsed / total) * 100).toFixed(1)
                                          : '0.0';
                                      return `${context.label}: ${formatValue(context.parsed, 'number')} (${pct}%)`;""",
)

package_script = Path(
    "apps/business-skill-studio/.claude/skills/data-context-extractor/scripts/package_data_skill.py"
)
package_script.write_text(
    dedent(
        '''\
        #!/usr/bin/env python3
        """Package a generated data analysis skill into a distributable zip."""

        import sys
        import zipfile
        from pathlib import Path


        def validate_skill(skill_path: Path) -> tuple[bool, str]:
            skill_md = skill_path / "SKILL.md"
            if not skill_md.exists():
                return False, "Missing SKILL.md"

            content = skill_md.read_text(encoding="utf-8")
            if not content.startswith("---"):
                return False, "SKILL.md missing YAML frontmatter"
            if "name:" not in content[:500]:
                return False, "SKILL.md missing 'name' in frontmatter"
            if "description:" not in content[:1000]:
                return False, "SKILL.md missing 'description' in frontmatter"
            if "[PLACEHOLDER]" in content or "[COMPANY]" in content:
                return False, "SKILL.md contains unfilled placeholder text"
            return True, "Validation passed"


        def is_within(path: Path, parent: Path) -> bool:
            return path == parent or parent in path.parents


        def package_skill(skill_path: str, output_dir: str = None) -> Path | None:
            skill_path = Path(skill_path).resolve()
            if not skill_path.exists():
                print(f"Error: Skill folder not found: {skill_path}")
                return None
            if not skill_path.is_dir():
                print(f"Error: Path is not a directory: {skill_path}")
                return None

            print("Validating skill...")
            valid, message = validate_skill(skill_path)
            if not valid:
                print(f"Validation failed: {message}")
                return None
            print(f"{message}\n")

            skill_name = skill_path.name
            output_path = (
                Path(output_dir).resolve()
                if output_dir
                else (skill_path.parent / "dist").resolve()
            )
            if is_within(output_path, skill_path):
                print(f"Error: Output directory must be outside the input skill: {output_path}")
                return None

            output_path.mkdir(parents=True, exist_ok=True)
            skill_filename = output_path / f"{skill_name}.zip"
            temporary_filename = output_path / f".{skill_name}.zip.tmp"
            temporary_filename.unlink(missing_ok=True)

            try:
                with zipfile.ZipFile(temporary_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
                    for file_path in skill_path.rglob("*"):
                        if not file_path.is_file():
                            continue

                        relative_file = file_path.relative_to(skill_path)
                        if any(part.startswith(".") for part in relative_file.parts):
                            continue
                        if "__pycache__" in relative_file.parts:
                            continue
                        if file_path.suffix == ".pyc":
                            continue
                        if file_path.name in [".DS_Store", "Thumbs.db"]:
                            continue

                        arcname = file_path.relative_to(skill_path.parent)
                        zipf.write(file_path, arcname)
                        print(f"  Added: {arcname}")

                temporary_filename.replace(skill_filename)
                print(f"\nSuccessfully packaged skill to: {skill_filename}")
                return skill_filename
            except Exception as error:
                temporary_filename.unlink(missing_ok=True)
                skill_filename.unlink(missing_ok=True)
                print(f"Error creating zip file: {error}")
                return None


        def main() -> None:
            if len(sys.argv) < 2:
                raise SystemExit("Usage: package_data_skill.py <skill-folder> [output-directory]")

            skill_path = sys.argv[1]
            output_dir = sys.argv[2] if len(sys.argv) > 2 else None
            print(f"Packaging skill: {skill_path}")
            if output_dir:
                print(f"   Output directory: {output_dir}")
            print()

            result = package_skill(skill_path, output_dir)
            raise SystemExit(0 if result else 1)


        if __name__ == "__main__":
            main()
        '''
    ),
    encoding="utf-8",
)
print(f"updated: {package_script}")

replace_once(
    "apps/business-skill-studio/.claude/skills/explore-data/SKILL.md",
    """**All columns:**
- Null count and null rate
- Distinct count and cardinality ratio (distinct / total)
- Most common values (top 5-10 with frequencies)
- Least common values (bottom 5 to spot anomalies)""",
    """**All columns:**
- Null count and null rate
- Distinct count and cardinality ratio (distinct / total)
- Apply the existing column classification before sampling values
- For non-sensitive columns, show most common values (top 5-10 with frequencies) and least common values (bottom 5)
- For sensitive columns (emails, names, identifiers, credentials, or free-form text), omit or redact raw values; hash or bucket identifiers where distribution insight is needed
- Require explicit user opt-in before displaying raw sensitive samples. Treat upstream MCP masking as sufficient only when the connector contract explicitly guarantees it""",
)
replace_once(
    "apps/business-skill-studio/.claude/skills/explore-data/SKILL.md",
    """| Column | Type | Description | Example Values | Notes |
|--------|------|-------------|----------------|-------|
| user_id | STRING | Unique user identifier | "usr_abc123" | FK to users.id |
| event_type | STRING | Type of event | "click", "view", "purchase" | 15 distinct values |
| revenue | DECIMAL | Transaction revenue in USD | 29.99, 149.00 | Null for non-purchase events |
| created_at | TIMESTAMP | When the event occurred | 2024-01-15 14:23:01 | Partitioned on this column |""",
    """| Column | Type | Description | Example Values (non-sensitive only) | Notes |
|--------|------|-------------|----------------|-------|
| user_id | STRING | Unique user identifier | `[redacted identifier]` | FK to users.id; hash or bucket unless raw display is explicitly approved |
| event_type | STRING | Type of event | "click", "view", "purchase" | 15 distinct values |
| revenue | DECIMAL | Transaction revenue in USD | 29.99, 149.00 | Null for non-purchase events |
| created_at | TIMESTAMP | When the event occurred | 2024-01-15 14:23:01 | Partitioned on this column |

Only include raw example values for columns classified as non-sensitive. Redact sensitive text, hash or bucket identifiers, and require explicit opt-in before exposing raw samples.""",
)

replace_once(
    "apps/business-skill-studio/.claude/skills/statistical-analysis/SKILL.md",
    """```python
z_scores = (df['value'] - df['value'].mean()) / df['value'].std()
outliers = df[abs(z_scores) > 3]  # More than 3 standard deviations
```""",
    """```python
standard_deviation = df['value'].std()
if pd.isna(standard_deviation) or standard_deviation == 0:
    # Constant, singleton, or all-null inputs have no meaningful z-score outliers.
    outliers = df.iloc[0:0]
else:
    z_scores = (df['value'] - df['value'].mean()) / standard_deviation
    outliers = df[abs(z_scores) > 3]  # More than 3 standard deviations
```""",
)

replace_once(
    "apps/business-skill-studio/.claude/skills/validate-data/SKILL.md",
    "**How to prevent**: Always aggregate from raw data. Never average pre-aggregated averages.",
    "**How to prevent**: Aggregate from raw data when available. Otherwise, combine pre-aggregated averages using the appropriate group-size weights; never take an unweighted average of averages.",
)
replace_once(
    "apps/business-skill-studio/.claude/skills/write-query/SKILL.md",
    "- Prefer `EXISTS` over `IN` for subqueries with large result sets",
    "- Choose `IN` or `EXISTS` based on semantics, NULL handling, and the SQL dialect's query plan; benchmark when performance is material",
)
