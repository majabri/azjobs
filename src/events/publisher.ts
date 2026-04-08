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
    .from('service_events')
    .insert([{
      event_name: eventType,
      payload: payload as any,
      emitted_by: sourceService,
      processed: false,
    }]);

  if (error) {
    console.error(`[EventBus] Failed to publish ${eventType}:`, error);
  }
}
