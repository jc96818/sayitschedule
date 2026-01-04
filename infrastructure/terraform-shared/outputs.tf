# Outputs for Say It Schedule Shared Infrastructure

output "app_url" {
  description = "Application URL (via shared ALB)"
  value       = "https://${var.host_header}"
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

output "target_group_arn" {
  description = "Target group ARN"
  value       = aws_lb_target_group.app.arn
}

output "s3_uploads_bucket" {
  description = "S3 bucket name for image uploads"
  value       = aws_s3_bucket.uploads.id
}

output "s3_uploads_url" {
  description = "S3 bucket URL for uploaded images"
  value       = "https://${aws_s3_bucket.uploads.bucket_regional_domain_name}"
}

# Instructions
output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    === Say It Schedule Demo Deployment Complete ===

    Your application will be available at:
      https://${var.host_header}

    IMPORTANT: Create DNS Record
      1. Create a CNAME record in your DNS:
         ${var.host_header} -> ${local.alb_dns_name}
      2. Ensure your ACM certificate covers this domain

    IMPORTANT: Create Database (if not already done)
      The database user and database must be created manually in the shared RDS.
      See docs/DEPLOYMENT.md for instructions.

    To deploy code:
      1. Push to the 'main' branch
      2. GitHub Actions will build and deploy automatically

    To seed demo data:
      aws ecs run-task \
        --cluster ${aws_ecs_cluster.main.name} \
        --task-definition ${aws_ecs_task_definition.app.family} \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${join(",", local.public_subnet_ids)}],securityGroups=[${aws_security_group.ecs_tasks.id}],assignPublicIp=ENABLED}" \
        --overrides '{"containerOverrides": [{"name": "${local.app_name}", "command": ["node", "dist/db/seed.js"]}]}'

  EOT
}
