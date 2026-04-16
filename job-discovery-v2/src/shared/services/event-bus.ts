// =============================================================================
// iCareerOS — Platform Event Bus
// Centralised publish/subscribe for all microservices.
// All inter-service communication goes through platform_events in Supabase.
// No direct cross-service imports allowed.
//
// Event types:
//   job.fetched             — raw job stored (Sourcing → Extraction)
//   job.extracted           — extraction complete (Extraction → Dedup)
//   job.deduped             — dedup complete (Dedup → Matching)
//   job.scored              — profile match done (Matching → UI)
//   extraction.low_confidence — confidence < 0.70, use Claude fallback
//   accuracy.degraded       — source accuracy < 80%, retrain prompt
//   batch.fetch_started     — pg_cron triggered fetch
//   batch.extract_started   — pg_cron triggered extraction
//   batch.dedup_started     — pg_cron triggered dedup
//   batch.score_started     — pg_cron triggered scoring
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type EventType =
  | 'job.fetched'
  | 'job.extracted'
  | 'job.deduped'
  | 'job.scored'
  | 'extraction.low_confidence'
  | 'accuracy.degraded'
  | 'batch.fetch_started'
  | 'batch.extract_started'
  | 'batch.dedup_started'
  | 'batch.score_started'
  | string  // extensible

export interface PlatformEvent {
  event_type: EventType
  payload: Record<string, unknown>
  published_at?: Date
}

export interface EventRecord extends PlatformEvent {
  id: string
  consumed_by: string[]
  created_at: string
}

class EventBus {
  private supabase: SupabaseClient

  constructor() {
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('[EventBus] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    this.supabase = createClient(url, key)
  }

  /** Publish an event — fire-and-forget. Throws on DB error. */
  async publish(event: PlatformEvent): Promise<string> {
    const { data, error } = await this.supabase
      .from('platform_events')
      .insert({
        event_type: event.event_type,
        payload: event.payload,
        published_at: event.published_at ?? new Date(),
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[EventBus] publish failed for ${event.event_type}:`, error.message)
      throw error
    }

    console.log(`[EventBus] ✓ ${event.event_type} (${data.id})`)
    return data.id
  }

  /** Batch publish — more efficient than multiple publish() calls. */
  async publishBatch(events: PlatformEvent[]): Promise<void> {
    if (events.length === 0) return

    const rows = events.map(e => ({
      event_type: e.event_type,
      payload: e.payload,
      published_at: e.published_at ?? new Date(),
    }))

    const { error } = await this.supabase.from('platform_events').insert(rows)
    if (error) {
      console.error(`[EventBus] batch publish failed:`, error.message)
      throw error
    }

    console.log(`[EventBus] ✓ Batch published ${events.length} events`)
  }

  /**
   * Poll for unconsumed events of a given type since a given timestamp.
   * Used by batch processors — they call this every N seconds.
   *
   * @param eventType   The event type to listen for
   * @param consumerName Unique name of this consumer (stored in consumed_by)
   * @param since       Only return events published after this timestamp
   */
  async poll(
    eventType: EventType,
    consumerName: string,
    since: Date = new Date(Date.now() - 1000 * 60 * 60)  // default: last 1 hour
  ): Promise<EventRecord[]> {
    const { data, error } = await this.supabase
      .from('platform_events')
      .select('*')
      .eq('event_type', eventType)
      .gte('published_at', since.toISOString())
      .not('consumed_by', 'cs', JSON.stringify([consumerName]))
      .order('published_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error(`[EventBus] poll failed:`, error.message)
      throw error
    }

    return (data ?? []) as EventRecord[]
  }

  /**
   * Mark events as consumed by a given service.
   * Call this AFTER successfully processing the event.
   */
  async markConsumed(eventIds: string[], consumerName: string): Promise<void> {
    if (eventIds.length === 0) return

    // Use SQL to append consumerName to consumed_by array
    const { error } = await this.supabase.rpc('mark_events_consumed', {
      p_event_ids: eventIds,
      p_consumer: consumerName,
    })

    if (error) {
      // Non-fatal — event will just be reprocessed
      console.warn(`[EventBus] markConsumed failed (non-fatal):`, error.message)
    }
  }

  /**
   * Realtime subscription (Supabase Realtime channels).
   * Use for latency-sensitive handlers; use poll() for batch jobs.
   *
   * @returns Unsubscribe function
   */
  subscribe(
    eventType: EventType,
    handler: (event: EventRecord) => Promise<void>
  ): () => void {
    const channel = this.supabase
      .channel(`events:${eventType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'platform_events',
          filter: `event_type=eq.${eventType}`,
        },
        async (change) => {
          try {
            await handler(change.new as EventRecord)
          } catch (err) {
            console.error(`[EventBus] handler error for ${eventType}:`, err)
          }
        }
      )
      .subscribe()

    return () => {
      this.supabase.removeChannel(channel)
    }
  }
}

// SQL helper function — run this in Supabase migrations if using markConsumed()
export const MARK_CONSUMED_SQL = `
CREATE OR REPLACE FUNCTION mark_events_consumed(p_event_ids uuid[], p_consumer text)
RETURNS void AS $$
BEGIN
  UPDATE platform_events
  SET consumed_by = array_append(consumed_by, p_consumer)
  WHERE id = ANY(p_event_ids)
    AND NOT (p_consumer = ANY(consumed_by));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

// Singleton — import this in all services
export const eventBus = new EventBus()
