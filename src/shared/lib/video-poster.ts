/**
 * A still frame for a product video, derived from its URL.
 *
 * Nothing is uploaded and nothing is stored: Cloudinary will render a frame
 * from any video it hosts if you ask for the same asset as a `.jpg`, and
 * YouTube publishes a thumbnail per video id. That keeps posters correct for
 * videos already in the catalogue, which no upload flow could retrofit.
 *
 * Vimeo is the gap — its thumbnail lives behind an oEmbed call rather than in
 * the URL — so those fall through to `undefined` and the caller shows a play
 * icon instead.
 */

/** `so_0` is Cloudinary's "seek to zero seconds", i.e. the opening frame. */
const CLOUDINARY_VIDEO_PATH = '/video/upload/';

function youtubeId(url: URL): string | undefined {
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') return url.pathname.slice(1) || undefined;
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v') ?? undefined;
    if (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')) {
      return url.pathname.split('/')[2] || undefined;
    }
  }
  return undefined;
}

export function videoPosterUrl(videoUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(videoUrl);
  } catch {
    return undefined;
  }

  if (url.hostname === 'res.cloudinary.com' && url.pathname.includes(CLOUDINARY_VIDEO_PATH)) {
    const asJpg = url.pathname.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
    return `${url.origin}${asJpg.replace(CLOUDINARY_VIDEO_PATH, `${CLOUDINARY_VIDEO_PATH}so_0/`)}`;
  }

  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}
