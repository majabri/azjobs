/**
 * src/events/publisher.ts
 * High-level event publisher with registry validation.
 * Delegates persistence to EventBus (platform_events table).
 */
import { EventBus } from '@/lib/eventBus';
import { validateEventType } from './registry';
import { logger } from '@/lib/logger';

interface PublishEventOptions {
  eventType: string;
  payload: Record<string, unknown>;
  sourceService: string;
}

export async function publishEvent({ eventType, payload, sourceService }: PublishEventOptions): Promise<string | null> {
  if (!validateEventType(eventType)) {
    logger.error(`[EventBus] Unknown event type: "${eventType}". Add it to src/events/registry.ts`);
    return null;
  }

  return EventBus.publish({ eventType, payload, sourceService });
}
