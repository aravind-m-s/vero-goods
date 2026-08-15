import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { signUpload, type UploadKind } from '@/shared/cloudinary/server';

export const dynamic = 'force-dynamic';

/**
 * Hands the admin form a one-shot signature for a direct Cloudinary upload.
 *
 * The file itself never passes through this app. Proxying it would mean holding
 * the whole thing in server memory and would cap uploads at the platform's
 * request body limit — which a product video clears on its own. Signing instead
 * keeps the secret on the server and the bytes on the browser's connection to
 * Cloudinary.
 *
 * Admin-only, because a signature is permission to write into the account.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const kind = new URL(request.url).searchParams.get('kind');
  if (kind !== 'image' && kind !== 'video') {
    return NextResponse.json({ error: 'kind must be "image" or "video"' }, { status: 400 });
  }

  const signed = signUpload(kind as UploadKind);
  if (!signed) {
    return NextResponse.json(
      { error: 'Cloudinary is not configured on this deployment' },
      { status: 503 }
    );
  }

  return NextResponse.json(signed);
}
