# Security Groups for Demo

# ECS Tasks Security Group - Only allow traffic from ALB
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.app_name}-ecs-sg-demo"
  description = "Security group for ECS tasks (demo)"
  vpc_id      = aws_vpc.main.id

  # Only allow traffic from the ALB
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-ecs-sg-demo"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "${var.app_name}-rds-sg-demo"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
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
    Name = "${var.app_name}-rds-sg-demo"
  }
}
