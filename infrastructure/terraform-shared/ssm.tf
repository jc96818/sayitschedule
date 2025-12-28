# SSM Parameter Store for Secrets
# These are injected into ECS tasks at runtime

resource "aws_ssm_parameter" "database_url" {
  name        = "/${local.app_name}/demo/DATABASE_URL"
  description = "PostgreSQL connection string"
  type        = "SecureString"
  value       = local.database_url

  tags = {
    Name = "${local.app_name}-database-url"
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${local.app_name}/demo/JWT_SECRET"
  description = "JWT signing secret"
  type        = "SecureString"
  value       = var.jwt_secret

  tags = {
    Name = "${local.app_name}-jwt-secret"
  }
}

resource "aws_ssm_parameter" "ai_api_key" {
  name        = "/${local.app_name}/demo/AI_API_KEY"
  description = "OpenAI API key"
  type        = "SecureString"
  value       = var.ai_api_key

  tags = {
    Name = "${local.app_name}-ai-api-key"
  }
}

resource "aws_ssm_parameter" "mfa_encryption_key" {
  name        = "/${local.app_name}/demo/MFA_ENCRYPTION_KEY"
  description = "AES-256 encryption key for MFA secrets"
  type        = "SecureString"
  value       = var.mfa_encryption_key

  tags = {
    Name = "${local.app_name}-mfa-encryption-key"
  }
}
