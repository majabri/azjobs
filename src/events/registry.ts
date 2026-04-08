// src/events/registry.ts
// Event type registry — maps each event to its publisher and subscriber(s)
// bun run check:events validates that every published event has an entry here

export interface EventRegistryEntry {
  eventType: string;
  publishedBy: string;
  consumedBy: string[];
  description: string;
}

export const EVENT_REGISTRY: EventRegistryEntry[] = [
  {
    eventType: 'user.registered',
    publishedBy: 'auth-service',
    consumedBy: ['profile-service'],
    description: 'New user account created',
  },
  {
    eventType: 'job.analyzed',
    publishedBy: 'matching-service',
    consumedBy: ['recommendation-service', 'notification-service'],
    description: 'Job fit score calculated',
  },
  {
    eventType: 'application.submitted',
    publishedBy: 'auto-apply-service',
    consumedBy: ['notification-service', 'analytics-service'],
    description: 'Job application submitted via auto-apply',
  },
  {
    eventType: 'project.created',
    publishedBy: 'gig-service',
    consumedBy: ['notification-service', 'analytics-service'],
    description: 'New gig project posted by employer',
  },
  {
    eventType: 'proposal.submitted',
    publishedBy: 'proposal-service',
    consumedBy: ['notification-service'],
    description: 'Talent bid on a project',
  },
  {
    eventType: 'proposal.accepted',
    publishedBy: 'project-service',
    consumedBy: ['billing-service'],
    description: 'Employer accepted a proposal — creates escrow',
  },
  {
    eventType: 'contract.started',
    publishedBy: 'project-service',
    consumedBy: ['notification-service', 'analytics-service'],
    description: 'Contract created from accepted proposal',
  },
  {
    eventType: 'milestone.completed',
    publishedBy: 'project-service',
    consumedBy: ['billing-service'],
    description: 'Milestone approved — releases payment',
  },
  {
    eventType: 'order.placed',
    publishedBy: 'catalog-service',
    consumedBy: ['billing-service', 'notification-service'],
    description: 'Service catalog order placed',
  },
  {
    eventType: 'order.completed',
    publishedBy: 'billing-service',
    consumedBy: ['reputation-service'],
    description: 'Order completed — prompts for rating',
  },
  {
    eventType: 'service.degraded',
    publishedBy: '*',
    consumedBy: ['ai-recovery-service'],
    description: 'Service health degraded',
  },
  {
    eventType: 'service.recovered',
    publishedBy: 'ai-recovery-service',
    consumedBy: ['admin-service', 'notification-service'],
    description: 'Service recovered from degraded state',
  },
  {
    eventType: 'user.invited',
    publishedBy: 'talent-service',
    consumedBy: ['notification-service'],
    description: 'Employer invited talent to apply',
  },
  {
    eventType: 'job.posted',
    publishedBy: 'gig-service',
    consumedBy: ['notification-service', 'analytics-service'],
    description: 'Job posting published by employer',
  },
  {
    eventType: 'catalog.created',
    publishedBy: 'catalog-service',
    consumedBy: ['analytics-service'],
    description: 'New service catalog listing created',
  },
];

// Helper to get subscribers for an event type
export function getSubscribers(eventType: string): string[] {
  const entry = EVENT_REGISTRY.find(e => e.eventType === eventType);
  return entry?.consumedBy ?? [];
}

// Helper to validate all events are registered
export function validateEventType(eventType: string): boolean {
  return EVENT_REGISTRY.some(e => e.eventType === eventType);
}
