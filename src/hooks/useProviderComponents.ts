/**
 * Custom hook for fetching provider-specific components
 */

import { useState, useEffect, useCallback } from "react";
import type {
  ComponentProvider,
  ComponentCategory,
} from "../types/componentProvider";
import type { CanvasComponent } from "../types/canvas";
import { componentProviderService } from "../services/componentProviderService";
import { mapComponentsToCanvas } from "../utils/componentMapper";

interface UseProviderComponentsOptions {
  provider?: ComponentProvider;
  category?: ComponentCategory;
  enabled?: boolean;
}

export function useProviderComponents(
  options: UseProviderComponentsOptions = {},
) {
  const { provider = "all", category, enabled = true } = options;

  const [components, setComponents] = useState<CanvasComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComponents = useCallback(async () => {
    if (!enabled) {
      setComponents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;

      if (provider === "all" && !category) {
        // Fetch all components
        response = await componentProviderService.getAllComponents({
          limit: 200,
        });
      } else if (provider !== "all" && !category) {
        // Fetch by provider only
        response = await componentProviderService.getComponentsByProvider(
          provider,
          100,
        );
      } else if (category && provider === "all") {
        // Fetch by category only
        response = await componentProviderService.getComponentsByCategory(
          category,
          100,
        );
      } else {
        // Fetch with both filters
        response = await componentProviderService.getAllComponents({
          provider: provider !== "all" ? provider : undefined,
          category,
          limit: 100,
        });
      }

      const canvasComponents = mapComponentsToCanvas(response.items);
      setComponents(canvasComponents);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch components";
      setError(errorMessage);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [provider, category, enabled]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  return {
    components,
    loading,
    error,
    refetch: fetchComponents,
  };
}
