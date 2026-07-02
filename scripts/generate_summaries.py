"""Generate human-readable summaries of patch changes for affected apps.

Supports two modes:
  1. Template-based (default, no dependencies): formats existing diff data into readable text
  2. AI-enhanced (optional): uses OpenAI API for natural-language summaries when
     OPENAI_API_KEY env var is set and --ai flag is passed

Usage:
  python generate_summaries.py < input.json > output.json
  python generate_summaries.py --ai < input.json > output.json
  python generate_summaries.py --file path/to/buffer.json [--ai]
"""

import json
import os
import sys


def template_summary(app_name, badge_type, patch_diff=None, patch_count=0):
    """Generate a structured human-readable summary from existing diff data.

    Works entirely from the patch_diff structure — no AI needed.
    """
    if badge_type == "NEW APP":
        return f"{app_name}: New app with {patch_count} patches."

    if badge_type == "REMOVED APP":
        return f"{app_name}: Removed from bundle."

    if badge_type == "UPDATED APP" and patch_diff:
        parts = []

        added = patch_diff.get("patches_added", [])
        removed = patch_diff.get("patches_removed", [])
        modified = patch_diff.get("patches_modified", [])

        if added:
            names = [p["name"] for p in added]
            label = "patch" if len(names) == 1 else "patches"
            parts.append(f"added {len(names)} {label}: {', '.join(names)}")

        if removed:
            names = [p["name"] for p in removed]
            label = "patch" if len(names) == 1 else "patches"
            parts.append(f"removed {len(names)} {label}: {', '.join(names)}")

        if modified:
            for p in modified:
                name = p["name"]
                changes = p.get("changes", [])
                if changes:
                    detail = "; ".join(changes)
                    parts.append(f"modified {name} ({detail})")
                else:
                    parts.append(f"modified {name}")

        if not parts:
            return None

        return f"{app_name}: " + ". ".join(parts) + "."

    return None


def ai_summary(app_name, patch_diff, api_key):
    """Generate a natural-language summary using OpenAI API."""
    import requests

    added = patch_diff.get("patches_added", [])
    removed = patch_diff.get("patches_removed", [])
    modified = patch_diff.get("patches_modified", [])

    added_lines = "\n".join(f"  + {p['name']}: {p.get('description', 'No description')}" for p in added)
    modified_lines = "\n".join(
        f"  ~ {p['name']}: changes: {', '.join(p.get('changes', []))}" for p in modified
    )
    removed_lines = "\n".join(f"  - {p['name']}" for p in removed)

    prompt = f"""You are a changelog writer for a patch tracker. Summarize what changed for the app "{app_name}" in a patch bundle update. Keep it concise (2-4 sentences), focus on what's meaningful to users, and don't mention file names or technical internals.

Changes:
{added_lines}
{modified_lines}
{removed_lines}

Write a brief, clear summary of what changed in this update:"""

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You write concise, user-friendly changelog summaries for app patch bundle updates."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 200,
                "temperature": 0.3,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        if text:
            return f"{app_name}: {text}"
    except Exception as e:
        print(f"[AI] OpenAI API call failed for {app_name}: {e}", file=sys.stderr)

    return None


def process_entry(entry, use_ai=False, api_key=None):
    """Process a single affected_bundles entry, adding summaries to apps."""
    apps = entry.get("apps", [])
    for app in apps:
        if "summary" in app:
            continue

        patch_diff = app.get("patch_diff")
        badge_type = app.get("badge_type", "")
        patch_count = len(app.get("patches", []))

        if use_ai and api_key and patch_diff:
            summary = ai_summary(app.get("app_name", ""), patch_diff, api_key)
            if summary:
                app["summary"] = summary
                continue

        summary = template_summary(
            app.get("app_name", ""),
            badge_type,
            patch_diff,
            patch_count,
        )
        if summary:
            app["summary"] = summary

    return entry


def process_affected_bundles(bundles, use_ai=False, api_key=None):
    """Process a list of affected_bundles entries, adding summaries."""
    return [process_entry(b, use_ai, api_key) for b in bundles]


def main():
    use_ai = "--ai" in sys.argv
    file_path = None

    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--file" and i + 2 < len(sys.argv):
            file_path = sys.argv[i + 2]
        elif arg == "--ai":
            use_ai = True

    api_key = os.environ.get("OPENAI_API_KEY") if use_ai else None
    if use_ai and not api_key:
        print("[*] --ai flag passed but OPENAI_API_KEY not set. Falling back to template summaries.", file=sys.stderr)
        use_ai = False

    if file_path:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)

    if "affected_bundles" in data:
        data["affected_bundles"] = process_affected_bundles(data["affected_bundles"], use_ai, api_key)
    elif isinstance(data, list):
        data = [process_entry(b, use_ai, api_key) for b in data]

    output = json.dumps(data, indent=2, ensure_ascii=False)
    if file_path:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"[*] Summaries written to {file_path}")
    else:
        sys.stdout.write(output)


if __name__ == "__main__":
    main()
