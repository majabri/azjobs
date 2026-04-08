// src/events/publisher.ts
import { supabase } from '@/integrations/supabase/client';
import { validateEventType } from './registry';

interface PublishEventOptions {
  eventType: string;
  payload: Record<string, unknown>;
  sourceService: string;
}

export async function publishEvent({ eventType, payload, sourceService }: PublishEventOptions) {
  if (!validateEventType(eventType)) {
    console.error(`[EventBus] Unknown event type: ${eventType}. Add it to src/events/registry.ts`);
    return;
  }

  const { error } = await supabase
    .from('platform_events')
    .insert({
      event_type: eventType,
      payload,
      source_service: sourceService,
      status: 'pending',
    });

  if (error) {
    console.error(`[EventBus] Failed to publish ${eventType}:`, error);
    // Don't throw — event publishing should not break the caller
  }
}
