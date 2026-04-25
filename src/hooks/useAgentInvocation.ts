import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseAgentInvocationOptions {
  /**
   * Toast message shown to the user on failure.
   * If omitted, the hook stores the error in `error` state but shows no toast.
   */
  errorMessage?: string;
}

interface UseAgentInvocationReturn<T> {
  /** Call the edge function with the given body. Returns data on success, null on failure. */
  invoke: (body?: Record<string, unknown>) => Promise<T | null>;
  /** True while the request is in-flight. */
  loading: boolean;
  /** Error message from the last failed call, or null. */
  error: string | null;
  /** Clear the error state. */
  reset: () => void;
}

/**
 * Centralised wrapper for supabase.functions.invoke().
 *
 * Manages loading/error state and optionally shows a toast on failure.
 * Catches both Supabase-level errors and application-level errors embedded
 * in the response body (data.error).
 *
 * Usage:
 *   const { invoke, loading } = useAgentInvocation<MyResponseType>(
 *     "my-edge-function",
 *     { errorMessage: "Something went wrong" }
 *   );
 *   const data = await invoke({ key: value });
 *   if (data) { ... }
 *
 * NOTE: SSE streaming responses (e.g. mock-interview) require raw fetch()
 * with resp.body?.getReader() and are intentionally NOT covered by this hook.
 */
export function useAgentInvocation<T = unknown>(
  fnName: string,
  options: UseAgentInvocationOptions = {},
): UseAgentInvocationReturn<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => setError(null), []);

  const invoke = useCallback(
    async (body?: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(fnName, {
          body,
        });

        if (fnErr) throw new Error(fnErr.message || `${fnName} failed`);
        if ((data as Record<string, unknown>)?.error) {
          throw new Error(String((data as Record<string, unknown>).error));
        }

        return data as T;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : `${fnName} failed`;
        setError(msg);
        if (options.errorMessage !== undefined) {
          const description = msg !== options.errorMessage ? msg : undefined;
          toast.error(options.errorMessage, { description });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    // fnName is stable across renders; options.errorMessage is a primitive.
    [fnName, options.errorMessage],
  );

  return { invoke, loading, error, reset };
}
