variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "sayitschedule"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "sayitschedule.com"
}

variable "database_url" {
  description = "PostgreSQL database connection URL (only needed if use_rds = false)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "use_rds" {
  description = "Whether to create and use an RDS instance"
  type        = bool
  default     = true
}

variable "jwt_secret" {
  description = "JWT secret for token signing"
  type        = string
  sensitive   = true
}

variable "ai_api_key" {
  description = "API key for AI/LLM service"
  type        = string
  sensitive   = true
}

variable "container_cpu" {
  description = "CPU units for the container (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Memory for the container in MB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Minimum number of tasks for auto scaling"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks for auto scaling"
  type        = number
  default     = 4
}

# RDS Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial storage allocation in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage allocation in GB for autoscaling"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "sayitschedule"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "sayitadmin"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
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
