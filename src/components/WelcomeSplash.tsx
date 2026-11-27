"use client";

import { useEffect, useState } from "react";
import { MapPin, Plane } from "lucide-react";
import type { Trip } from "@/types/trip";

interface WelcomeSplashProps {
  trip: Trip;
  isHydrated: boolean;
}

export function WelcomeSplash({ trip, isHydrated }: WelcomeSplashProps) {
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");

  useEffect(() => {
    if (!isHydrated) return;

    const fadeTimer = setTimeout(() => {
      setPhase("fading");
    }, 1650);

    const doneTimer = setTimeout(() => {
      setPhase("done");
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [isHydrated]);

  if (phase === "done") return null;

  return (
    <div
      onClick={() => setPhase("done")}
      role="status"
      aria-label="Welcome"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[#faf8f4] px-6 py-14 text-zinc-900 transition-opacity duration-350 ${
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 18%, rgba(56, 189, 248, 0.14), transparent 48%), radial-gradient(circle at 82% 82%, rgba(251, 146, 60, 0.14), transparent 48%)",
      }}
    >
      {/* Top Minimal Travel Wordmark */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-black text-white">
          ₹
        </span>
        <span className="text-xs font-extrabold tracking-widest uppercase text-zinc-800">
          SplitTrip
        </span>
      </div>

      {/* Centerpiece — Clean Travel Destination Welcome */}
      {isHydrated ? (
        <div className="animate-splash-reveal flex w-full max-w-sm flex-col items-center text-center">
          {/* Travel Route Arc */}
          <div className="mb-6 flex items-center gap-3 text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span className="w-12 border-t border-dashed border-stone-300" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-blue-600 shadow-sm">
              <Plane className="h-5 w-5" />
            </div>
            <span className="w-12 border-t border-dashed border-stone-300" />
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-stone-400">
            Bon Voyage
          </p>

          <h2 className="mt-2 break-words text-5xl font-black tracking-tight text-zinc-900">
            {trip.name}
          </h2>

          {trip.location && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1 text-xs font-semibold text-stone-600 shadow-sm">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              {trip.location}
            </p>
          )}
        </div>
      ) : (
        <div />
      )}

      {/* Bottom Razor-Thin Progress Line */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-32 overflow-hidden rounded-full bg-stone-200">
          <div className="animate-splash-progress h-full w-full rounded-full bg-zinc-900" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
          Your Travel Companion
        </p>
      </div>
    </div>
  );
}
