"use client";

import type { Member } from "@/types/trip";

interface MemberAvatarProps {
  member: Pick<Member, "name" | "color">;
  size?: "sm" | "md" | "lg";
}

export function MemberAvatar({ member, size = "md" }: MemberAvatarProps) {
  const initial = (member.name.trim()[0] || "?").toUpperCase();
  const sizeClass =
    size === "sm"
      ? "h-7 w-7 text-[11px]"
      : size === "lg"
      ? "h-11 w-11 text-sm"
      : "h-9 w-9 text-xs";

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-xl font-bold text-zinc-950 shadow-sm ring-1 ring-white/20`}
      style={{ backgroundColor: member.color }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
