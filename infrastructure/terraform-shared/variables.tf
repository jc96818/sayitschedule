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
  description = "OpenAI API key for voice processing"
  type        = string
  sensitive   = true
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
