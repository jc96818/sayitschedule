# Say It Schedule - Deployment Guide

This guide covers deploying Say It Schedule to AWS using ECS Fargate with CI/CD via GitHub Actions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Application Load Balancer                      │
│                   (HTTPS on port 443)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ECS Fargate                               │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   Container 1    │  │   Container 2    │  (auto-scaling)     │
│  │   Node.js App    │  │   Node.js App    │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
└───────────┼─────────────────────┼───────────────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RDS PostgreSQL                              │
│                    (Multi-AZ in production)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Domain name** registered and configured in Route 53
3. **GitHub repository** with this codebase
4. **Terraform** installed locally (for initial setup)
5. **AWS CLI** configured with credentials

## Initial Setup

### 1. Create S3 Bucket for Terraform State

```bash
aws s3 mb s3://sayitschedule-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket sayitschedule-terraform-state \
  --versioning-configuration Status=Enabled
```

### 2. Configure Terraform Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
aws_region  = "us-east-1"
environment = "production"
domain_name = "yourdomain.com"

# Generate secure values
jwt_secret = "your-32-char-minimum-jwt-secret"
ai_api_key = "sk-your-openai-api-key"

# Database
db_password = "your-secure-database-password"
```

### 3. Initialize and Apply Terraform

```bash
terraform init
terraform plan
terraform apply
```

This creates:
- VPC with public/private subnets
- ECS cluster and service
- RDS PostgreSQL instance
- Application Load Balancer
- SSL certificate
- Security groups
- SSM parameters for secrets

### 4. Configure GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |

The IAM user needs these permissions:
- `AmazonECS_FullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `AmazonSSMReadOnlyAccess`

### 5. Configure DNS

After Terraform applies, update your domain's DNS to point to the ALB:

```bash
# Get the ALB DNS name
terraform output alb_dns_name
```

Create an A record alias in Route 53 pointing to this ALB.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on:
- **Push to main**: Full deployment to production
- **Pull requests**: Lint, type-check, and build only

### Pipeline Stages

1. **Lint & Type Check** - Validates code quality
2. **Build** - Compiles frontend and backend
3. **Docker** - Builds and pushes image to ECR
4. **Deploy** - Updates ECS service with new image
5. **Migrate** - Runs database migrations

### Manual Deployment

Trigger a manual deployment from GitHub Actions:

1. Go to **Actions > Deploy to AWS**
2. Click **Run workflow**
3. Select the environment

## Database Migrations

Migrations run automatically after deployment. To run manually:

```bash
# Via ECS run-task
aws ecs run-task \
  --cluster sayitschedule-cluster-production \
  --task-definition sayitschedule-production \
  --launch-type FARGATE \
  --network-configuration "..." \
  --overrides '{"containerOverrides": [{"name": "sayitschedule", "command": ["node", "dist/db/migrate.js"]}]}'
```

## Seeding Demo Data

To seed the database with demo data:

```bash
aws ecs run-task \
  --cluster sayitschedule-cluster-production \
  --task-definition sayitschedule-production \
  --launch-type FARGATE \
  --network-configuration "..." \
  --overrides '{"containerOverrides": [{"name": "sayitschedule", "command": ["node", "dist/db/seed.js"]}]}'
```

## Health Checks

The application exposes two health endpoints:

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `GET /api/health` | Basic health check | ALB target group |
| `GET /api/health/deep` | Database connectivity check | Monitoring |

Example deep health response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T00:00:00.000Z",
  "version": "0.1.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 5
    }
  }
}
```

## Monitoring

### CloudWatch Logs

View application logs in CloudWatch:
- Log group: `/ecs/sayitschedule-production`

```bash
aws logs tail /ecs/sayitschedule-production --follow
```

### ECS Service Status

```bash
aws ecs describe-services \
  --cluster sayitschedule-cluster-production \
  --services sayitschedule-service-production
```

## Scaling

The ECS service auto-scales based on CPU utilization:
- **Target**: 70% CPU
- **Min tasks**: 1
- **Max tasks**: 4

To manually scale:

```bash
aws ecs update-service \
  --cluster sayitschedule-cluster-production \
  --service sayitschedule-service-production \
  --desired-count 3
```

## Rollback

To rollback to a previous version:

1. Find the previous task definition revision:
```bash
aws ecs list-task-definitions --family-prefix sayitschedule-production
```

2. Update the service to use it:
```bash
aws ecs update-service \
  --cluster sayitschedule-cluster-production \
  --service sayitschedule-service-production \
  --task-definition sayitschedule-production:REVISION_NUMBER
```

## Cost Estimation

Monthly costs for a minimal production setup:

| Resource | Estimated Cost |
|----------|----------------|
| ECS Fargate (2 tasks, 0.5 vCPU, 1GB) | ~$35 |
| RDS db.t3.micro (Multi-AZ) | ~$25 |
| ALB | ~$20 |
| NAT Gateway | ~$35 |
| Data transfer | ~$10 |
| **Total** | **~$125/month** |

## Troubleshooting

### Container failing to start

1. Check CloudWatch logs for errors
2. Verify SSM parameters exist and have values
3. Check security group allows RDS access

### Database connection issues

1. Verify RDS security group allows inbound from ECS
2. Check the database URL in SSM Parameter Store
3. Try the deep health check: `curl https://yourdomain.com/api/health/deep`

### Deployment stuck

1. Check ECS service events:
```bash
aws ecs describe-services \
  --cluster sayitschedule-cluster-production \
  --services sayitschedule-service-production \
  --query 'services[0].events[:10]'
```

2. Verify the new container can pass health checks
3. Check for port conflicts or resource constraints

## Security Notes

- All secrets stored in SSM Parameter Store (encrypted)
- Database not publicly accessible
- HTTPS enforced via ALB
- Containers run as non-root user
- RDS storage encrypted at rest
