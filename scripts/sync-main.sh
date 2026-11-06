#!/usr/bin/env bash
# Sync main into a working branch. Resolve only the two generated JSON snapshots.
# Usage: bash scripts/sync-main.sh [Back-hrmcngs] [--push]
set -euo pipefail

if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  echo 'Usage: bash scripts/sync-main.sh [branch] [--push]'
  echo 'Requires a clean working tree. Code conflicts are aborted without overwriting work.'
  exit 0
fi
target_branch=Back-hrmcngs
push_changes=false
for argument in "$@"; do
  case "$argument" in
    --push) push_changes=true ;;
    --*) echo "Unknown option: $argument" >&2; exit 2 ;;
    *) target_branch="$argument" ;;
  esac
done
git check-ref-format --branch "$target_branch" >/dev/null
if [[ "$target_branch" == main ]]; then
  echo 'Choose a working branch, not main.' >&2
  exit 2
fi
cd "$(git rev-parse --show-toplevel)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Commit or stash working changes before syncing.' >&2
  exit 1
fi

merge_ref() {
  local source_ref="$1"
  if git merge --no-edit --no-commit "$source_ref"; then
    :
  else
    if ! git rev-parse --verify -q MERGE_HEAD >/dev/null; then
      echo 'Merge failed before a resolvable merge was created.' >&2
      return 1
    fi
    local path unresolved=false
    while IFS= read -r -d '' path; do
      case "$path" in
        assets/data/members.json|assets/data/repos.json) ;;
        *) unresolved=true; echo "Manual resolution required: $path" >&2 ;;
      esac
    done < <(git diff --name-only --diff-filter=U -z)
    if [[ "$unresolved" == true ]]; then
      git merge --abort
      return 1
    fi
    if ! node scripts/update-github-data.mjs; then
      git merge --abort
      echo 'Data refresh failed; merge aborted and previous data retained.' >&2
      return 1
    fi
    git add assets/data/members.json assets/data/repos.json
  fi
  if git rev-parse --verify -q MERGE_HEAD >/dev/null; then
    git diff --cached --check
    git commit -m "Merge $source_ref into $target_branch"
  fi
}

# Normal pushes preserve history. If another update wins the race, fetch and retry.
for attempt in 1 2 3; do
  git fetch origin refs/heads/main:refs/remotes/origin/main
  remote_branch=$(git ls-remote --heads origin "refs/heads/$target_branch")
  if [[ -n "$remote_branch" ]]; then
    git fetch origin "refs/heads/$target_branch:refs/remotes/origin/$target_branch"
  fi
  if git show-ref --verify --quiet "refs/heads/$target_branch"; then
    git switch "$target_branch"
  elif [[ -n "$remote_branch" ]]; then
    git switch -c "$target_branch" --track "origin/$target_branch"
  else
    git switch -c "$target_branch" origin/main
  fi
  if [[ -n "$remote_branch" ]]; then merge_ref "origin/$target_branch"; fi
  merge_ref origin/main
  if [[ "$push_changes" == false ]]; then exit 0; fi
  if git push origin "HEAD:refs/heads/$target_branch"; then exit 0; fi
  echo "Push was not accepted; refreshing remote state ($attempt/3)." >&2
done
echo 'Remote kept changing or push failed. Local commits retained; retry sync later.' >&2
exit 1
