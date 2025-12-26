# RDS PostgreSQL for Demo - Single AZ, minimal config

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-demo"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.app_name}-db-subnet-demo"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.app_name}-db-demo"

  engine               = "postgres"
  engine_version       = "16.3"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  storage_type         = "gp2"
  storage_encrypted    = true

  db_name  = "sayitschedule"
  username = "sayitadmin"
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false  # Single AZ for demo

  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = {
    Name = "${var.app_name}-db-demo"
  }
}
