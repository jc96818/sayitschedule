# Say It Schedule - Demo Variables

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "sayitschedule"
}

# Secrets
variable "jwt_secret" {
  description = "JWT secret for token signing"
  type        = string
  sensitive   = true
}

variable "ai_api_key" {
  description = "API key for AI/LLM service (OpenAI)"
  type        = string
  sensitive   = true
}

# Database
variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

# ECS
variable "container_cpu" {
  description = "CPU units for the container (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Memory for the container in MB"
  type        = number
  default     = 512
}

# SSL Certificate
variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application (for Route 53 alias)"
  type        = string
  default     = ""
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
