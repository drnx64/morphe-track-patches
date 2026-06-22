import os
import sys
import re
import argparse
import requests
from datetime import datetime

# Load env variables safely
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Manual fallback parser for .env
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    if os.path.exists(env_path):
        print("[*] python-dotenv not installed. Reading .env file manually.")
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip()
        except Exception as e:
            print(f"[-] Error reading .env manually: {e}")

def clean_markdown_headers(filepath):
    """
    Reads filepath, strips daily date headers, and cleans other headers (# / ## / ###)
    to bold format (*) so it displays cleanly in Telegram Markdown.
    """
    if not os.path.exists(filepath):
        print(f"[-] File not found: {filepath}")
        return ""
        
    cleaned_lines = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                # Remove trailing newline but keep leading spaces for list indentation
                line_str = line.rstrip('\r\n')
                stripped = line_str.strip()
                
                # 1. Skip date header (e.g. ## [YYYY-MM-DD])
                if re.match(r'^##\s+\[\d{4}-\d{2}-\d{2}\]', stripped):
                    continue
                    
                # 2. Convert other headers (e.g. ### Foo -> *Foo*)
                if stripped.startswith("#"):
                    content = re.sub(r'^#+\s*(.*)', r'*\1*', stripped)
                    # Maintain leading whitespace of the original line if any (should be 0 for headers)
                    line_str = line_str.replace(stripped, content)
                    
                cleaned_lines.append(line_str)
    except Exception as e:
        print(f"[-] Error reading file {filepath}: {e}")
        return ""
        
    return "\n".join(cleaned_lines).strip()

def send_telegram_message(title, filepath):
    tg_token = os.environ.get("TG_TOKEN")
    tg_chat = os.environ.get("TG_CHAT")
    
    if not tg_token or not tg_chat:
        print("[-] Skipping Telegram notification: TG_TOKEN or TG_CHAT is not set in environment.")
        return
        
    body = clean_markdown_headers(filepath)
    if not body:
        print("[-] Skipping Telegram notification: Message body is empty after cleaning.")
        return
        
    # Compose message
    title_bold = f"*{title}*"
    time_str = datetime.now().strftime("%H:%M:%S")
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    message_text = (
        f"📦 {title_bold}\n"
        f"🕒 Time: {time_str}\n"
        f"📅 Date: {date_str}\n\n"
        f"{body}"
    )
    
    url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
    payload = {
        "chat_id": tg_chat,
        "text": message_text,
        "parse_mode": "Markdown"
    }
    
    try:
        print(f"[+] Sending Telegram message to chat {tg_chat}...")
        response = requests.post(url, json=payload, timeout=15)
        if response.status_code == 200:
            print("[+] Telegram message sent successfully!")
        else:
            print(f"[-] Telegram API returned non-200 code: {response.status_code} - {response.text}")
    except Exception as e:
        # Wrap in try/except so network failures never crash the runner
        print(f"[-] Failed to send Telegram message due to an exception: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send changelog update via Telegram bot.")
    parser.add_argument("--title", required=True, help="Notification title")
    parser.add_argument("--filepath", required=True, help="Path to changelog markdown file")
    
    args = parser.parse_args()
    send_telegram_message(args.title, args.filepath)
