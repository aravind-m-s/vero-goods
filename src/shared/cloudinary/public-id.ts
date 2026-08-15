/**
 * Recovers the Cloudinary `public_id` from a delivery URL.
 *
 * Client-safe on purpose — no credentials, no `server-only`. It exists so the
 * admin form can delete an image it did not upload in this session: a product
 * loaded for editing has URLs and nothing else, and the id is the only handle
 * the delete API takes.
 *
 * A wrong guess cannot do damage. `destroyAsset` refuses any id outside the
 * product folders, so the worst case is a delete that is declined.
 */

/** e.g. `c_fill,w_300` or `f_auto` — the optional transform in a delivery URL. */
function isTransformation(segment: string): boolean {
  return segment.includes(',') || /^[a-z]{1,3}_[^/]+$/.test(segment);
}

export function cloudinaryPublicId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'res.cloudinary.com') return null;

  const marker = '/upload/';
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return null;

  const segments = parsed.pathname.slice(at + marker.length).split('/').filter(Boolean);
  while (segments.length > 1 && isTransformation(segments[0])) segments.shift();
  if (segments.length > 1 && /^v\d+$/.test(segments[0])) segments.shift();
  if (segments.length === 0) return null;

  // The extension is part of the delivery URL, never part of the id.
  return segments.join('/').replace(/\.[a-z0-9]+$/i, '') || null;
}

/** True for anything we could actually remove from the account. */
export function isCloudinaryUrl(url: string): boolean {
  return cloudinaryPublicId(url) !== null;
}
