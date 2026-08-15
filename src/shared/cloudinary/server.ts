import 'server-only';

import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary, server side only.
 *
 * `server-only` is the important line: `CLOUDINARY_API_SECRET` signs upload
 * requests, and a module that can be pulled into a client bundle would put that
 * secret in the browser. Anyone holding it can upload to (and delete from) the
 * account at will.
 *
 * The browser never sends bytes through this app. It asks for a signature here
 * and then PUTs the file straight to Cloudinary — see `signUpload`.
 */

export const IMAGE_FOLDER = 'vero-goods/products/images';
export const VIDEO_FOLDER = 'vero-goods/products/videos';

/** Cloudinary's own free-plan ceilings; the UI rejects oversized files early. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type UploadKind = 'image' | 'video';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Reads the credentials, or null when they are not all present.
 *
 * Returning null rather than throwing keeps the app usable without a Cloudinary
 * account: the admin can still paste supplier CDN URLs, and only the upload
 * button disappears. The previous helper configured the SDK with `undefined`
 * values at import time, which failed later with an opaque gateway error
 * instead of saying the account was never configured.
 */
export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: UploadKind;
  maxBytes: number;
}

/**
 * Signs one direct browser upload.
 *
 * Only the parameters signed here may be sent with the file — Cloudinary
 * recomputes the signature over them and rejects the upload if the browser
 * added or changed anything. That is what stops a signature handed to the admin
 * form from being replayed to write somewhere else in the account.
 *
 * The signature is short-lived: Cloudinary rejects a `timestamp` more than an
 * hour old.
 */
export function signUpload(kind: UploadKind): SignedUpload | null {
  const config = cloudinaryConfig();
  if (!config) return null;

  const folder = kind === 'video' ? VIDEO_FOLDER : IMAGE_FOLDER;
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    config.apiSecret
  );

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
    resourceType: kind,
    maxBytes: kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
  };
}

/**
 * Removes an asset from the account.
 *
 * Called when an admin discards something they just uploaded, so the bytes do
 * not sit in the account being paid for while no product references them.
 * Scoped to our own folders: a `public_id` that does not start with one of them
 * is refused rather than passed through, so a malformed or hostile id cannot
 * reach into the rest of the account.
 */
export async function destroyAsset(publicId: string, kind: UploadKind): Promise<boolean> {
  const config = cloudinaryConfig();
  if (!config) return false;

  if (!publicId.startsWith(`${IMAGE_FOLDER}/`) && !publicId.startsWith(`${VIDEO_FOLDER}/`)) {
    return false;
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const result = await cloudinary.uploader.destroy(publicId, { resource_type: kind });
  return result.result === 'ok' || result.result === 'not found';
}
