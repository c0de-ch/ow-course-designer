#!/usr/bin/env bash
# Prints the app version for a build of the current commit: the version in
# package.json with its patch raised by one for every commit since that
# version was set. Each merge to main is one commit, so each deploy gets the
# next patch (1.0.0 → 1.0.1 → …); bumping package.json (the Release
# workflow) starts counting again from the new version.
# Needs the full history (actions/checkout with fetch-depth: 0).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  echo "version.sh: shallow clone, fetch the full history" >&2
  exit 1
fi

base=$(node -p 'require("./package.json").version')
since=$(git log -1 --format=%H -G'"version":' -- package.json)
count=$(git rev-list --count "${since}..HEAD")

IFS=. read -r major minor patch <<<"${base%%-*}"
echo "${major}.${minor}.$((patch + count))"
