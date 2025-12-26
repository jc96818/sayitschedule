# SSM Parameters for secrets
resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.app_name}/${var.environment}/DATABASE_URL"
  description = "PostgreSQL database connection URL"
  type        = "SecureString"
  value       = var.database_url

  tags = {
    Name = "${var.app_name}-db-url-${var.environment}"
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${var.app_name}/${var.environment}/JWT_SECRET"
  description = "JWT secret for token signing"
  type        = "SecureString"
  value       = var.jwt_secret

  tags = {
    Name = "${var.app_name}-jwt-secret-${var.environment}"
  }
}

resource "aws_ssm_parameter" "ai_api_key" {
  name        = "/${var.app_name}/${var.environment}/AI_API_KEY"
  description = "API key for AI/LLM service"
  type        = "SecureString"
  value       = var.ai_api_key

  tags = {
    Name = "${var.app_name}-ai-key-${var.environment}"
  }
}

# IAM policy to allow ECS tasks to read SSM parameters
resource "aws_iam_role_policy" "ecs_ssm" {
  name = "${var.app_name}-ecs-ssm-policy-${var.environment}"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          aws_ssm_parameter.database_url.arn,
          aws_ssm_parameter.jwt_secret.arn,
          aws_ssm_parameter.ai_api_key.arn
        ]
      }
    ]
  })
}
