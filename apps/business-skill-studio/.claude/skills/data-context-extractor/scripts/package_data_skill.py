#!/usr/bin/env python3
"""
Package a generated data analysis skill into a distributable .skill file (zip format).

Usage:
    python package_data_skill.py <path/to/skill-folder> [output-directory]

Example:
    python package_data_skill.py /home/claude/acme-data-analyst
    python package_data_skill.py /home/claude/acme-data-analyst /tmp/outputs
"""

import sys
import zipfile
from pathlib import Path


def validate_skill(skill_path: Path) -> tuple[bool, str]:
    """Basic validation of skill structure."""

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "Missing SKILL.md"

    content = skill_md.read_text()
    if not content.startswith("---"):
        return False, "SKILL.md missing YAML frontmatter"

    if "name:" not in content[:500]:
        return False, "SKILL.md missing 'name' in frontmatter"
    if "description:" not in content[:1000]:
        return False, "SKILL.md missing 'description' in frontmatter"

    if "[PLACEHOLDER]" in content or "[COMPANY]" in content:
        return False, "SKILL.md contains unfilled placeholder text"

    return True, "Validation passed"


def package_skill(skill_path: str, output_dir: str = None) -> Path | None:
    """Package a skill folder into a .skill file."""
    skill_path_obj = Path(skill_path).resolve()

    if not skill_path_obj.exists():
        print(f"Error: Skill folder not found: {skill_path_obj}")
        return None

    if not skill_path_obj.is_dir():
        print(f"Error: Path is not a directory: {skill_path_obj}")
        return None

    print("Validating skill...")
    valid, message = validate_skill(skill_path_obj)
    if not valid:
        print(f"Validation failed: {message}")
        return None
    print(f"{message}\n")

    skill_name = skill_path_obj.name
    output_path = (
        Path(output_dir).resolve()
        if output_dir
        else (skill_path_obj.parent / "dist").resolve()
    )

    try:
        output_path.relative_to(skill_path_obj)
    except ValueError:
        pass
    else:
        print(f"Error: Output directory must be outside the input skill: {output_path}")
        return None

    output_path.mkdir(parents=True, exist_ok=True)
    skill_filename = output_path / f"{skill_name}.zip"

    try:
        with zipfile.ZipFile(skill_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file_path in skill_path_obj.rglob("*"):
                if not file_path.is_file():
                    continue

                relative_file = file_path.relative_to(skill_path_obj)
                if any(part.startswith(".") for part in relative_file.parts):
                    continue
                if "__pycache__" in relative_file.parts or file_path.suffix == ".pyc":
                    continue
                if file_path.name in [".DS_Store", "Thumbs.db"]:
                    continue

                arcname = file_path.relative_to(skill_path_obj.parent)
                zipf.write(file_path, arcname)
                print(f"  Added: {arcname}")

        print(f"\nSuccessfully packaged skill to: {skill_filename}")
        return skill_filename

    except Exception as exc:
        skill_filename.unlink(missing_ok=True)
        print(f"Error creating zip file: {exc}")
        return None


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Packaging skill: {skill_path}")
    if output_dir:
        print(f"   Output directory: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
