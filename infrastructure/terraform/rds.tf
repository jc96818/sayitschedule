# RDS PostgreSQL Database for Say It Schedule
# Only created when use_rds = true

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  count      = var.use_rds ? 1 : 0
  name       = "${var.app_name}-db-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.app_name}-db-subnet-${var.environment}"
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  count       = var.use_rds ? 1 : 0
  name        = "${var.app_name}-rds-sg-${var.environment}"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-rds-sg-${var.environment}"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  count      = var.use_rds ? 1 : 0
  identifier = "${var.app_name}-db-${var.environment}"

  # Engine configuration
  engine                = "postgres"
  engine_version        = "16.3"
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  publicly_accessible    = false
  multi_az               = var.environment == "production" ? true : false

  # Backup configuration
  backup_retention_period = var.environment == "production" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Monitoring
  performance_insights_enabled          = var.environment == "production" ? true : false
  performance_insights_retention_period = var.environment == "production" ? 7 : 0
  monitoring_interval                   = var.environment == "production" ? 60 : 0
  monitoring_role_arn                   = var.environment == "production" ? aws_iam_role.rds_monitoring[0].arn : null

  # Other settings
  auto_minor_version_upgrade = true
  deletion_protection        = var.environment == "production" ? true : false
  skip_final_snapshot        = var.environment != "production"
  final_snapshot_identifier  = var.environment == "production" ? "${var.app_name}-db-final-${var.environment}" : null

  tags = {
    Name = "${var.app_name}-db-${var.environment}"
  }
}

# IAM Role for Enhanced Monitoring (production only, when using RDS)
resource "aws_iam_role" "rds_monitoring" {
  count = var.use_rds && var.environment == "production" ? 1 : 0
  name  = "${var.app_name}-rds-monitoring-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count      = var.use_rds && var.environment == "production" ? 1 : 0
  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# SSM parameter with RDS connection URL
resource "aws_ssm_parameter" "database_url_rds" {
  count       = var.use_rds ? 1 : 0
  name        = "/${var.app_name}/${var.environment}/database-url"
  description = "PostgreSQL connection URL for RDS"
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main[0].endpoint}/${var.db_name}"

  tags = {
    Name = "${var.app_name}-database-url-${var.environment}"
  }
}

# Outputs (conditional)
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = var.use_rds ? aws_db_instance.main[0].endpoint : null
}

output "rds_address" {
  description = "RDS instance address (hostname only)"
  value       = var.use_rds ? aws_db_instance.main[0].address : null
}

output "rds_port" {
  description = "RDS instance port"
  value       = var.use_rds ? aws_db_instance.main[0].port : null
}

output "rds_database_name" {
  description = "RDS database name"
  value       = var.use_rds ? aws_db_instance.main[0].db_name : null
}
