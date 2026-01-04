# S3 Bucket for image uploads (logos, backgrounds, etc.)

resource "aws_s3_bucket" "uploads" {
  bucket = "${local.app_name}-uploads-prod"

  tags = {
    Name = "${local.app_name}-uploads-prod"
  }
}

# Block public access at the bucket level (we'll use bucket policy for controlled access)
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = false  # Allow bucket policy for public read
  ignore_public_acls      = true
  restrict_public_buckets = false  # Allow bucket policy for public read
}

# Bucket policy for public read access to uploaded images
resource "aws_s3_bucket_policy" "uploads_public_read" {
  bucket = aws_s3_bucket.uploads.id

  # Wait for public access block to be applied first
  depends_on = [aws_s3_bucket_public_access_block.uploads]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.uploads.arn}/*"
      }
    ]
  })
}

# Enable versioning for data protection
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle rule to clean up old versions and incomplete uploads
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    # Apply to all objects
    filter {}

    # Delete non-current versions after 30 days
    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    # Abort incomplete multipart uploads after 7 days
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS configuration for browser uploads
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]  # Images are public anyway
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# IAM policy for ECS task to upload/delete images
resource "aws_iam_role_policy" "ecs_s3_uploads" {
  name = "${local.app_name}-ecs-s3-uploads-demo"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      }
    ]
  })
}
