'use client';

import React, { useState } from 'react';
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
  const active = items[activeIndex];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-card border border-line bg-surface-raised">
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
            src={active.embedUrl}
            title={active.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <video
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
              onClick={() => setActiveIndex(index)}
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
          {images.length > 0 && ' · scroll the thumbnails'}
        </p>
      )}

    </div>
  );
}
