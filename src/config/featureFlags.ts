/**
 * Feature Flags Configuration
 * Allows gradual rollout of new features
 *
 * Responsibilities (Single Responsibility Principle):
 * - Define feature flags
 * - Check if features are enabled
 * - Support environment-based and localStorage overrides
 */

/**
 * Available feature flags
 */
export const FeatureFlags = {
  YJS_COLLABORATION: "yjs-collaboration",
  AUTO_SAVE: "auto-save",
  OFFLINE_MODE: "offline-mode",
  SHARE_TO_WORLD: "share-to-world",
  LEARNING_PATH_WEEKLY_MODULES: "learning-path-weekly-modules",
} as const;

export type FeatureFlag = (typeof FeatureFlags)[keyof typeof FeatureFlags];

/**
 * Default feature flag values per environment
 */
const DEFAULT_FLAGS: Record<string, Record<FeatureFlag, boolean>> = {
  development: {
    [FeatureFlags.YJS_COLLABORATION]: true,
    [FeatureFlags.AUTO_SAVE]: true,
    [FeatureFlags.OFFLINE_MODE]: false,
    [FeatureFlags.SHARE_TO_WORLD]: true,
    [FeatureFlags.LEARNING_PATH_WEEKLY_MODULES]: true,
  },
  staging: {
    [FeatureFlags.YJS_COLLABORATION]: false, // Gradual rollout
    [FeatureFlags.AUTO_SAVE]: true,
    [FeatureFlags.OFFLINE_MODE]: false,
    [FeatureFlags.SHARE_TO_WORLD]: true,
    [FeatureFlags.LEARNING_PATH_WEEKLY_MODULES]: true,
  },
  production: {
    [FeatureFlags.YJS_COLLABORATION]: false, // Not ready yet
    [FeatureFlags.AUTO_SAVE]: true,
    [FeatureFlags.OFFLINE_MODE]: false,
    [FeatureFlags.SHARE_TO_WORLD]: true,
    [FeatureFlags.LEARNING_PATH_WEEKLY_MODULES]: true,
  },
};

/**
 * Check if a feature flag is enabled
 * Priority: localStorage override > environment default
 */
export const isFeatureEnabled = (
  flag: FeatureFlag,
  environment: string = "development",
): boolean => {
  // Check localStorage override first
  const storageKey = `feature-flag-${flag}`;
  const override = localStorage.getItem(storageKey);

  if (override !== null) {
    return override === "true";
  }

  // Fall back to environment default
  const envDefaults = DEFAULT_FLAGS[environment] || DEFAULT_FLAGS.development;
  return envDefaults[flag] ?? false;
};

/**
 * Enable a feature flag via localStorage
 */
export const enableFeature = (flag: FeatureFlag): void => {
  localStorage.setItem(`feature-flag-${flag}`, "true");
};

/**
 * Disable a feature flag via localStorage
 */
export const disableFeature = (flag: FeatureFlag): void => {
  localStorage.setItem(`feature-flag-${flag}`, "false");
};

/**
 * Clear feature flag override (revert to environment default)
 */
export const clearFeatureOverride = (flag: FeatureFlag): void => {
  localStorage.removeItem(`feature-flag-${flag}`);
};

/**
 * Get all feature flags status for debugging
 */
export const getFeatureFlagsStatus = (
  environment: string = "development",
): Record<string, boolean> => {
  const status: Record<string, boolean> = {};
  for (const flag of Object.values(FeatureFlags)) {
    status[flag] = isFeatureEnabled(flag, environment);
  }
  return status;
};
