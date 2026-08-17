export const FEATURE_FLAG_KEYS = [
  'PUBLIC_CATALOG',
  'PUBLIC_SUBMISSION',
  'VOTING',
  'RESULTS',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type AdminSettings = Record<FeatureFlagKey, boolean>;
