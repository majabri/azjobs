import { logger } from "@/lib/logger";
/**
 * Analytics module for event tracking and page views
 * Provides type-safe event tracking with support for multiple analytics providers
 */

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
}

export interface AnalyticsConfig {
  enabled: boolean;
  provider?: "ga4" | "plausible" | "custom";
  trackingId?: string;
}

let config: AnalyticsConfig = {
  enabled: true,
  provider: undefined,
};

/**
 * Initialize analytics with configuration
 * @param cfg - Analytics configuration
 */
export const initAnalytics = (cfg: Partial<AnalyticsConfig> = {}): void => {
  config = { ...config, ...cfg };

  if (!config.enabled) {
    if (process.env.NODE_ENV === "development") {
      logger.info("[Analytics] Analytics disabled");
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    logger.info("[Analytics] Initialized with provider:", config.provider);
  }

  // Initialize provider-specific code here
  // Google Analytics 4
  if (config.provider === "ga4" && config.trackingId) {
    logger.info("[Analytics] GA4 initialized with ID:", config.trackingId);
  }

  // Plausible
  if (config.provider === "plausible") {
    logger.info("[Analytics] Plausible initialized");
  }
};

/**
 * Track a custom event
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
): void => {
  if (!config.enabled) {
    return;
  }

  const event: AnalyticsEvent = {
    category,
    action,
    label,
    value,
    timestamp: Date.now(),
  };

  if (process.env.NODE_ENV === "development") {
    logger.info("[Analytics Event]", event);
  }

  sendEventToProvider(event);
};

/**
 * Track a page view
 */
export const trackPageView = (path: string, title?: string): void => {
  if (!config.enabled) {
    return;
  }

  const event: AnalyticsEvent = {
    category: "page",
    action: "view",
    label: path,
    timestamp: Date.now(),
  };

  if (process.env.NODE_ENV === "development") {
    logger.info("[Page View]", { path, title, ...event });
  }

  sendEventToProvider(event);
};

/**
 * Send event to configured analytics provider
 */
const sendEventToProvider = (event: AnalyticsEvent): void => {
  if (
    config.provider === "ga4" &&
    typeof window !== "undefined" &&
    (window as any).gtag
  ) {
    (window as any).gtag("event", event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
    });
    return;
  }

  if (
    config.provider === "plausible" &&
    typeof window !== "undefined" &&
    (window as any).plausible
  ) {
    (window as any).plausible(event.action, {
      props: {
        category: event.category,
        label: event.label,
      },
    });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    logger.info("[Analytics] Event sent:", event);
  }
};

/**
 * Track user actions
 */
export const trackUserAction = (
  action: string,
  details?: Record<string, any>,
): void => {
  trackEvent("user", action, details?.page, details?.value);
};

/**
 * Track job-related actions
 */
export const trackJobAction = (
  action: "view" | "apply" | "save" | "unsave" | "share",
  jobId?: string,
): void => {
  trackEvent("job", action, jobId);
};

/**
 * Track resume-related actions
 */
export const trackResumeAction = (
  action: "view" | "update" | "generate" | "download" | "optimize",
  resumeId?: string,
): void => {
  trackEvent("resume", action, resumeId);
};

/**
 * Track cover letter actions
 */
export const trackCoverLetterAction = (
  action: "generate" | "edit" | "download" | "send",
  letterId?: string,
): void => {
  trackEvent("cover_letter", action, letterId);
};

/**
 * Track auth-related actions
 */
export const trackAuthAction = (
  action: "login" | "signup" | "logout" | "password_reset",
): void => {
  trackEvent("auth", action);
};

/**
 * Disable analytics (e.g., for privacy/opt-out)
 */
export const disableAnalytics = (): void => {
  config.enabled = false;
  if (process.env.NODE_ENV === "development") {
    logger.info("[Analytics] Disabled");
  }
};

/**
 * Enable analytics
 */
export const enableAnalytics = (): void => {
  config.enabled = true;
  if (process.env.NODE_ENV === "development") {
    logger.info("[Analytics] Enabled");
  }
};
