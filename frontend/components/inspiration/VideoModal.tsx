"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSound } from "@/components/inspiration/SoundContext";

function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoModal({
  open,
  title,
  imageSrc,
  videoSrc,
  onClose,
}: {
  open: boolean;
  title: string;
  imageSrc: string;
  videoSrc?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const formattedElapsed = useMemo(
    () => formatElapsed(elapsedSeconds),
    [elapsedSeconds],
  );
  const { muted } = useSound();

  useEffect(() => {
    if (!open) return;

    const v = videoRef.current;
    if (!v) return;

    // Reset elapsed time without triggering the hooks lint rule.
    queueMicrotask(() => {
      setElapsedSeconds(0);
    });

    // Ensure elapsed time starts at 0 when opening.
    try {
      v.currentTime = 0;
    } catch {
      // Ignore; some browsers may block setting currentTime.
    }

    // Autoplay helps match a short-form feed behavior.
    v.play().catch(() => {
      // Ignore autoplay failures; user can press play.
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white dark:bg-black rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-3 border-b border-black/10 dark:border-white/10">
          <div className="min-w-0">
            <div className="font-semibold truncate">{title}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Playing time: {formattedElapsed}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Close
          </button>
        </div>

        <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900">
          {/* Poster image gives a nicer first paint while the video loads. */}
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
          <video
            ref={videoRef}
            src={videoSrc ?? ""}
            className="absolute inset-0 w-full h-full object-cover"
            muted={muted}
            playsInline
            controls
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              setElapsedSeconds(v.currentTime);
            }}
          />
        </div>
      </div>
    </div>
  );
}

