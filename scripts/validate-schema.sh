#!/usr/bin/env bash
# validate-schema.sh — Pre-deploy schema alignment checker
# Prevents incidents like ICR-2026-04-25-001 (NULL constraint violation in agent_runs)
#
# Usage:
#   bash scripts/validate-schema.sh              # run manually
#   npm run validate:schema                      # via package.json script
#   (also called automatically by GitHub Actions on every PR)
#
# Exit codes: 0 = PASSED, 1 = FAILED (merge blocked)

set -euo pipefail

PASS=0
FAIL=0
WARNINGS=()
ERRORS=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "================================================================"
echo "  iCareerOS Pre-Deploy Schema Validation"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
echo ""

# ──────────────────────────────────────────────────────────────────
# CHECK 1: agent_runs INSERT statements have counter field initialization
# Root cause of ICR-2026-04-25-001
#
# Strategy: look for files where .from("agent_runs") is chained with
# .insert( on the same or adjacent line. This avoids false positives
# from files that SELECT or DELETE from agent_runs but also happen to
# call .insert() on other tables (e.g. watchdog-service, admin-manage-user).
# ──────────────────────────────────────────────────────────────────
echo -e "${BLUE}[CHECK 1]${NC} agent_runs INSERT — counter field initialization..."

# Find files that specifically chain .from("agent_runs") → .insert(
# Uses a 5-line context window: the .from and .insert must appear within
# 5 lines of each other in the same file.
FILES_WITH_ACTUAL_INSERT=""
for candidate in $(grep -rln '"agent_runs"' supabase/functions/ src/ 2>/dev/null || true); do
  if grep -qP '\.from\(.*agent_runs|pgPost\(.*agent_runs|INSERT INTO.*agent_runs' "$candidate" 2>/dev/null || \
     grep -q "from(\"agent_runs\")" "$candidate" 2>/dev/null; then
    if awk '
      /\.from\(.*agent_runs|pgPost\(.*agent_runs|INSERT INTO.*agent_runs|from\("agent_runs"\)/ { found=NR }
      found && NR<=found+5 && /\.insert\(/ { exit 0 }
      END { exit 1 }
    ' "$candidate" 2>/dev/null; then
      FILES_WITH_ACTUAL_INSERT="$FILES_WITH_ACTUAL_INSERT $candidate"
    fi
  fi
done

if [ -n "$FILES_WITH_ACTUAL_INSERT" ]; then
  for file in $FILES_WITH_ACTUAL_INSERT; do
    if ! grep -q "jobs_found" "$file"; then
      ERRORS+=("$file: inserts into agent_runs but does NOT set jobs_found — constraint violation risk!")
      ((FAIL++)) || true
    else
      echo -e "  ${GREEN}✅${NC} $file — jobs_found initialization found"
      ((PASS++)) || true
    fi
  done
else
  echo -e "  ${GREEN}✅${NC} No agent_runs INSERT patterns found"
  ((PASS++)) || true
fi

# ──────────────────────────────────────────────────────────────────
# CHECK 2: New migrations declare DEFAULT values on numeric columns
# ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[CHECK 2]${NC} New migrations — numeric columns have DEFAULT values..."

MIGRATION_DIR="supabase/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  # Look at recently modified migrations (last 7 days or changed files from env)
  if [ -n "${CHANGED_FILES:-}" ]; then
    RECENT_MIGRATIONS=$(echo "$CHANGED_FILES" | tr ' ' '\n' | grep "supabase/migrations" || true)
  else
    RECENT_MIGRATIONS=$(find "$MIGRATION_DIR" -name "*.sql" -newer "$MIGRATION_DIR" -mtime -7 2>/dev/null || true)
  fi

  if [ -n "$RECENT_MIGRATIONS" ]; then
    for migration in $RECENT_MIGRATIONS; do
      # Check for INTEGER/BIGINT columns without DEFAULT
      BARE_INTEGERS=$(grep -nE "^\s+\w+\s+(integer|bigint|int|smallint)\s*," "$migration" \
        | grep -v "DEFAULT\|default\|REFERENCES\|--" || true)

      if [ -n "$BARE_INTEGERS" ]; then
        WARNINGS+=("$migration: numeric columns without DEFAULT — consider adding DEFAULT 0 if used in CHECK constraints:")
        while IFS= read -r line; do
          WARNINGS+=("  Line: $line")
        done <<< "$BARE_INTEGERS"
        echo -e "  ${YELLOW}⚠️${NC}  $migration — numeric columns missing DEFAULT (see warnings)"
      else
        echo -e "  ${GREEN}✅${NC} $migration — numeric columns OK"
        ((PASS++)) || true
      fi
    done
  else
    echo -e "  ${GREEN}✅${NC} No new migrations in the last 7 days"
    ((PASS++)) || true
  fi
else
  echo -e "  ${YELLOW}⚠️${NC}  supabase/migrations/ directory not found — skipping migration checks"
fi

# ──────────────────────────────────────────────────────────────────
# CHECK 3: Edge functions don't use raw fetch() for non-SSE calls
# ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[CHECK 3]${NC} Edge functions — raw fetch() vs supabase.functions.invoke()..."

RAW_FETCH_VIOLATIONS=$(grep -rn "fetch(.*VITE_SUPABASE_URL\|fetch(.*functions/v1" \
  src/ 2>/dev/null | grep -v "mock-interview\|career-path-analysis\|recruiter-assistant\|//\|\.test\." || true)

if [ -n "$RAW_FETCH_VIOLATIONS" ]; then
  for violation in "$RAW_FETCH_VIOLATIONS"; do
    ERRORS+=("Raw fetch() to edge function (use supabase.functions.invoke instead): $violation")
    ((FAIL++)) || true
  done
else
  echo -e "  ${GREEN}✅${NC} No raw fetch() violations found"
  ((PASS++)) || true
fi

# ──────────────────────────────────────────────────────────────────
# CHECK 4: TypeScript compiles cleanly (if tsc is available)
# ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[CHECK 4]${NC} TypeScript typecheck..."

if command -v npx &>/dev/null && [ -f "tsconfig.json" ]; then
  if npx tsc --noEmit --skipLibCheck 2>&1 | tail -5; then
    echo -e "  ${GREEN}✅${NC} TypeScript: 0 errors"
    ((PASS++)) || true
  else
    ERRORS+=("TypeScript compilation failed — fix type errors before merging")
    ((FAIL++)) || true
  fi
else
  echo -e "  ${YELLOW}⚠️${NC}  tsc not available or no tsconfig.json — skipping"
fi

# ──────────────────────────────────────────────────────────────────
# RESULTS
# ──────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  RESULTS"
echo "================================================================"

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}WARNINGS (non-blocking):${NC}"
  for w in "${WARNINGS[@]}"; do
    echo -e "  ${YELLOW}⚠️${NC}  $w"
  done
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}ERRORS (merge blocked):${NC}"
  for e in "${ERRORS[@]}"; do
    echo -e "  ${RED}❌${NC} $e"
  done
fi

echo ""
echo -e "  Checks passed: ${GREEN}${PASS}${NC}"
echo -e "  Checks failed: ${RED}${FAIL}${NC}"
echo -e "  Warnings:      ${YELLOW}${#WARNINGS[@]}${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ PRE-DEPLOY VALIDATION FAILED — resolve errors above before merging${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ PRE-DEPLOY VALIDATION PASSED${NC}"
  echo ""
  exit 0
fi
