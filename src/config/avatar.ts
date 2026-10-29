export const BLOBATAR_AVATAR_BATCH_SIZE = 12;
export const BLOBATAR_INITIAL_AVATAR_COUNT = 12;
// The picker has one leading choice (Google photo or default Blobatar), so
// 99 generated choices keeps the full grid at 100 items.
export const BLOBATAR_MAX_AVATAR_COUNT = 99;

export type AvatarKey = `blobatar-v2-${string}`;

export const getBlobatarAvatarChoice = (index: number) => {
  const number = index + 1;
  return {
    key: `blobatar-v2-${String(number).padStart(2, "0")}` as AvatarKey,
    label: `Blobatar ${number}`,
  };
};

export const isAvatarKey = (value?: string | null): value is AvatarKey =>
  typeof value === "string" &&
  /^blobatar-v2-(?:0[1-9]|[1-9]\d{0,8})$/.test(value);

export const getBlobatarAvatarChoiceIndex = (value?: string | null) =>
  isAvatarKey(value) ? Number(value.slice("blobatar-v2-".length)) - 1 : -1;

export const getAvatarSeed = (userId: string, avatarKey?: string | null) =>
  `diagramwise:blobatar:v2:${userId}:${isAvatarKey(avatarKey) ? avatarKey : "default"}`;
