import os
import shutil
from state_manager import ensure_dirs, DOCS_DIR, DOCS_DATA_DIR, OUTPUT_DIR, save_json


def _read_file(path):
    """Read a file from disk, returning '' if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


INDEX_HTML_PATH = os.path.join(DOCS_DIR, "index.html")
CHANGELOG_HTML_PATH = os.path.join(DOCS_DIR, "changelog.html")
STYLE_CSS_PATH = os.path.join(DOCS_DIR, "assets", "style.css")
APP_JS_PATH = os.path.join(DOCS_DIR, "assets", "app.js")


def generate_static_files():
    ensure_dirs()

    # 1. Write HTML files by reading from disk
    index_html = _read_file(INDEX_HTML_PATH)
    changelog_html = _read_file(CHANGELOG_HTML_PATH)
    style_css = _read_file(STYLE_CSS_PATH)
    app_js = _read_file(APP_JS_PATH)

    if index_html:
        with open(os.path.join(DOCS_DIR, "index.html"), "w", encoding="utf-8") as f:
            f.write(index_html)
        print("Writing index.html...")

    if changelog_html:
        with open(os.path.join(DOCS_DIR, "changelog.html"), "w", encoding="utf-8") as f:
            f.write(changelog_html)
        print("Writing changelog.html...")

    # 2. Write CSS and JS files
    assets_dir = os.path.join(DOCS_DIR, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    if style_css:
        with open(os.path.join(assets_dir, "style.css"), "w", encoding="utf-8") as f:
            f.write(style_css)
        print("Writing style.css...")

    if app_js:
        with open(os.path.join(assets_dir, "app.js"), "w", encoding="utf-8") as f:
            f.write(app_js)
        print("Writing app.js...")

    # 3. Copy changelog.json to data/changelog.json
    changelog_src = os.path.join(OUTPUT_DIR, "changelog.json")
    changelog_dest = os.path.join(DOCS_DATA_DIR, "changelog.json")
    if os.path.exists(changelog_src):
        print(f"Copying {changelog_src} to {changelog_dest}...")
        shutil.copy2(changelog_src, changelog_dest)
    else:
        save_json(changelog_dest, [])

    print("Static site generated successfully in the root directory.")


if __name__ == "__main__":
    generate_static_files()
