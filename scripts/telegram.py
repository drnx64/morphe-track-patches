"""Telegram notification sender with multi-message support.

Posts changelog updates to a channel. Supports splitting long content into
multiple messages and editing them in-place on subsequent runs.

Requires TG_TOKEN and TG_CHAT env vars.

Usage:
    python scripts/telegram.py                          # auto-generated from temp/whats-new.json
    python scripts/telegram.py "path/to/file.md"       # custom file (single chunk)
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

import config  # noqa: F401  — loads .env (TG_TOKEN/TG_CHAT) when run standalone

STATE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "state")
LAST_MSG_PATH = os.path.join(STATE_DIR, "last_tg_msg.json")

STALE_EDIT_ERRORS = (
    "message to edit not found",
    "message can't be edited",
    "MESSAGE_ID_INVALID",
)


def _load_last_msg():
    try:
        with open(LAST_MSG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "message_id" in data and "messages" not in data:
            data = {
                "date": data.get("date", ""),
                "messages": [{"message_id": data["message_id"], "chunk": 0}],
            }
        return data
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_last_msg(data):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LAST_MSG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f)


def _tg_api(method, payload, token):
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _send_message(chat_id, text, token):
    result = _tg_api("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }, token)
    if result.get("ok"):
        return result["result"]["message_id"]
    raise RuntimeError(f"Telegram API error: {result.get('description', result)}")


def _utc_stamp():
    return datetime.now(timezone.utc).strftime("%I:%M %p").lstrip("0") + " UTC"


def _truncate(text, limit=4096):
    if len(text) <= limit:
        return text
    cut = text.rfind("\n", 0, limit - 32)
    return (text[:cut] if cut > 0 else text[:limit - 32]) + "\n\n\u2026 truncated"


def _edit_message(chat_id, message_id, text, token):
    """Edit a message.

    Returns "ok" (edited, or already identical), "stale" (message is gone and
    should be forgotten) or "retry" (transient — keep the ID and try again).
    """
    try:
        result = _tg_api("editMessageText", {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }, token)
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace")
        if "message is not modified" in body:
            return "ok"
        if any(marker in body for marker in STALE_EDIT_ERRORS):
            return "stale"
        return "retry"
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return "retry"
    return "ok" if result.get("ok") else "retry"


def _delete_message(chat_id, message_id, token):
    try:
        _tg_api("deleteMessage", {
            "chat_id": chat_id,
            "message_id": message_id,
        }, token)
        return True
    except Exception:
        return False


def send_or_edit(chunks, token=None, chat_id=None):
    """Send or edit a multi-message changelog.

    Args:
        chunks: list[str] — each chunk is one Telegram message.
        token: Telegram bot token (or env TG_TOKEN).
        chat_id: Telegram chat ID (or env TG_CHAT).

    Returns:
        True on success, False on failure.
    """
    token = token or os.environ.get("TG_TOKEN", "")
    chat_id = chat_id or os.environ.get("TG_CHAT", "")

    if not token or not chat_id:
        print("[-] TG_TOKEN or TG_CHAT not set, skipping Telegram")
        return False

    if isinstance(chunks, str):
        chunks = [chunks]

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    stamp = _utc_stamp()
    last = _load_last_msg()
    existing = last.get("messages", []) if last.get("date") == today else []
    remaining_existing = list(existing)

    result_messages = []

    for i, chunk in enumerate(chunks):
        is_last = i == len(chunks) - 1
        msg_entry = next((m for m in remaining_existing if m.get("chunk") == i), None)
        text = chunk

        if msg_entry:
            remaining_existing.remove(msg_entry)
            # Only a rewrite of an already-delivered message carries the stamp,
            # and only the last one does.
            if is_last:
                text = f"{chunk}\n\n<i>Updated {stamp}</i>"

            outcome = _edit_message(chat_id, msg_entry["message_id"], _truncate(text), token)
            if outcome == "ok":
                print(f"[+] Edited message {msg_entry['message_id']} (chunk {i})")
                result_messages.append({"message_id": msg_entry["message_id"], "chunk": i})
                continue
            if outcome == "retry":
                print(f"[-] Transient edit failure for {msg_entry['message_id']}, will retry")
                result_messages.append({"message_id": msg_entry["message_id"], "chunk": i})
                continue
            print(f"[-] Message {msg_entry['message_id']} is gone, resending chunk {i}")

        try:
            msg_id = _send_message(chat_id, _truncate(text), token)
            print(f"[+] Sent message {msg_id} (chunk {i})")
            result_messages.append({"message_id": msg_id, "chunk": i})
        except Exception as e:
            print(f"[-] Send failed for chunk {i}: {e}")

    # Delete leftover messages that are no longer needed
    for msg_entry in remaining_existing:
        _delete_message(chat_id, msg_entry["message_id"], token)
        print(f"[+] Deleted stale message {msg_entry['message_id']}")

    # chat_id is deliberately not persisted: this file is tracked in git and
    # copied verbatim into the public site build.
    _save_last_msg({
        "date": today,
        "messages": result_messages,
    })

    return True


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "temp", "whats-new.json")

    if not os.path.exists(filepath):
        print(f"[*] No file to send (no changes): {filepath}")
        return 0

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    chunks = data.get("chunks", []) if isinstance(data, dict) else []
    if not chunks:
        print("[*] No chunks found in file (no changes to notify)")
        return 0

    success = send_or_edit(chunks)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
