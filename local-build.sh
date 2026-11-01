#!/usr/bin/env bash
# Bash の書き方メモ（「#」以降はコメントとして扱われます）
# 実行例: bash local-build.sh --build       → dist/ を生成
#         bash local-build.sh --serve 8080  → 生成して指定ポートでプレビュー
#         bash local-build.sh --help        → 使い方を表示
# 変数: NAME="値" のように = の前後に空白を入れず代入し、"$NAME" で参照します。
# 引数: $1 は1番目、$2 は2番目、$# は引数の数です。
# 引用: "..." 内では変数を展開し、'...' 内では文字をそのまま扱います。
# パスや変数は通常 "$NAME" と引用し、空白による分割を防ぎます。

# -e: コマンド失敗時に終了（条件判定内などは例外あり）。
# -u: 未定義変数の参照をエラーにする。pipefail: パイプ途中の失敗も検出する。
set -euo pipefail

# $(...) はコマンドの出力を取得します。BASH_SOURCE[0] はこのファイルのパスです。
# && は直前のコマンドが成功したときだけ、次のコマンドを実行します。
PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# ${変数:-既定値} は変数が未設定または空なら既定値を使います。
# ${1:---serve} の既定値は「--serve」です。
MODE="${1:---serve}"
PORT="${2:-8000}"

# case ... in ... esac で値ごとに分岐します。| は候補の区切り、;; は分岐の終わりです。
# * はその他すべてに一致します。exit 0 は正常終了、exit 1 は異常終了です。
case "$MODE" in
  --build|--serve) ;;
  --help|-h)
    echo 'Usage: bash local-build.sh [--build | --serve [port]]'
    echo 'Default: build dist/ and preview at http://127.0.0.1:8000/'
    exit 0 ;;
  *) echo "Unknown option: $MODE (use --help)" >&2; exit 1 ;;
esac
# if 条件; then ... fi で条件分岐します。! は成功・失敗を反転します。
# command -v はコマンドの有無を確認します。
# >/dev/null は標準出力を捨て、2>&1 は標準エラーも同じ出力先へ送ります。
# >&2 はメッセージを標準エラーへ出力します。
if ! command -v python3 >/dev/null 2>&1; then
  echo 'Python 3 is required. Install it and run this script again.' >&2
  exit 1
fi
# [[ ... ]] は条件判定です。== は文字列比較、-gt は数値の「より大きい」です。
# && は両方、|| はどちらかの条件が成立した場合に真になります。
if [[ "$MODE" == --build && $# -gt 1 ]] || [[ $# -gt 2 ]]; then
  echo 'Too many arguments (use --help).' >&2
  exit 1
fi
# =~ は正規表現による照合です。ここでは1〜5桁の数字か確認します。
# (( ... )) は数値の演算・比較です。10# は先頭が0でも10進数として扱います。
if [[ ! "$PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$PORT < 1 || 10#$PORT > 65535 )); then
  echo 'Port must be an integer between 1 and 65535.' >&2
  exit 1
fi

# 公開用ファイルだけをコピーし、Git の管理情報やローカル設定を配信対象に含めません。
# <<'PY' はヒアドキュメントです。次の行から終端の PY までを標準入力に渡します。
# 終端名を引用すると Bash の変数展開を抑止できます。終端の PY は行頭に書きます。
# python3 - は標準入力のコードを実行し、"$PROJECT_DIR" は Python 側の引数になります。
# 以下、終端の PY までは Bash ではなく Python のコードです。
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
  # exec は現在のシェルを指定コマンドに置き換えます。
  exec python3 -u -m http.server "$PORT" --bind 127.0.0.1 --directory "$PROJECT_DIR/dist"
fi
