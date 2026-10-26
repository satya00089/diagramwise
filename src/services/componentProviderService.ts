/**
 * Component Provider Service
 * Handles API calls to fetch components from DynamoDB
 */

import type {
  ComponentProvider,
  ComponentCategory,
  ComponentDB,
  ComponentsResponse,
  QueryParams,
} from "../types/componentProvider";

export class ComponentProviderService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl || import.meta.env.VITE_API_URL || "http://localhost:3000";
  }

  /** The API accepts DynamoDB cursors as base64-encoded JSON. */
  private encodePaginationKey(key: Record<string, string>): string {
    const bytes = new TextEncoder().encode(JSON.stringify(key));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  /**
   * Get components by provider
   */
  async getComponentsByProvider(
    provider: ComponentProvider,
    limit = 100,
    minimal = false,
    lastEvaluatedKey?: Record<string, string>,
  ): Promise<ComponentsResponse> {
    try {
      const params = new URLSearchParams({
        provider: provider.toLowerCase(),
        limit: limit.toString(),
        minimal: minimal.toString(),
      });
      if (lastEvaluatedKey) {
        params.set(
          "last_evaluated_key",
          this.encodePaginationKey(lastEvaluatedKey),
        );
      }

      const response = await fetch(
        `${this.baseUrl}/api/components?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching components by provider:", error);
      throw error;
    }
  }

  /**
   * Get components by category
   */
  async getComponentsByCategory(
    category: ComponentCategory,
    limit = 100,
    lastEvaluatedKey?: Record<string, string>,
  ): Promise<ComponentsResponse> {
    try {
      const params = new URLSearchParams({
        category,
        limit: limit.toString(),
      });
      if (lastEvaluatedKey) {
        params.set(
          "last_evaluated_key",
          this.encodePaginationKey(lastEvaluatedKey),
        );
      }

      const response = await fetch(
        `${this.baseUrl}/api/components?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching components by category:", error);
      throw error;
    }
  }

  /**
   * Get all components (with pagination and filters)
   */
  async getAllComponents(
    params?: QueryParams & { minimal?: boolean },
  ): Promise<ComponentsResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params?.provider) queryParams.set("provider", params.provider);
      if (params?.category) queryParams.set("category", params.category);
      if (params?.group) queryParams.set("group", params.group);
      if (params?.search) queryParams.set("search", params.search);
      if (params?.tags) queryParams.set("tags", params.tags.join(","));
      if (params?.limit) queryParams.set("limit", params.limit.toString());
      if (params?.lastEvaluatedKey) {
        queryParams.set(
          "last_evaluated_key",
          this.encodePaginationKey(params.lastEvaluatedKey),
        );
      }
      if (params?.minimal)
        queryParams.set("minimal", params.minimal.toString());

      const response = await fetch(
        `${this.baseUrl}/api/components?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching all components:", error);
      throw error;
    }
  }

  /**
   * Search components
   */
  async searchComponents(
    query: string,
    provider?: ComponentProvider,
    category?: ComponentCategory,
  ): Promise<ComponentsResponse> {
    try {
      const params = new URLSearchParams({ search: query });
      if (provider) params.set("provider", provider);
      if (category) params.set("category", category);

      const response = await fetch(
        `${this.baseUrl}/api/components/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error searching components:", error);
      throw error;
    }
  }

  /**
   * Get component by ID
   */
  async getComponentById(id: string): Promise<ComponentDB> {
    try {
      const response = await fetch(`${this.baseUrl}/api/components/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching component by ID:", error);
      throw error;
    }
  }

  /**
   * Get multiple components in one request. Shared diagrams use this to restore
   * icons without issuing one HTTP request for every component type.
   */
  async getComponentsByIds(
    ids: string[],
    minimal = false,
  ): Promise<Array<Pick<ComponentDB, "id"> & Partial<ComponentDB>>> {
    if (ids.length === 0) return [];

    const uniqueIds = Array.from(new Set(ids));
    const batches: string[][] = [];
    for (let offset = 0; offset < uniqueIds.length; offset += 100) {
      batches.push(uniqueIds.slice(offset, offset + 100));
    }

    const results = await Promise.all(
      batches.map(async (batch) => {
        try {
          const response = await fetch(
            `${this.baseUrl}/api/components/batch/by-ids`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: batch, minimal }),
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = (await response.json()) as {
            items: Array<Pick<ComponentDB, "id"> & Partial<ComponentDB>>;
          };
          return result.items;
        } catch (error) {
          console.error("Error fetching component batch by ID:", error);
          return [];
        }
      }),
    );
    return results.flat();
  }

  /**
   * Increment usage count
   */
  async incrementUsageCount(id: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/components/${id}/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error incrementing usage count:", error);
      // Don't throw - usage tracking is non-critical
    }
  }

  /**
   * Get available providers
   */
  async getProviders(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/components/providers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching providers:", error);
      throw error;
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/components/categories`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  }
}

// Create singleton instance
export const componentProviderService = new ComponentProviderService();
