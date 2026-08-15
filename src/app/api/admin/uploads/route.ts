import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { destroyAsset } from '@/shared/cloudinary/server';

export const dynamic = 'force-dynamic';

/**
 * Deletes an asset the admin uploaded and then discarded before saving.
 *
 * Only ever called with a `public_id` this session received from Cloudinary's
 * own upload response, so there is no guessing at ids. `destroyAsset` refuses
 * anything outside the product folders regardless.
 *
 * A failure here is reported but not treated as fatal by the caller: the file
 * being left in the account is a storage cost, not a broken product.
 */
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const publicId = params.get('publicId');
  const kind = params.get('kind');

  if (!publicId) {
    return NextResponse.json({ error: 'publicId is required' }, { status: 400 });
  }
  if (kind !== 'image' && kind !== 'video') {
    return NextResponse.json({ error: 'kind must be "image" or "video"' }, { status: 400 });
  }

  try {
    const destroyed = await destroyAsset(publicId, kind);
    if (!destroyed) {
      return NextResponse.json({ error: 'Asset is outside the product folders' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[cloudinary] destroy failed', error);
    return NextResponse.json({ error: 'Could not delete the asset' }, { status: 502 });
  }
}
