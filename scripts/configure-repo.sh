#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# configure-repo.sh - Update all GitHub owner/repo references in the project
#
# Usage:
#   ./scripts/configure-repo.sh <owner> <repo>
#
# Example (after forking to xxx/my-insign-getting-started):
#   ./scripts/configure-repo.sh xxx my-insign-getting-started
#
# What it does:
#   - Replaces every GitHub owner/repo reference (badges, Pages links,
#     deploy buttons, Maven distribution URL, etc.) so they point to
#     the given <owner>/<repo>.
#   - Skips node_modules, .git, and binary files automatically.
#   - Does NOT touch the insign-java-api Maven dependency (separate repo).
# ---------------------------------------------------------------------------
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <owner> <repo>"
  echo "Example: $0 tombueng insign-getting-started-1"
  exit 1
fi

NEW_OWNER="$1"
NEW_REPO="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Collect all tracked, non-binary files (respects .gitignore, skips node_modules)
# ---------------------------------------------------------------------------
mapfile -t FILES < <(git -C "$ROOT" ls-files -- \
  '*.md' '*.html' '*.xml' '*.yml' '*.yaml' '*.js' '*.mjs' '*.properties' '*.json' \
  | grep -v node_modules || true)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No tracked files found - are you in the right repo?"
  exit 1
fi

# ---------------------------------------------------------------------------
# Replacement pairs: OLD_PATTERN -> NEW_VALUE
#
# Order matters: more-specific patterns first to avoid partial matches.
# The insign-java-api references are intentionally excluded.
# ---------------------------------------------------------------------------
declare -a REPLACEMENTS=(
  # 1. GitHub Pages URLs  (owner.github.io/repo)
  #    Catch both possible current values
  "getinsign\.github\.io/insign-getting-started"
  "${NEW_OWNER}.github.io/${NEW_REPO}"

  "tombueng\.github\.io/insign-getting-started-1"
  "${NEW_OWNER}.github.io/${NEW_REPO}"

  # 2. GitHub repo references  (github.com/owner/repo)
  #    Exclude insign-java-api by matching only known repo names
  "github\.com/getinsign/insign-getting-started"
  "github.com/${NEW_OWNER}/${NEW_REPO}"

  "github\.com/tombueng/insign-getting-started-1"
  "github.com/${NEW_OWNER}/${NEW_REPO}"

  # 3. Deploy-button references (sig-funnel was the standalone name)
  "github\.com/tombueng/sig-funnel"
  "github.com/${NEW_OWNER}/${NEW_REPO}"

  "github/tombueng/sig-funnel"
  "github/${NEW_OWNER}/${NEW_REPO}"

  # 4. Maven pkg references  (maven.pkg.github.com/owner/repo)
  #    Again exclude insign-java-api
  "maven\.pkg\.github\.com/tombueng/insign-getting-started-1"
  "maven.pkg.github.com/${NEW_OWNER}/${NEW_REPO}"

  "maven\.pkg\.github\.com/getinsign/insign-getting-started"
  "maven.pkg.github.com/${NEW_OWNER}/${NEW_REPO}"

  # 5. shields.io badge URLs  (img.shields.io/github/<anything>/owner/repo/...)
  #    Backref \1 preserves the badge path (actions/workflow/status, stars, issues, ...)
  "(shields\.io/github/[a-zA-Z0-9_/-]+/)tombueng/insign-getting-started-1"
  "\\1${NEW_OWNER}/${NEW_REPO}"

  "(shields\.io/github/[a-zA-Z0-9_/-]+/)getinsign/insign-getting-started"
  "\\1${NEW_OWNER}/${NEW_REPO}"
)

# ---------------------------------------------------------------------------
# Apply replacements
# ---------------------------------------------------------------------------
TOTAL=0

for (( i=0; i<${#REPLACEMENTS[@]}; i+=2 )); do
  PATTERN="${REPLACEMENTS[$i]}"
  REPLACE="${REPLACEMENTS[$i+1]}"

  COUNT=0
  for f in "${FILES[@]}"; do
    FILEPATH="${ROOT}/${f}"
    [[ -f "$FILEPATH" ]] || continue
    if grep -qE "$PATTERN" "$FILEPATH" 2>/dev/null; then
      sed -i -E "s|${PATTERN}|${REPLACE}|g" "$FILEPATH"
      COUNT=$((COUNT + 1))
    fi
  done

  if [[ $COUNT -gt 0 ]]; then
    echo "  Replaced '${PATTERN}' in ${COUNT} file(s)"
    TOTAL=$((TOTAL + COUNT))
  fi
done

echo ""
if [[ $TOTAL -eq 0 ]]; then
  echo "No replacements needed - repo already configured for ${NEW_OWNER}/${NEW_REPO}."
else
  echo "Done. Updated ${TOTAL} file(s) to point to ${NEW_OWNER}/${NEW_REPO}."
  echo "Review changes with:  git diff"
fi
