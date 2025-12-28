# SSM Parameters for Secrets

resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.app_name}/demo/DATABASE_URL"
  description = "PostgreSQL database connection URL"
  type        = "SecureString"
  value       = "postgresql://sayitadmin:${var.db_password}@${aws_db_instance.main.endpoint}/sayitschedule"

  tags = {
    Name = "${var.app_name}-db-url-demo"
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${var.app_name}/demo/JWT_SECRET"
  description = "JWT secret for token signing"
  type        = "SecureString"
  value       = var.jwt_secret

  tags = {
    Name = "${var.app_name}-jwt-secret-demo"
  }
}

resource "aws_ssm_parameter" "ai_api_key" {
  name        = "/${var.app_name}/demo/AI_API_KEY"
  description = "API key for AI/LLM service"
  type        = "SecureString"
  value       = var.ai_api_key

  tags = {
    Name = "${var.app_name}-ai-key-demo"
  }
}
