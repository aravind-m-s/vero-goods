'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SafeImage as Image } from '@/shared/ui/safe-image';
import { Play } from 'lucide-react';
import type { ProductImage, ProductVideo } from '@/features/catalog/types';
import { cn } from '@/shared/lib/utils';

/**
 * Gallery for images and videos.
 *
 * A video URL is either an embeddable share link (YouTube/Vimeo) or a direct
 * media file. Nothing else is trusted: an unrecognised URL is not rendered as
 * an iframe, so a pasted link cannot turn the page into an arbitrary frame.
 */
type MediaItem =
  | { kind: 'image'; id: string; url: string; alt: string }
  | { kind: 'video'; id: string; url: string; embedUrl?: string; poster?: string; title: string };

export function toEmbedUrl(rawUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return undefined;
  }

  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
    }
    if (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
    }
  }
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : undefined;
  }
  if (host === 'player.vimeo.com') return rawUrl;

  return undefined;
}

/**
 * Same embed, told to start playing.
 *
 * Muted as well, because that is the only kind of unattended start a browser
 * permits inside a cross-origin frame — an embed asked to autoplay with sound
 * is simply refused, and the shopper gets a still frame instead of a video.
 * `mute` is YouTube's spelling, `muted` is Vimeo's; each ignores the other's.
 */
function withAutoplay(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('mute', '1');
    url.searchParams.set('muted', '1');
    return url.toString();
  } catch {
    return embedUrl;
  }
}

export function ProductMedia({
  productTitle,
  images,
  videos,
  badge,
}: {
  productTitle: string;
  images: ProductImage[];
  videos: ProductVideo[];
  /** Rendered over the top-left of the stage, e.g. a discount or stock chip. */
  badge?: React.ReactNode;
}) {
  const items: MediaItem[] = [
    ...images.map((image) => ({
      kind: 'image' as const,
      id: image.id,
      url: image.url,
      alt: image.alt ?? productTitle,
    })),
    ...videos.map((video) => ({
      kind: 'video' as const,
      id: video.id,
      url: video.url,
      embedUrl: toEmbedUrl(video.url),
      poster: video.thumbnailUrl,
      title: video.title ?? `${productTitle} video`,
    })),
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  /** Where a horizontal drag started, so touchend can measure how far it went. */
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  /**
   * Autoplay is earned by a tap on a thumbnail, never granted on load.
   *
   * A product whose first media item is a video would otherwise start playing
   * at people who only opened the page — and on the first paint the video is
   * competing with the LCP image for the connection. Once a shopper has picked
   * a thumbnail, playing what they picked is the whole point.
   */
  const [autoplay, setAutoplay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = items[activeIndex];

  /**
   * Wraps, so the gallery is a ring rather than a line.
   *
   * A shopper at the last item who swipes on is asking for more media, and the
   * only more there is starts again at the first.
   */
  const showItem = (index: number) => {
    if (items.length === 0) return;
    setActiveIndex(((index % items.length) + items.length) % items.length);
    setAutoplay(true);
  };

  /**
   * Swipe, distinguished from a scroll.
   *
   * The gesture only counts once it has travelled far enough to be deliberate
   * and is more horizontal than vertical — otherwise a shopper flicking down
   * the page would change the media out from under themselves. A cross-origin
   * embed swallows its own touches, so while a YouTube or Vimeo video holds the
   * stage the thumbnails are the way out of it.
   */
  const SWIPE_THRESHOLD_PX = 50;

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || items.length < 2) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    showItem(activeIndex + (deltaX < 0 ? 1 : -1));
  };

  /**
   * Starts a direct-file video the moment it becomes the stage.
   *
   * Sound first: the click that got here is a user gesture, so a browser will
   * usually allow it. When it does not, the rejected promise is the signal to
   * try again muted rather than leave the shopper looking at a frozen frame.
   */
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !autoplay) return;

    void element.play().catch(() => {
      element.muted = true;
      void element.play().catch(() => {
        // Autoplay refused outright. The controls are right there.
      });
    });
  }, [autoplay, activeIndex]);

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square w-full touch-pan-y overflow-hidden rounded-card border border-line bg-surface-raised"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {!active ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-subtle">
            No media
          </div>
        ) : active.kind === 'image' ? (
          <Image
            src={active.url}
            alt={active.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            // The first image is the LCP element on this page.
            priority={activeIndex === 0}
          />
        ) : active.embedUrl ? (
          <iframe
            key={active.id}
            src={autoplay ? withAutoplay(active.embedUrl) : active.embedUrl}
            title={active.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <video
            key={active.id}
            ref={videoRef}
            src={active.url}
            poster={active.poster}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          >
            Your browser cannot play this video.
          </video>
        )}

        {badge && <div className="absolute left-4 top-4 flex flex-wrap gap-2">{badge}</div>}
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => showItem(index)}
              aria-label={
                item.kind === 'image'
                  ? `Show image ${index + 1} of ${items.length}`
                  : `Play video: ${item.title}`
              }
              aria-current={index === activeIndex}
              className={cn(
                'relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-control border-2 transition-colors',
                index === activeIndex ? 'border-accent' : 'border-line hover:border-line-strong'
              )}
            >
              {item.kind === 'image' ? (
                <Image src={item.url} alt="" fill sizes="64px" className="object-cover" />
              ) : item.poster ? (
                <>
                  <Image src={item.poster} alt="" fill sizes="64px" className="object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Play className="h-4 w-4 text-white" />
                  </span>
                </>
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-surface-sunken">
                  <Play className="h-4 w-4 text-ink-muted" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <p className="flex items-center gap-1.5 text-2xs text-ink-subtle">
          <Play className="h-3 w-3" />
          {videos.length} product video{videos.length === 1 ? '' : 's'}
          {images.length > 0 && ' · swipe the gallery or tap a thumbnail'}
        </p>
      )}

    </div>
  );
}
