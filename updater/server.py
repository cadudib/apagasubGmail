#!/usr/bin/env python3
"""Loopback-only updater for the unpacked Apaga Sub extension."""

from __future__ import annotations

import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(os.environ.get("APAGASUB_ROOT", "/opt/extchrome/apagasub")).resolve()
HOST = os.environ.get("APAGASUB_UPDATER_HOST", "127.0.0.1")
PORT = int(os.environ.get("APAGASUB_UPDATER_PORT", "17853"))
ORIGIN_PATTERN = re.compile(r"^chrome-extension://[a-p]{32}$")
UPDATE_LOCK = threading.Lock()


def current_version() -> str:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    return str(manifest["version"])


def run_update() -> dict[str, object]:
    before = current_version()
    commands = [ROOT / "scripts" / "update.sh", ROOT / "scripts" / "deploy-site.sh"]
    output: list[str] = []
    for command in commands:
        result = subprocess.run(
            [str(command)],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=240,
        )
        output.append(result.stdout.strip())
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "falha sem detalhes").strip()[-1600:]
            raise RuntimeError(detail)
    after = current_version()
    return {
        "ok": True,
        "beforeVersion": before,
        "version": after,
        "updated": before != after,
        "message": "Atualização instalada. A extensão será recarregada.",
        "log": "\n".join(part for part in output if part)[-2000:],
    }


class UpdateHandler(BaseHTTPRequestHandler):
    server_version = "ApagaSubUpdater"

    def allowed_origin(self) -> str | None:
        origin = self.headers.get("Origin", "")
        return origin if ORIGIN_PATTERN.fullmatch(origin) else None

    def send_json(self, status: int, payload: dict[str, object], origin: str | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def require_extension_origin(self) -> str | None:
        origin = self.allowed_origin()
        if not origin:
            self.send_json(403, {"ok": False, "error": "Origem da extensão não autorizada."})
        return origin

    def do_OPTIONS(self) -> None:  # noqa: N802
        origin = self.require_extension_origin()
        if not origin:
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        origin = self.require_extension_origin()
        if not origin:
            return
        if self.path != "/health":
            self.send_json(404, {"ok": False, "error": "Rota não encontrada."}, origin)
            return
        self.send_json(200, {"ok": True, "version": current_version(), "busy": UPDATE_LOCK.locked()}, origin)

    def do_POST(self) -> None:  # noqa: N802
        origin = self.require_extension_origin()
        if not origin:
            return
        if self.path != "/update":
            self.send_json(404, {"ok": False, "error": "Rota não encontrada."}, origin)
            return
        if int(self.headers.get("Content-Length", "0")) != 0:
            self.send_json(400, {"ok": False, "error": "Esta operação não aceita parâmetros."}, origin)
            return
        if not UPDATE_LOCK.acquire(blocking=False):
            self.send_json(409, {"ok": False, "error": "Uma atualização já está em andamento."}, origin)
            return
        try:
            self.send_json(200, run_update(), origin)
        except subprocess.TimeoutExpired:
            self.send_json(504, {"ok": False, "error": "A atualização excedeu o tempo limite."}, origin)
        except Exception as error:  # The response intentionally hides internal tracebacks.
            self.send_json(500, {"ok": False, "error": f"Atualização falhou: {error}"}, origin)
        finally:
            UPDATE_LOCK.release()

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"{self.client_address[0]} {format_string % args}", flush=True)


if __name__ == "__main__":
    if HOST not in {"127.0.0.1", "::1"}:
        raise SystemExit("O atualizador só pode escutar no loopback.")
    print(f"Apaga Sub updater em http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), UpdateHandler).serve_forever()
