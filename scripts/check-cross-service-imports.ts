#!/usr/bin/env node
/**
 * Cross-Service Import Guardrail
 *
 * Validates that no service imports runtime logic from another service.
 * Type-only imports (`import type`) are permitted — they carry no runtime behavior.
 * Shared utilities must live in src/shared/ and may be imported by any service.
 *
 * Usage: npx tsx scripts/check-cross-service-imports.ts
 * Exit code 0 = clean, 1 = violations found.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const SRC_SERVICES = join(process.cwd(), "src", "services");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkFiles(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

function getServiceName(filePath: string): string | null {
  const rel = relative(SRC_SERVICES, filePath);
  const parts = rel.split("/");
  if (parts.length < 1) return null;
  return parts[0]; // e.g. "job", "matching", "user"
}

// ─── Violation Detection ──────────────────────────────────────────────────────

// Matches: import ... from "@/services/<name>/..."
// Captures: [fullMatch, importKeyword, serviceName]
const CROSS_SERVICE_RE = /^(import(?:\s+type)?)\s+.*?from\s+["']@\/services\/([^/'"]+)/gm;

interface Violation {
  file: string;
  line: number;
  statement: string;
  fromService: string;
}

const violations: Violation[] = [];

for (const file of walkFiles(SRC_SERVICES)) {
  const ownerService = getServiceName(file);
  if (!ownerService) continue;

  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");

  let match: RegExpExecArray | null;
  const re = new RegExp(CROSS_SERVICE_RE.source, "gm");

  while ((match = re.exec(content)) !== null) {
    const importKeyword = match[1].trim();
    const fromService = match[2];

    // Allow: import from own service
    if (fromService === ownerService) continue;

    // Allow: `import type` — type-only imports carry no runtime logic
    if (importKeyword === "import type") continue;

    // Violation: runtime import from another service
    const lineIndex = content.slice(0, match.index).split("\n").length - 1;
    violations.push({
      file: relative(process.cwd(), file),
      line: lineIndex + 1,
      statement: lines[lineIndex]?.trim() ?? match[0],
      fromService,
    });
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log("✅  No cross-service import violations found.");
  process.exit(0);
} else {
  console.error(`❌  ${violations.length} cross-service import violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    → ${v.statement}`);
    console.error(`    (imports from service "${v.fromService}")\n`);
  }
  console.error(
    "Fix: move shared types/utilities to src/shared/, use `import type` for type-only\n" +
    "cross-service references, or route calls through the shell orchestrator."
  );
  process.exit(1);
}
