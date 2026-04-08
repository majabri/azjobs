// scripts/check-events.ts
// Validates every event type published in the codebase has a corresponding
// subscriber in src/events/registry.ts
// Run: bun run check:events

import { execSync } from 'child_process';
import { EVENT_REGISTRY } from '../src/events/registry';

const registeredTypes = new Set(EVENT_REGISTRY.map(e => e.eventType));

// Find all publishEvent calls in the codebase
const grepResult = execSync(
  "grep -r 'publishEvent' src/ --include='*.ts' --include='*.tsx' -h || true",
  { encoding: 'utf-8' }
);

const eventTypePattern = /eventType:\s*['"]([^'"]+)['"]/g;
const usedTypes = new Set<string>();
let match;

while ((match = eventTypePattern.exec(grepResult)) !== null) {
  usedTypes.add(match[1]);
}

let violations = 0;

for (const type of usedTypes) {
  if (!registeredTypes.has(type)) {
    console.error(`VIOLATION: Event type "${type}" is published but not registered in src/events/registry.ts`);
    violations++;
  }
}

for (const entry of EVENT_REGISTRY) {
  if (entry.consumedBy.length === 0) {
    console.warn(`WARNING: Event type "${entry.eventType}" has no subscribers`);
  }
}

if (violations > 0) {
  console.error(`\n${violations} event contract violation(s) found.`);
  process.exit(1);
} else {
  console.log(`✓ All ${usedTypes.size} published event types are registered. ${EVENT_REGISTRY.length} total entries in registry.`);
  }
