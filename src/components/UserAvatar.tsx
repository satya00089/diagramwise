import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Blobatar } from "@blobatar/react";
import "blobatar/motion.css";
import { getAvatarSeed, isAvatarKey } from "../config/avatar";

type UserAvatarProps = {
  userId: string;
  picture?: string | null;
  avatarKey?: string | null;
  size?: number;
  className?: string;
  alt?: string;
  style?: CSSProperties;
  animate?: "hover" | "always";
};

const UserAvatar = ({
  userId,
  picture,
  avatarKey,
  size = 32,
  className,
  alt = "",
  style,
  animate,
}: UserAvatarProps) => {
  const [pictureFailed, setPictureFailed] = useState(false);
  const selectedAvatarKey = isAvatarKey(avatarKey) ? avatarKey : null;

  useEffect(() => setPictureFailed(false), [picture]);

  if (!selectedAvatarKey && picture && !pictureFailed) {
    return (
      <img
        src={picture}
        alt={alt}
        width={size}
        height={size}
        className={className}
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setPictureFailed(true)}
      />
    );
  }

  return (
    <Blobatar
      name={getAvatarSeed(userId, selectedAvatarKey)}
      size={size}
      background={false}
      className={className}
      alt={alt}
      style={style}
      animate={animate}
    />
  );
};

export default UserAvatar;
