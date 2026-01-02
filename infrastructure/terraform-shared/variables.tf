# Say It Schedule - Shared Infrastructure Variables

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# Database (uses shared RDS instance with separate database)
variable "db_name" {
  description = "Database name in the shared RDS instance"
  type        = string
  default     = "sayitschedule"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "sayitschedule"
}

variable "db_password" {
  description = "Database password (stored in SSM)"
  type        = string
  sensitive   = true
}

# Secrets
variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "ai_api_key" {
  description = "OpenAI API key for voice processing (only needed if ai_provider is 'openai')"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ai_provider" {
  description = "AI provider to use: 'nova' (AWS Bedrock) or 'openai'"
  type        = string
  default     = "nova"

  validation {
    condition     = contains(["nova", "openai"], var.ai_provider)
    error_message = "ai_provider must be either 'nova' or 'openai'."
  }
}

variable "mfa_encryption_key" {
  description = "AES-256 encryption key for MFA secrets (64 hex characters)"
  type        = string
  sensitive   = true
}

# Security configuration
variable "jwt_expires_in" {
  description = "JWT token expiration (e.g., 15m, 8h, 7d)"
  type        = string
  default     = "7d"
}

variable "bcrypt_cost" {
  description = "Bcrypt cost factor (12+ recommended for production)"
  type        = number
  default     = 12
}

# Host-based routing
variable "host_header" {
  description = "Host header pattern for ALB routing. Use *.domain.com for wildcard subdomains."
  type        = string
}

variable "additional_host_headers" {
  description = "Additional host headers to route (e.g., root domain sayitschedule.com)"
  type        = list(string)
  default     = []
}

# Container configuration
variable "container_cpu" {
  description = "Container CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Container memory in MB"
  type        = number
  default     = 512
}

# ALB listener configuration
variable "use_https" {
  description = "Whether to create/use an HTTPS listener (port 443) with SSL certificate."
  type        = bool
  default     = true
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate to use for HTTPS"
  type        = string
  default     = ""
}

# Route53 configuration
variable "route53_zone_name" {
  description = "Route53 hosted zone name (e.g., sayitschedule.com)"
  type        = string
  default     = ""
}

variable "subdomain" {
  description = "Subdomain to create (e.g., demo for demo.sayitschedule.com). Use * for wildcard."
  type        = string
  default     = "demo"
}

variable "create_root_record" {
  description = "Whether to create a Route53 record for the root domain (sayitschedule.com)"
  type        = bool
  default     = false
}

# Transcription Configuration
variable "transcription_provider" {
  description = "Default transcription provider (aws-medical for HIPAA, aws-standard otherwise)"
  type        = string
  default     = "aws-medical"

  validation {
    condition     = contains(["aws-medical", "aws-standard"], var.transcription_provider)
    error_message = "transcription_provider must be either 'aws-medical' or 'aws-standard'."
  }
}

variable "transcription_medical_specialty" {
  description = "Medical specialty for AWS Medical Transcribe"
  type        = string
  default     = "PRIMARYCARE"

  validation {
    condition     = contains(["PRIMARYCARE", "CARDIOLOGY", "NEUROLOGY", "ONCOLOGY", "RADIOLOGY", "UROLOGY"], var.transcription_medical_specialty)
    error_message = "transcription_medical_specialty must be one of: PRIMARYCARE, CARDIOLOGY, NEUROLOGY, ONCOLOGY, RADIOLOGY, UROLOGY."
  }
}

# Auth rate limiting
variable "auth_rate_limit_window_ms" {
  description = "Rate limit window in milliseconds"
  type        = number
  default     = 60000
}

variable "auth_login_max_per_ip" {
  description = "Maximum login attempts per IP address within the rate limit window"
  type        = number
  default     = 20
}

variable "auth_login_max_per_ip_email" {
  description = "Maximum login attempts per IP/email combination within the rate limit window"
  type        = number
  default     = 5
}

variable "auth_verify_mfa_max_per_ip" {
  description = "Maximum MFA verification attempts per IP within the rate limit window"
  type        = number
  default     = 30
}

# Debug flags
variable "debug_ai_requests" {
  description = "Enable debug logging for AI requests"
  type        = bool
  default     = false
}

# Email Configuration (AWS SES)
variable "email_enabled" {
  description = "Enable sending emails via AWS SES"
  type        = bool
  default     = false
}

variable "email_from" {
  description = "Email address to send from (must be verified in SES)"
  type        = string
  default     = "noreply@sayitschedule.com"
}

variable "app_url" {
  description = "Base URL for the application without subdomain (used to construct email links with org subdomains)"
  type        = string
  default     = "https://sayitschedule.com"
}

variable "sales_email" {
  description = "Email address to receive lead notifications from the landing page"
  type        = string
  default     = "sales@sayitschedule.com"
}

variable "email_reply_to" {
  description = "Email address users can reply to"
  type        = string
  default     = "support@sayitschedule.com"
}

variable "ses_configuration_set" {
  description = "SES configuration set name for tracking bounces and complaints"
  type        = string
  default     = "sayitschedule-production"
}
