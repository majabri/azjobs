#!/usr/bin/env bash
# scripts/check-soa.sh
# SOA boundary checker for iCareerOS.
#
# Rules enforced:
#   R1  Pages (src/pages) must not import other pages
#   R2  Service logic (.ts, not page .tsx) must not import from components
#   R3  lib must not import from top-level src/services (absolute @/services/)
#   R4  lib must not import from src/pages
#   R5  events layer must not import from components
#
# Run: bun run check:soa

set -euo pipefail

PASS=0
FAIL=0

# $1=rule-id  $2=grep-pattern  $3=scope  $4=file-glob  $5=description
check() {
  local rule="$1"
  local pattern="$2"
  local scope="$3"
  local glob="$4"
  local description="$5"

  matches=$(grep -rn --include="$glob" "$pattern" "$scope" 2>/dev/null || true)

  if [ -n "$matches" ]; then
    echo "❌  $rule — $description"
    echo "$matches" | head -10 | sed 's/^/     /'
    FAIL=$((FAIL+1))
  else
    echo "✅  $rule — $description"
    PASS=$((PASS+1))
  fi
}

echo ""
echo "iCareerOS — SOA Boundary Check"
echo "================================"
echo ""

# R1: Pages must not import other pages
check \
  "R1" \
  "from ['\"]\.\.\/pages\/" \
  "src/pages" \
  "*.{ts,tsx}" \
  "Pages must not import other pages"

# R2: Service LOGIC files (.ts only, not page .tsx) must not import from components.
#     Pages within services (src/services/*/pages/*.tsx) are allowed to import
#     React components — only pure TS service logic is checked here.
check \
  "R2" \
  "from ['\"]@\/components\/" \
  "src/services" \
  "*.ts" \
  "Service logic (.ts) must not import from @/components"

# R3: lib must not import from top-level src/services (avoids circular deps).
#     Note: src/lib/services/ (local sub-directory) is fine; only @/services/ is blocked.
check \
  "R3" \
  "from ['\"]@\/services\/" \
  "src/lib" \
  "*.ts" \
  "lib must not import from @/services (keeps lib portable)"

# R4: lib must not import from pages
check \
  "R4" \
  "from ['\"]@\/pages\/" \
  "src/lib" \
  "*.ts" \
  "lib must not import from @/pages"

# R5: events layer must not import from components
check \
  "R5" \
  "from ['\"]@\/components\/" \
  "src/events" \
  "*.ts" \
  "events layer must not import from @/components"

echo ""
echo "--------------------------------"
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "⚠️  Fix violations before merging to main."
  exit 1
else
  echo "✅  All SOA boundaries clean."
  exit 0
fi
