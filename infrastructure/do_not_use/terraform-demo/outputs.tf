# Outputs for Demo Infrastructure

output "alb_dns_name" {
  description = "ALB DNS name - use this to access the application"
  value       = aws_lb.main.dns_name
}

output "app_url" {
  description = "Application URL (HTTPS)"
  value       = "https://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

# Instructions
output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    === Demo Deployment Complete ===

    Your application is available at:
      https://${aws_lb.main.dns_name}

    To use a custom domain:
      1. Create a CNAME record pointing to: ${aws_lb.main.dns_name}
      2. Or create a Route 53 alias record

    To deploy code:
      1. Push to the 'main' branch
      2. GitHub Actions will build and deploy automatically

    To seed demo data:
      aws ecs run-task \
        --cluster ${aws_ecs_cluster.main.name} \
        --task-definition ${aws_ecs_task_definition.app.family} \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${join(",", aws_subnet.public[*].id)}],securityGroups=[${aws_security_group.ecs_tasks.id}],assignPublicIp=ENABLED}" \
        --overrides '{"containerOverrides": [{"name": "${var.app_name}", "command": ["node", "dist/db/seed.js"]}]}'

  EOT
}
