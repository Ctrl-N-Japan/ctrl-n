#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:---serve}"
PORT="${2:-8000}"

case "$MODE" in
  --build|--serve) ;;
  --help|-h)
    echo 'Usage: bash local-build.sh [--build | --serve [port]]'
    echo 'Default: build dist/ and preview at http://127.0.0.1:8000/'
    exit 0 ;;
  *) echo "Unknown option: $MODE (use --help)" >&2; exit 1 ;;
esac
if ! command -v python3 >/dev/null 2>&1; then
  echo 'Python 3 is required. Install it and run this script again.' >&2
  exit 1
fi
if [[ "$MODE" == --build && $# -gt 1 ]] || [[ $# -gt 2 ]]; then
  echo 'Too many arguments (use --help).' >&2
  exit 1
fi
if [[ ! "$PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$PORT < 1 || 10#$PORT > 65535 )); then
  echo 'Port must be an integer between 1 and 65535.' >&2
  exit 1
fi

# Copy only public assets. Never serve repository metadata or local config.
python3 - "$PROJECT_DIR" <<'PY'
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1])
paths = ['index.html', 'contributors', 'repo-list', 'assets']
for name in paths:
    source = root / name
    if not source.exists():
        raise SystemExit(f'Missing source: {name}')
    if source.is_symlink() or (source.is_dir() and any(p.is_symlink() for p in source.rglob('*'))):
        raise SystemExit(f'Symbolic links are not supported in build sources: {name}')
dist = root / 'dist'
if dist.is_symlink():
    raise SystemExit('dist must not be a symbolic link')
if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()
for name in paths:
    source, target = root / name, dist / name
    if source.is_dir():
        shutil.copytree(source, target)
    else:
        shutil.copy2(source, target)
print('Build complete: dist/')
PY

if [[ "$MODE" == --serve ]]; then
  echo "Preview: http://127.0.0.1:$PORT/ (stop with Ctrl+C)"
  echo 'After editing source files, stop and run this script again to rebuild.'
  exec python3 -u -m http.server "$PORT" --bind 127.0.0.1 --directory "$PROJECT_DIR/dist"
fi
