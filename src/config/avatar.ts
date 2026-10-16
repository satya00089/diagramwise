export const BLOBATAR_AVATAR_CHOICES = [
  { key: "blobatar-v2-01", label: "Blobatar 1" },
  { key: "blobatar-v2-02", label: "Blobatar 2" },
  { key: "blobatar-v2-03", label: "Blobatar 3" },
  { key: "blobatar-v2-04", label: "Blobatar 4" },
  { key: "blobatar-v2-05", label: "Blobatar 5" },
  { key: "blobatar-v2-06", label: "Blobatar 6" },
  { key: "blobatar-v2-07", label: "Blobatar 7" },
  { key: "blobatar-v2-08", label: "Blobatar 8" },
] as const;

export type AvatarKey = (typeof BLOBATAR_AVATAR_CHOICES)[number]["key"];

export const isAvatarKey = (value?: string | null): value is AvatarKey =>
  BLOBATAR_AVATAR_CHOICES.some((choice) => choice.key === value);

export const getAvatarSeed = (userId: string, avatarKey?: string | null) =>
  `diagramwise:blobatar:v2:${userId}:${isAvatarKey(avatarKey) ? avatarKey : "default"}`;
