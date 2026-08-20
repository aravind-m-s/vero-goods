'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Film, ImageOff, Play, Star, X } from 'lucide-react';
import { SafeImage as Image } from '@/shared/ui/safe-image';
import type { UploadKind } from '@/features/admin/components/MediaUploader';
import { videoPosterUrl } from '@/shared/lib/video-poster';
import { cn } from '@/shared/lib/utils';

/** The tail of a Cloudinary URL, which is the filename the admin uploaded. */
function fileNameOf(url: string): string {
  try {
    const segments = new URL(url).pathname.split('/');
    return decodeURIComponent(segments[segments.length - 1] || url);
  } catch {
    return url;
  }
}

/**
 * What is currently attached to the product.
 *
 * The form used to show media as lines of text in a textarea, which meant the
 * only way to tell whether an upload had worked — or which of five images was
 * the one on the listing card — was to read URLs. Thumbnails answer both at a
 * glance, and the remove button sits on the thing it removes.
 */
export function MediaGallery({
  kind,
  urls,
  onRemove,
  onMakePrimary,
  onReorder,
}: {
  kind: UploadKind;
  urls: string[];
  onRemove: (url: string) => void;
  /**
   * Promotes an image to first place. Images only — videos have no equivalent,
   * nothing outside the gallery singles one of them out.
   */
  onMakePrimary?: (url: string) => void;
  /**
   * Moves the image at `from` to sit at `to`. Gallery order is the storefront's
   * order, so this is the only way to decide what a shopper sees second.
   */
  onReorder?: (from: number, to: number) => void;
}) {
  /** The tile being dragged, so the grid can show it leaving. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  if (urls.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-control border border-dashed border-line px-3 py-4 text-2xs text-ink-subtle">
        <ImageOff className="h-3.5 w-3.5 shrink-0" />
        {kind === 'video'
          ? 'No videos yet. Videos are optional.'
          : 'No images yet. A product needs at least one to save.'}
      </p>
    );
  }

  if (kind === 'video') {
    return (
      <ul className="space-y-1.5">
        {urls.map((url) => (
          <li
            key={url}
            className="flex items-center gap-2 rounded-control border border-line px-2.5 py-2"
          >
            <VideoThumb url={url} />
            <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">
              {fileNameOf(url)}
            </span>
            <PreviewLink url={url} label={`Preview ${fileNameOf(url)}`} />
            <RemoveButton onClick={() => onRemove(url)} label={`Remove ${fileNameOf(url)}`} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2">
      {urls.map((url, index) => (
        <li
          key={url}
          className={cn('group relative', dragIndex === index && 'opacity-40')}
          draggable={Boolean(onReorder)}
          onDragStart={() => setDragIndex(index)}
          onDragEnd={() => setDragIndex(null)}
          onDragOver={(event) => {
            // Only a tile in flight makes this a drop target; without the
            // preventDefault the browser refuses the drop outright.
            if (onReorder && dragIndex !== null) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (onReorder && dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
            setDragIndex(null);
          }}
        >
          <div
            className={cn(
              'relative aspect-square overflow-hidden rounded-control border border-line bg-surface-sunken',
              onReorder && 'cursor-grab active:cursor-grabbing'
            )}
          >
            <Image src={url} alt="" fill sizes="120px" className="object-cover" />
          </div>

          {/* The catalogue card and every listing use the first image, so which
              one is first is a decision, not an ordering detail — and it is made
              here, by promoting one, rather than by re-uploading in order. */}
          {index === 0 ? (
            <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-ink/80 px-1.5 py-0.5 text-3xs font-bold text-surface-raised">
              <Star className="h-2.5 w-2.5 fill-current" /> Primary
            </span>
          ) : (
            onMakePrimary && (
              <button
                type="button"
                onClick={() => onMakePrimary(url)}
                aria-label={`Make image ${index + 1} the primary image`}
                title="Make primary"
                className="absolute left-1 top-1 flex cursor-pointer items-center gap-1 rounded bg-surface-raised/90 px-1.5 py-0.5 text-3xs font-semibold text-ink-subtle shadow-card transition-colors hover:bg-ink hover:text-surface-raised"
              >
                <Star className="h-2.5 w-2.5" /> Primary
              </button>
            )
          )}

          <div className="absolute right-1 top-1 flex gap-1">
            <PreviewLink url={url} label={`Preview image ${index + 1}`} />
            <RemoveButton onClick={() => onRemove(url)} label={`Remove image ${index + 1}`} />
          </div>

          {/* Dragging is the quick way; these are the way that works from a
              keyboard, and on a touchscreen, where HTML drag events never fire. */}
          {onReorder && urls.length > 1 && (
            <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <MoveButton
                icon={ArrowLeft}
                disabled={index === 0}
                onClick={() => onReorder(index, index - 1)}
                label={`Move image ${index + 1} earlier`}
              />
              <MoveButton
                icon={ArrowRight}
                disabled={index === urls.length - 1}
                onClick={() => onReorder(index, index + 1)}
                label={`Move image ${index + 1} later`}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PreviewLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title="Open full size"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-raised/90 text-ink-subtle shadow-card transition-colors hover:text-ink"
    >
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Remove"
      className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded bg-surface-raised/90 text-ink-subtle shadow-card transition-colors hover:bg-danger hover:text-surface-raised"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

/**
 * The video's own opening frame where one can be derived, a film strip where it
 * cannot — enough to tell two uploads apart without opening either.
 */
function VideoThumb({ url }: { url: string }) {
  const poster = videoPosterUrl(url);

  if (!poster) return <Film className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />;

  return (
    <span className="relative h-8 w-10 shrink-0 overflow-hidden rounded-sm bg-surface-sunken">
      <Image src={poster} alt="" fill sizes="40px" className="object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/35">
        <Play className="h-3 w-3 text-white" />
      </span>
    </span>
  );
}

function MoveButton({
  icon: Icon,
  disabled,
  onClick,
  label,
}: {
  icon: typeof ArrowLeft;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-surface-raised/90 text-ink-subtle shadow-card transition-colors hover:bg-ink hover:text-surface-raised disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}
