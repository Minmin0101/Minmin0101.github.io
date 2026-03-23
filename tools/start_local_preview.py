from __future__ import annotations

import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 4000
URL = f"http://{HOST}:{PORT}/"


def preview_ready() -> bool:
    try:
        with urllib.request.urlopen(URL, timeout=1.5) as response:
            return 200 <= response.status < 500
    except Exception:
        return False


def port_in_use() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((HOST, PORT)) == 0


def start_preview_server() -> str:
    if preview_ready():
        return "existing"

    if port_in_use():
        raise RuntimeError(
            f"Port {PORT} is already occupied by another program. "
            f"Please close it first, then rerun the build script."
        )

    creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", HOST],
        cwd=ROOT,
        creationflags=creationflags,
    )

    for _ in range(40):
        if preview_ready():
            return "started"
        time.sleep(0.25)

    raise RuntimeError(f"Preview server did not become ready at {URL}")


def main() -> int:
    open_browser = "--no-browser" not in sys.argv[1:]
    try:
        state = start_preview_server()
    except RuntimeError as exc:
        print(f"Preview start failed: {exc}", file=sys.stderr)
        return 1

    if state == "started":
        print(f"Local preview started: {URL}")
    else:
        print(f"Local preview already running: {URL}")

    if open_browser:
        webbrowser.open(URL)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
