import React from 'react';
import Image, { type ImageProps } from 'next/image';
import { isAllowedImageHost } from '@/shared/lib/image-hosts';

/**
 * next/image that never takes the page down.
 *
 * A product URL pasted from a host that is not in `remotePatterns` makes
 * next/image throw, which blanks the whole route — one bad row in the catalogue
 * should not do that. Unknown hosts fall back to a plain `<img>`: unoptimised
 * and slower, but visible, and the admin can fix the URL without a deploy.
 *
 * Only `fill` and explicit width/height usage is supported, matching how the
 * storefront uses images today.
 */
type SafeImageProps = ImageProps & { src: string; alt: string };

export function SafeImage({ src, alt, className, fill, sizes, ...props }: SafeImageProps) {
  if (isAllowedImageHost(src)) {
    return <Image src={src} alt={alt} className={className} fill={fill} sizes={sizes} {...props} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- deliberate: this host cannot be optimised
    <img
      src={src}
      alt={alt}
      loading={props.priority ? 'eager' : 'lazy'}
      decoding="async"
      className={[fill ? 'absolute inset-0 h-full w-full' : undefined, className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
