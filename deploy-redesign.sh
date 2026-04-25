#!/bin/bash
# iCareerOS — Deploy JBS Visual Redesign to Production
# Run from the repo root: bash deploy-redesign.sh

set -e

REPO="/Users/amirjabri/Library/CloudStorage/GoogleDrive-jabrisolutions@gmail.com/My Drive/Projects/iCareerOS/code/security-fixes-repo"
cd "$REPO"

echo "▶ Cleaning stale git locks..."
rm -f .git/index.lock .git/HEAD.lock

echo "▶ Switching to main..."
git checkout main

echo "▶ Merging dev (redesign commit) into main..."
git merge dev --no-ff --no-verify -m "merge: JBS dark redesign from dev"

echo "▶ Pushing to GitHub (triggers Vercel production deploy)..."
git push origin main

echo "✅ Done — Vercel will deploy in ~60 seconds."
echo "   Watch: https://vercel.com/jabri-solutions"
