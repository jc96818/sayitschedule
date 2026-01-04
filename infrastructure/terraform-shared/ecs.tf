# ECS for Say It Schedule - Uses shared ALB from wss-prod

# ECS Cluster (separate cluster for sayitschedule)
resource "aws_ecs_cluster" "main" {
  name = "${local.app_name}-cluster-demo"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name = "${local.app_name}-cluster-demo"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.app_name}-demo"
  retention_in_days = 7

  tags = {
    Name = "${local.app_name}-logs-demo"
  }
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name        = "${local.app_name}-ecs-sg-demo"
  description = "Security group for ECS tasks"
  vpc_id      = local.vpc_id

  # Allow inbound from shared ALB
  ingress {
    description     = "HTTP from shared ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [local.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.app_name}-ecs-sg-demo"
  }
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.app_name}-ecs-execution-demo"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS to read SSM parameters
resource "aws_iam_role_policy" "ecs_ssm" {
  name = "${local.app_name}-ecs-ssm-demo"
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
        Resource = concat(
          [
            aws_ssm_parameter.database_url.arn,
            aws_ssm_parameter.jwt_secret.arn,
            aws_ssm_parameter.mfa_encryption_key.arn
          ],
          var.ai_provider == "openai" ? [aws_ssm_parameter.ai_api_key[0].arn] : []
        )
      }
    ]
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task" {
  name = "${local.app_name}-ecs-task-demo"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for AWS Transcribe (Medical and Standard)
resource "aws_iam_role_policy" "ecs_transcribe" {
  name = "${local.app_name}-ecs-transcribe-demo"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "transcribe:StartStreamTranscription",
          "transcribe:StartMedicalStreamTranscription"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM policy for AWS Bedrock Nova (AI Provider)
resource "aws_iam_role_policy" "ecs_bedrock" {
  name = "${local.app_name}-ecs-bedrock-demo"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "arn:aws:bedrock:*::foundation-model/amazon.nova-*"
      }
    ]
  })
}

# IAM policy for AWS SES (Email)
resource "aws_iam_role_policy" "ecs_ses" {
  count = var.email_enabled ? 1 : 0
  name  = "${local.app_name}-ecs-ses-demo"
  role  = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECR Repository
resource "aws_ecr_repository" "app" {
  name                 = "${local.app_name}-demo"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = {
    Name = "${local.app_name}-ecr-demo"
  }
}

# ECR Lifecycle Policy - Keep only last 5 images
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ECS Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "${local.app_name}-demo"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = local.app_name
      image = "${aws_ecr_repository.app.repository_url}:latest"

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AI_PROVIDER", value = var.ai_provider },
        { name = "DEFAULT_TRANSCRIPTION_PROVIDER", value = var.transcription_provider },
        { name = "DEFAULT_MEDICAL_SPECIALTY", value = var.transcription_medical_specialty },
        { name = "JWT_EXPIRES_IN", value = var.jwt_expires_in },
        { name = "BCRYPT_COST", value = tostring(var.bcrypt_cost) },
        { name = "AUTH_RATE_LIMIT_WINDOW_MS", value = tostring(var.auth_rate_limit_window_ms) },
        { name = "AUTH_LOGIN_MAX_PER_IP", value = tostring(var.auth_login_max_per_ip) },
        { name = "AUTH_LOGIN_MAX_PER_IP_EMAIL", value = tostring(var.auth_login_max_per_ip_email) },
        { name = "AUTH_VERIFY_MFA_MAX_PER_IP", value = tostring(var.auth_verify_mfa_max_per_ip) },
        { name = "DEBUG_AI_REQUESTS", value = tostring(var.debug_ai_requests) },
        { name = "EMAIL_ENABLED", value = tostring(var.email_enabled) },
        { name = "EMAIL_FROM", value = var.email_from },
        { name = "EMAIL_REPLY_TO", value = var.email_reply_to },
        { name = "SES_CONFIGURATION_SET", value = var.ses_configuration_set },
        { name = "APP_URL", value = var.app_url },
        { name = "SALES_EMAIL", value = var.sales_email },
        { name = "S3_BUCKET", value = aws_s3_bucket.uploads.id },
        { name = "S3_REGION", value = var.aws_region }
      ]

      secrets = concat(
        [
          {
            name      = "DATABASE_URL"
            valueFrom = aws_ssm_parameter.database_url.arn
          },
          {
            name      = "JWT_SECRET"
            valueFrom = aws_ssm_parameter.jwt_secret.arn
          },
          {
            name      = "MFA_ENCRYPTION_KEY"
            valueFrom = aws_ssm_parameter.mfa_encryption_key.arn
          }
        ],
        var.ai_provider == "openai" ? [
          {
            name      = "OPENAI_API_KEY"
            valueFrom = aws_ssm_parameter.ai_api_key[0].arn
          }
        ] : []
      )

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${local.app_name}-task-demo"
  }
}

# ECS Service
resource "aws_ecs_service" "app" {
  name            = "${local.app_name}-service-demo"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.public_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = local.app_name
    container_port   = 3000
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  depends_on = [aws_lb_target_group.app]

  tags = {
    Name = "${local.app_name}-service-demo"
  }
}
