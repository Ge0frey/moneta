"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * Click-to-play YouTube embed. Until clicked it's a thumbnail and a button: no iframe, no YouTube
 * scripts, so the page stays fast. Uses the privacy-enhanced youtube-nocookie domain.
 */
export function VideoFacade({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-[16px] border border-line bg-surface-1">
      {playing ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 grid place-items-center"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
          />
          <span className="relative grid size-16 place-items-center rounded-full bg-primary text-fg-inverse">
            <Play className="size-6 translate-x-0.5" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
