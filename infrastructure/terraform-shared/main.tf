# Say It Schedule - Shared Infrastructure Deployment
# Uses ALB and RDS from the wss-prod project for cost savings

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "313746776981-terraform-state-wss-prod"
    key            = "sayitschedule-demo/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "313746776981-terraform-locks-wss-prod"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "sayitschedule"
      Environment = "demo"
      ManagedBy   = "terraform"
    }
  }
}

# Look up shared resources directly from AWS
# This avoids needing to update wss-prod terraform first

data "aws_lb" "wss_prod" {
  name = "wss-prod-alb"
}

# HTTP listener on port 80 (always exists on wss-prod ALB)
data "aws_lb_listener" "http" {
  load_balancer_arn = data.aws_lb.wss_prod.arn
  port              = 80
}

data "aws_security_group" "wss_prod_alb" {
  name = "wss-prod-alb-sg"
}

data "aws_db_instance" "wss_prod" {
  db_instance_identifier = "wss-prod-postgres"
}

data "aws_security_group" "wss_prod_rds" {
  name = "wss-prod-rds-sg"
}

data "aws_vpc" "wss_prod" {
  id = data.aws_security_group.wss_prod_alb.vpc_id
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.wss_prod.id]
  }
  filter {
    name   = "tag:Name"
    values = ["*public*"]
  }
}

locals {
  app_name = "sayitschedule"

  # Shared infrastructure from wss-prod (looked up via data sources)
  vpc_id                  = data.aws_vpc.wss_prod.id
  public_subnet_ids       = data.aws_subnets.public.ids
  alb_arn                 = data.aws_lb.wss_prod.arn
  alb_dns_name            = data.aws_lb.wss_prod.dns_name
  alb_http_listener_arn   = data.aws_lb_listener.http.arn
  alb_security_group_id   = data.aws_security_group.wss_prod_alb.id
  rds_address             = data.aws_db_instance.wss_prod.address
  rds_port                = data.aws_db_instance.wss_prod.port
  rds_security_group_id   = data.aws_security_group.wss_prod_rds.id

  # Database URL for sayitschedule (uses shared RDS with separate database)
  # sslmode=require is needed because RDS enforces SSL connections
  database_url = "postgresql://${var.db_username}:${var.db_password}@${local.rds_address}:${local.rds_port}/${var.db_name}?sslmode=require"
}
