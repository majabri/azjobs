/**
 * EventBus — typed publish/subscribe over the platform_events Supabase table.
 *
 * Schema (platform_events):
 *   id            uuid PRIMARY KEY
 *   event_type    text NOT NULL
 *   payload       jsonb NOT NULL DEFAULT '{}'
 *   source_service text NOT NULL
 *   created_at    timestamptz DEFAULT now()
 *   processed_at  timestamptz
 *   status        text CHECK (status IN ('pending','processed','failed'))
 *
 * Usage:
 *   await EventBus.publish({ eventType: 'job.analyzed', payload: { jobId }, sourceService: 'matching-service' });
 *   const channel = EventBus.subscribe('job.analyzed', (event) => { ... });
 *   channel.unsubscribe(); // cleanup
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface PlatformEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  source_service: string;
  created_at: string;
  processed_at: string | null;
  status: "pending" | "processed" | "failed";
}

export interface PublishOptions {
  eventType: string;
  payload: Record<string, unknown>;
  sourceService: string;
}

export type EventCallback = (event: PlatformEvent) => void;

export class EventBus {
  /**
   * Publish an event to the platform_events table.
   * Returns the inserted row id, or null on failure.
   */
  static async publish({
    eventType,
    payload,
    sourceService,
  }: PublishOptions): Promise<string | null> {
    const { data, error } = await supabase
      .from("platform_events")
      .insert([
        {
          event_type: eventType,
          payload,
        } as any,
      ])
      .select("id")
      .single();

    if (error) {
      logger.error(`[EventBus] Failed to publish "${eventType}":`, error);
      return null;
    }

    logger.debug(`[EventBus] Published "${eventType}" (id=${data.id})`);
    return data.id;
  }

  /**
   * Subscribe to a specific event type via Supabase Realtime.
   * Returns the channel (call .unsubscribe() to clean up).
   */
  static subscribe(eventType: string, callback: EventCallback) {
    const channelName = `event-bus:${eventType}:${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "platform_events",
          filter: `event_type=eq.${eventType}`,
        },
        (change) => {
          const event = change.new as PlatformEvent;
          logger.debug(`[EventBus] Received "${eventType}" (id=${event.id})`);
          callback(event);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.debug(`[EventBus] Subscribed to "${eventType}"`);
        } else if (status === "CHANNEL_ERROR") {
          logger.error(`[EventBus] Subscription error for "${eventType}"`);
        }
      });

    return channel;
  }

  /**
   * Mark an event as processed (or failed).
   */
  static async markProcessed(
    id: string,
    status: "processed" | "failed" = "processed",
  ): Promise<void> {
    const { error } = await supabase
      .from("platform_events")
      .update({ status, processed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      logger.error(
        `[EventBus] Failed to mark event ${id} as ${status}:`,
        error,
      );
    }
  }

  /**
   * Fetch recent events of a given type (for debugging/admin views).
   */
  static async getRecent(
    eventType: string,
    limit = 50,
  ): Promise<PlatformEvent[]> {
    const { data, error } = await supabase
      .from("platform_events")
      .select("*")
      .eq("event_type", eventType)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        `[EventBus] Failed to fetch recent "${eventType}" events:`,
        error,
      );
      return [];
    }

    return (data ?? []) as PlatformEvent[];
  }
}

export default EventBus;
