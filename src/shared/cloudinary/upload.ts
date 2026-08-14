import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// Configure Cloudinary with server-side environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

/**
 * Uploads a File or Blob object to Cloudinary and returns the secure URL.
 * 
 * @param file - The File or Blob object to upload (from client/form)
 * @param folder - Optional folder name in Cloudinary to organize assets
 * @returns Promise<string> The secure HTTPS URL of the uploaded image
 */
export async function uploadToCloudinary(
    file: File | Blob,
    folder: string = 'nextjs_uploads'
): Promise<string> {
    // Convert File/Blob to ArrayBuffer, then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'auto', // Automatically detects image, video, raw files, etc.
            },
            (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                if (error) {
                    return reject(new Error(`Cloudinary Upload Error: ${error.message}`));
                }
                if (!result) {
                    return reject(new Error('Cloudinary Upload Failed: No result returned.'));
                }
                resolve(result.secure_url);
            }
        );

        // Write buffer to stream and end it
        uploadStream.end(buffer);
    });
}