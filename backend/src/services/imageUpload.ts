/**
 * Image Upload Service
 *
 * Handles image uploads to S3 with automatic resizing and format optimization.
 * Creates multiple variants including grayscale for print usage.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import crypto from 'crypto'

// S3 Configuration
const s3Region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1'
const s3Bucket = process.env.S3_BUCKET || 'sayitschedule-uploads'
const s3UrlPrefix = process.env.S3_URL_PREFIX || `https://${s3Bucket}.s3.${s3Region}.amazonaws.com`

const s3Client = new S3Client({
  region: s3Region,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    : undefined // Use default credentials chain (IAM role, etc.)
})

/**
 * Logo size variants to generate
 */
export interface LogoVariant {
  suffix: string
  width: number
  height: number
  grayscale?: boolean
}

const LOGO_VARIANTS: LogoVariant[] = [
  // Standard color variants
  { suffix: '', width: 256, height: 256 }, // Default/original
  { suffix: '-sm', width: 64, height: 64 }, // Small (sidebar)
  { suffix: '-md', width: 128, height: 128 }, // Medium (portal header)
  { suffix: '-lg', width: 256, height: 256 }, // Large (portal login)

  // Grayscale variants for print
  { suffix: '-gray', width: 256, height: 256, grayscale: true },
  { suffix: '-gray-sm', width: 64, height: 64, grayscale: true },
  { suffix: '-gray-md', width: 128, height: 128, grayscale: true }
]

export interface UploadedLogo {
  /** Primary logo URL (256x256 color) */
  url: string
  /** Small logo URL (64x64 color) */
  urlSmall: string
  /** Medium logo URL (128x128 color) */
  urlMedium: string
  /** Large logo URL (256x256 color) */
  urlLarge: string
  /** Grayscale logo URL for print (256x256) */
  urlGrayscale: string
  /** Small grayscale logo URL (64x64) */
  urlGrayscaleSmall: string
  /** Medium grayscale logo URL (128x128) */
  urlGrayscaleMedium: string
  /** S3 key prefix for all variants (for deletion) */
  keyPrefix: string
}

export interface UploadOptions {
  /** Organization ID for namespacing */
  organizationId: string
  /** Type of image (logo, background, etc.) */
  imageType: 'logo' | 'portal-logo' | 'portal-background'
}

/**
 * Generate a unique filename for the upload
 */
function generateFilename(organizationId: string, imageType: string): string {
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex')
  return `${organizationId}/${imageType}/${timestamp}-${random}`
}

/**
 * Process and upload an image with all variants
 */
export async function uploadLogo(
  imageBuffer: Buffer,
  mimeType: string,
  options: UploadOptions
): Promise<UploadedLogo> {
  const { organizationId, imageType } = options

  // Validate mime type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed: ${allowedTypes.join(', ')}`)
  }

  const keyPrefix = generateFilename(organizationId, imageType)
  const uploadedUrls: Record<string, string> = {}

  // For SVG, we don't resize - just upload as-is and create grayscale variant
  if (mimeType === 'image/svg+xml') {
    // Upload original SVG
    const key = `${keyPrefix}.svg`
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000' // 1 year cache
      })
    )

    const url = `${s3UrlPrefix}/${key}`

    // For SVG, all size variants point to the same file (SVG scales)
    return {
      url,
      urlSmall: url,
      urlMedium: url,
      urlLarge: url,
      // Note: SVG grayscale would need CSS filter on frontend
      urlGrayscale: url,
      urlGrayscaleSmall: url,
      urlGrayscaleMedium: url,
      keyPrefix
    }
  }

  // Process raster images with Sharp
  const sharpImage = sharp(imageBuffer)
  const metadata = await sharpImage.metadata()

  // Validate image dimensions (reasonable limits)
  if (metadata.width && metadata.width > 4096) {
    throw new Error('Image width exceeds maximum of 4096 pixels')
  }
  if (metadata.height && metadata.height > 4096) {
    throw new Error('Image height exceeds maximum of 4096 pixels')
  }

  // Generate and upload all variants
  for (const variant of LOGO_VARIANTS) {
    let pipeline = sharp(imageBuffer)
      .resize(variant.width, variant.height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })

    if (variant.grayscale) {
      pipeline = pipeline.grayscale()
    }

    // Output as PNG for best quality with transparency
    const processedBuffer = await pipeline.png({ quality: 90 }).toBuffer()

    const key = `${keyPrefix}${variant.suffix}.png`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: processedBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000' // 1 year cache
      })
    )

    uploadedUrls[variant.suffix || 'default'] = `${s3UrlPrefix}/${key}`
  }

  return {
    url: uploadedUrls['default'],
    urlSmall: uploadedUrls['-sm'],
    urlMedium: uploadedUrls['-md'],
    urlLarge: uploadedUrls['-lg'],
    urlGrayscale: uploadedUrls['-gray'],
    urlGrayscaleSmall: uploadedUrls['-gray-sm'],
    urlGrayscaleMedium: uploadedUrls['-gray-md'],
    keyPrefix
  }
}

/**
 * Upload a background image (no variants, just resize to reasonable max)
 */
export async function uploadBackgroundImage(
  imageBuffer: Buffer,
  mimeType: string,
  organizationId: string
): Promise<{ url: string; key: string }> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed: ${allowedTypes.join(', ')}`)
  }

  const key = generateFilename(organizationId, 'portal-background')

  // Resize to max 1920px width while maintaining aspect ratio
  const processedBuffer = await sharp(imageBuffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85 }) // Use JPEG for smaller file size
    .toBuffer()

  const fullKey = `${key}.jpg`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: fullKey,
      Body: processedBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000'
    })
  )

  return {
    url: `${s3UrlPrefix}/${fullKey}`,
    key: fullKey
  }
}

/**
 * Delete all variants of an uploaded image by key prefix
 */
export async function deleteUploadedImage(keyPrefix: string): Promise<void> {
  // Delete all known variants
  const suffixes = ['', '-sm', '-md', '-lg', '-gray', '-gray-sm', '-gray-md']
  const extensions = ['.png', '.svg', '.jpg']

  const deletePromises: Promise<unknown>[] = []

  for (const suffix of suffixes) {
    for (const ext of extensions) {
      deletePromises.push(
        s3Client
          .send(
            new DeleteObjectCommand({
              Bucket: s3Bucket,
              Key: `${keyPrefix}${suffix}${ext}`
            })
          )
          .catch(() => {
            // Ignore errors for non-existent files
          })
      )
    }
  }

  await Promise.all(deletePromises)
}

/**
 * Extract key prefix from a logo URL
 */
export function extractKeyPrefixFromUrl(url: string): string | null {
  if (!url.startsWith(s3UrlPrefix)) {
    return null
  }

  const key = url.replace(`${s3UrlPrefix}/`, '')
  // Remove the suffix and extension to get the prefix
  // e.g., "org-id/logo/12345-abc.png" -> "org-id/logo/12345-abc"
  // e.g., "org-id/logo/12345-abc-sm.png" -> "org-id/logo/12345-abc"
  const match = key.match(/^(.+?)(?:-(?:sm|md|lg|gray|gray-sm|gray-md))?\.(?:png|svg|jpg)$/)
  return match ? match[1] : null
}

export default {
  uploadLogo,
  uploadBackgroundImage,
  deleteUploadedImage,
  extractKeyPrefixFromUrl
}
