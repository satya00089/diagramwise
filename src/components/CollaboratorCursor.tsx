import React from "react";
import { motion } from "framer-motion";
import UserAvatar from "./UserAvatar";

interface CollaboratorCursorProps {
  userId: string;
  name: string;
  color: string;
  position: { x: number; y: number };
  pictureUrl?: string;
  avatarKey?: string | null;
}

export const CollaboratorCursor: React.FC<CollaboratorCursorProps> = ({
  userId,
  name,
  color,
  position,
  pictureUrl,
  avatarKey,
}) => {
  return (
    <motion.div
      className="pointer-events-none absolute z-50"
      style={{
        left: position.x,
        top: position.y,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.2 }}
    >
      {/* Cursor pointer */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
      >
        <path
          d="M5.5 3.21V20.79L10.29 16L14 21.5L15.5 20.5L11.79 15L18.5 14L5.5 3.21Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name tag */}
      <div
        className="ml-6 -mt-2 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg flex items-center gap-1.5"
        style={{ backgroundColor: color }}
      >
        <UserAvatar
          userId={userId}
          picture={pictureUrl}
          avatarKey={avatarKey}
          size={16}
          alt=""
          className="w-4 h-4 rounded-full border border-white/50 object-cover"
        />
        <span>{name}</span>
      </div>
    </motion.div>
  );
};
