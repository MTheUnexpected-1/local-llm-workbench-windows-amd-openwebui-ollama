import fnmatch
import os
from pathlib import Path
from typing import List

from fastapi import FastAPI, Header, HTTPException, Query

API_KEY = os.getenv("FILE_API_KEY", "")
ROOTS = [Path(p.strip()).resolve() for p in os.getenv("FILE_API_ROOTS", "/mounted").split(",") if p.strip()]
DENY_PATTERNS = [p.strip() for p in os.getenv("FILE_API_DENYLIST", "").split(",") if p.strip()]

app = FastAPI(title="Local LLM Workbench Filesystem Tool", version="1.0.0")


def _authorized(auth_header: str | None):
    if not API_KEY:
        raise HTTPException(500, "FILE_API_KEY not configured")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    if auth_header.removeprefix("Bearer ").strip() != API_KEY:
        raise HTTPException(403, "Invalid token")


def _in_allowed_roots(p: Path) -> bool:
    try:
        resolved = p.resolve()
        return any(str(resolved).startswith(str(root)) for root in ROOTS)
    except Exception:
        return False


def _is_denied(p: Path) -> bool:
    parts = p.parts
    for part in parts:
        for pattern in DENY_PATTERNS:
            if fnmatch.fnmatch(part, pattern):
                return True
    return False


@app.get("/health")
def health():
    return {"status": "ok", "roots": [str(r) for r in ROOTS]}


@app.get("/roots")
def roots(authorization: str | None = Header(default=None)):
    _authorized(authorization)
    return {"roots": [str(r) for r in ROOTS]}


@app.get("/list")
def list_directory(
    directory: str = Query(..., description="Absolute path under allowed roots"),
    authorization: str | None = Header(default=None),
):
    _authorized(authorization)
    target = Path(directory)
    if not _in_allowed_roots(target) or _is_denied(target):
        raise HTTPException(403, "Path not allowed")
    if not target.exists() or not target.is_dir():
        raise HTTPException(404, "Directory not found")

    items = []
    for entry in sorted(target.iterdir()):
        if _is_denied(entry):
            continue
        items.append({
            "name": entry.name,
            "path": str(entry),
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else None,
        })
    return {"directory": str(target), "items": items}


@app.get("/search")
def search(
    q: str,
    root: str,
    limit: int = 50,
    authorization: str | None = Header(default=None),
):
    _authorized(authorization)
    base = Path(root)
    if not _in_allowed_roots(base) or _is_denied(base):
        raise HTTPException(403, "Root not allowed")
    if not base.exists() or not base.is_dir():
        raise HTTPException(404, "Root not found")

    matches: List[dict] = []
    query = q.lower()
    for current_root, dirs, files in os.walk(base):
        if len(matches) >= limit:
            break
        current_path = Path(current_root)
        dirs[:] = [d for d in dirs if not _is_denied(current_path / d)]

        for name in files:
            path = current_path / name
            if _is_denied(path):
                continue
            if query in name.lower():
                matches.append({"name": name, "path": str(path)})
                if len(matches) >= limit:
                    break

    return {"query": q, "root": str(base), "results": matches, "count": len(matches)}
