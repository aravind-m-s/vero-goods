'use client';

import React, { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/shared/ui/button';

type UploadKind = 'image' | 'video';

interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: UploadKind;
  maxBytes: number;
}

/** An asset uploaded during this editing session, still discardable. */
interface SessionAsset {
  publicId: string;
  url: string;
  name: string;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024))} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Uploads product media straight to Cloudinary from the browser.
 *
 * The file does not pass through the app. This asks the server for a signature,
 * then POSTs the bytes to Cloudinary directly — which is what makes a 60 MB
 * product video possible at all, since a request through a route handler is
 * capped well below that and would hold the whole file in server memory.
 *
 * Uploads run one at a time. Firing ten in parallel gives a progress bar that
 * means nothing and makes a rate-limited account fail the whole batch instead
 * of one file.
 */
export function MediaUploader({
  kind,
  onUploaded,
  onRemoved,
}: {
  kind: UploadKind;
  /** Called per successful upload with the delivery URL to add to the list. */
  onUploaded: (url: string) => void;
  /** Called when an upload is discarded, so the parent drops the URL again. */
  onRemoved: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<SessionAsset[]>([]);
  const [busy, setBusy] = useState<{ name: string; percent: number } | null>(null);
  const [queued, setQueued] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const accept = kind === 'video' ? 'video/*' : 'image/*';

  const uploadOne = (file: File, signed: SignedUpload) =>
    new Promise<SessionAsset>((resolve, reject) => {
      const form = new FormData();
      // Exactly the signed parameters, nothing more: Cloudinary recomputes the
      // signature over them and rejects the upload if anything else is added.
      form.append('file', file);
      form.append('api_key', signed.apiKey);
      form.append('timestamp', String(signed.timestamp));
      form.append('signature', signed.signature);
      form.append('folder', signed.folder);

      const request = new XMLHttpRequest();
      request.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`
      );

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setBusy({ name: file.name, percent: Math.round((event.loaded / event.total) * 100) });
        }
      };

      request.onload = () => {
        try {
          const body = JSON.parse(request.responseText) as {
            secure_url?: string;
            public_id?: string;
            error?: { message: string };
          };
          if (request.status >= 200 && request.status < 300 && body.secure_url && body.public_id) {
            resolve({ publicId: body.public_id, url: body.secure_url, name: file.name });
          } else {
            reject(new Error(body.error?.message ?? `Upload failed (${request.status})`));
          }
        } catch {
          reject(new Error('Cloudinary returned an unreadable response'));
        }
      };
      request.onerror = () => reject(new Error('Network error during upload'));
      request.ontimeout = () => reject(new Error('Upload timed out'));
      // Video files on a slow connection legitimately take minutes.
      request.timeout = 10 * 60 * 1000;

      request.send(form);
    });

  const handleFiles = async (files: FileList) => {
    setMessage(null);

    let signed: SignedUpload;
    try {
      const response = await fetch(`/api/admin/uploads/sign?kind=${kind}`, { method: 'POST' });
      const body = (await response.json()) as SignedUpload & { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? 'Could not start the upload');
        return;
      }
      signed = body;
    } catch {
      setMessage('Could not reach the server to start the upload');
      return;
    }

    // Checked here so an oversized file fails in a millisecond rather than
    // after the browser has pushed all of it across the wire.
    const chosen = Array.from(files);
    const tooBig = chosen.filter((file) => file.size > signed.maxBytes);
    const toUpload = chosen.filter((file) => file.size <= signed.maxBytes);
    if (tooBig.length > 0) {
      setMessage(
        `${tooBig.map((file) => file.name).join(', ')} — over the ${formatBytes(signed.maxBytes)} limit`
      );
    }

    setQueued(toUpload.length);
    for (const file of toUpload) {
      try {
        const asset = await uploadOne(file, signed);
        setAssets((current) => [...current, asset]);
        onUploaded(asset.url);
      } catch (uploadError) {
        // One bad file does not abandon the rest of the batch.
        setMessage(
          `${file.name}: ${uploadError instanceof Error ? uploadError.message : 'upload failed'}`
        );
      } finally {
        setQueued((current) => current - 1);
      }
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const discard = async (asset: SessionAsset) => {
    setAssets((current) => current.filter((item) => item.publicId !== asset.publicId));
    onRemoved(asset.url);
    try {
      await fetch(
        `/api/admin/uploads?publicId=${encodeURIComponent(asset.publicId)}&kind=${kind}`,
        { method: 'DELETE' }
      );
    } catch {
      // The URL is already out of the product; a leftover file is a storage
      // cost, not a broken product, so it does not deserve a blocking error.
      setMessage(`${asset.name} was removed from the product but may still be in Cloudinary`);
    }
  };

  const isUploading = busy !== null || queued > 0;

  return (
    <div className="space-y-2 rounded-control border border-dashed border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void handleFiles(event.target.files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          isLoading={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload {kind === 'video' ? 'videos' : 'images'}
        </Button>
        <span className="text-2xs text-ink-subtle">
          Uploaded files are added to the list above.
        </span>
      </div>

      {busy && (
        <div className="space-y-1">
          <div className="flex justify-between text-2xs text-ink-subtle">
            <span className="truncate">{busy.name}</span>
            <span className="shrink-0 tabular-nums">{busy.percent}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${busy.percent}%` }}
            />
          </div>
          {queued > 1 && (
            <p className="text-2xs text-ink-subtle">{queued - 1} more waiting</p>
          )}
        </div>
      )}

      {assets.length > 0 && (
        <ul className="space-y-1">
          {assets.map((asset) => (
            <li key={asset.publicId} className="flex items-center justify-between gap-2 text-2xs">
              <span className="truncate text-ink-muted">{asset.name}</span>
              <button
                type="button"
                onClick={() => void discard(asset)}
                className="flex shrink-0 items-center gap-1 text-ink-subtle hover:text-danger"
              >
                <Trash2 className="h-3 w-3" /> Discard
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="text-2xs font-medium text-danger">{message}</p>}
    </div>
  );
}
