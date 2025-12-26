# Say It Schedule - Deployment Guide

This guide covers deploying Say It Schedule to AWS using ECS Fargate.

## Deployment Options

| Option | Cost | Best For |
|--------|------|----------|
| **Shared Infrastructure** | ~$15/month | When you have existing wss-prod infrastructure |
| **Standalone Demo** | ~$48/month | Completely isolated deployment |
| **Production** | ~$130/month | High availability with auto-scaling |

---

## Shared Infrastructure Deployment (Recommended)

**Use this if you have the wss-prod project deployed.** This option shares the ALB and RDS from wss-prod to minimize costs.

### What's Shared

- **ALB**: Uses host-based routing to share the existing load balancer
- **RDS**: Creates a separate database in the existing PostgreSQL instance
- **VPC**: Runs in the same VPC/subnets

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
│                         (HTTPS/443)                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Shared ALB (wss-prod-alb)                           │
│                  Host-based routing                              │
│   api.wespeaksoon.com → wss-prod                                │
│   sayitschedule.wespeaksoon.com → sayitschedule                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│   wss-prod ECS       │      │  sayitschedule ECS   │
│   (existing)         │      │  (new, 0.25 vCPU)    │
└──────────────────────┘      └──────────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shared RDS PostgreSQL                         │
│              wss_prod DB  |  sayitschedule DB                    │
└─────────────────────────────────────────────────────────────────┘
```

### Cost Estimate (Incremental)

| Resource | Monthly Cost |
|----------|-------------|
| ECS Fargate (0.25 vCPU, 512MB) | ~$10 |
| Data transfer | ~$5 |
| **Total Additional** | **~$15/month** |

*ALB and RDS costs are already covered by wss-prod*

### Setup Steps

#### 1. Prerequisites

- wss-prod must be deployed and running
- AWS CLI configured with appropriate permissions
- Terraform installed
- ACM certificate that covers your sayitschedule subdomain

#### 2. Update wss-prod Terraform

First, apply the updated outputs to the wss-prod project:

```bash
cd /path/to/wss-prod/terraform/environments/prod
terraform apply
```

This exports the shared resource IDs needed by sayitschedule.

#### 3. Create Database User and Database

Connect to the shared RDS and create the sayitschedule database:

```bash
# Get RDS endpoint
RDS_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier wss-prod-postgres \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

# Connect (you'll need the admin password)
psql -h $RDS_HOST -U wss_admin -d postgres

# In psql, create user and database:
CREATE USER sayitschedule WITH PASSWORD 'your-secure-password';
CREATE DATABASE sayitschedule OWNER sayitschedule;
GRANT ALL PRIVILEGES ON DATABASE sayitschedule TO sayitschedule;
\q
```

#### 4. Configure Terraform

```bash
cd infrastructure/terraform-shared
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
host_header = "sayitschedule.wespeaksoon.com"
db_name     = "sayitschedule"
db_username = "sayitschedule"
db_password = "your-secure-password"
jwt_secret  = "generate-32-char-secret"
ai_api_key  = "sk-your-openai-api-key"
```

#### 5. Deploy Infrastructure

```bash
terraform init
terraform plan
terraform apply
```

#### 6. Create DNS Record

Create a CNAME record pointing to the shared ALB:

```
sayitschedule.wespeaksoon.com → wss-prod-alb-XXXXX.us-east-1.elb.amazonaws.com
```

#### 7. Configure GitHub Secrets

Go to **GitHub > Settings > Secrets > Actions** and add:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

#### 8. Deploy Application

```bash
git push origin main
```

---

## Standalone Demo Deployment

Use this for a completely isolated deployment with its own ALB and RDS.

The demo deployment is a cost-effective setup with SSL:

- Single ECS Fargate task behind ALB
- HTTPS with your ACM certificate
- No NAT Gateway (saves ~$35/month)
- Single-AZ RDS (saves ~$15/month)
- Stable URL via ALB

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
│                         (HTTPS/443)                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Application Load Balancer (ALB)                     │
│                  SSL termination with ACM cert                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ECS Fargate Task                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Node.js App                            │   │
│  │              (0.25 vCPU, 512MB RAM)                       │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RDS PostgreSQL                              │
│                   (db.t3.micro, Single-AZ)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Demo Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| ECS Fargate (0.25 vCPU, 512MB) | ~$10 |
| Application Load Balancer | ~$18 |
| RDS db.t3.micro | ~$15 |
| Data transfer | ~$5 |
| **Total** | **~$48/month** |

### Demo Setup Steps

#### 1. Prerequisites

- AWS CLI installed and configured
- Terraform installed
- ACM certificate provisioned in us-east-1

```bash
# Install tools (macOS)
brew install awscli terraform

# Configure AWS credentials
aws configure
```

#### 2. Get Your ACM Certificate ARN

```bash
# List certificates
aws acm list-certificates --region us-east-1

# Copy the CertificateArn for your domain
```

#### 3. Create S3 Bucket for Terraform State

```bash
aws s3 mb s3://sayitschedule-terraform-state --region us-east-1
```

#### 4. Configure Terraform

```bash
cd infrastructure/terraform-demo
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
jwt_secret      = "generate-32-char-secret-here"
ai_api_key      = "sk-your-openai-api-key"
db_password     = "generate-secure-password"
certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/abc-123"
```

Generate secrets:

```bash
# JWT secret
openssl rand -base64 32

# Database password
openssl rand -base64 24
```

#### 5. Deploy Infrastructure

```bash
terraform init
terraform plan
terraform apply
```

This takes ~10-15 minutes (mostly waiting for RDS).

After completion, note the outputs:

```
app_url = "https://sayitschedule-alb-demo-123456.us-east-1.elb.amazonaws.com"
```

#### 6. Configure GitHub Secrets

Go to **GitHub > Settings > Secrets > Actions** and add:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

#### 7. Push to Deploy

```bash
git add .
git commit -m "Deploy to demo"
git push origin main
```

The GitHub Action will:

1. Build the Docker image
2. Push to ECR
3. Update ECS service
4. Run database migrations

#### 8. Access the Application

After deployment completes:

```
https://sayitschedule-alb-demo-XXXXX.us-east-1.elb.amazonaws.com
```

Or set up a custom domain by creating a CNAME record pointing to the ALB DNS name.

### Seeding Demo Data

Run the seed script as a one-off ECS task:

```bash
# Get network config
CLUSTER=sayitschedule-cluster-demo
SERVICE=sayitschedule-service-demo

SERVICE_INFO=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE)
SUBNETS=$(echo $SERVICE_INFO | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.subnets | join(",")')
SG=$(echo $SERVICE_INFO | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]')
TASK_DEF=$(echo $SERVICE_INFO | jq -r '.services[0].taskDefinition')

# Run seed
aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides": [{"name": "sayitschedule", "command": ["node", "dist/db/seed.js"]}]}'
```

### Custom Domain Setup

To use a custom domain like `demo.sayitschedule.com`:

1. Create a CNAME record in your DNS:
   ```
   demo.sayitschedule.com → sayitschedule-alb-demo-XXX.us-east-1.elb.amazonaws.com
   ```

2. Ensure your ACM certificate covers this domain (or use a wildcard cert)

---

## Production Deployment

For production with auto-scaling and multi-AZ, use `infrastructure/terraform/`.

### Additional Production Features

- Multi-AZ RDS with automatic backups
- Auto-scaling (1-4 containers)
- NAT Gateway for private subnets
- Performance Insights on RDS

### Production Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| ECS Fargate (2x 0.5 vCPU, 1GB) | ~$35 |
| Application Load Balancer | ~$20 |
| RDS db.t3.micro (Multi-AZ) | ~$30 |
| NAT Gateway | ~$35 |
| Data transfer | ~$10 |
| **Total** | **~$130/month** |

---

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Basic health (for ALB) |
| `GET /api/health/deep` | Database connectivity check |

---

## Troubleshooting

### Container won't start

Check CloudWatch logs:

```bash
aws logs tail /ecs/sayitschedule-demo --follow
```

Verify SSM parameters exist:

```bash
aws ssm get-parameter --name /sayitschedule/demo/DATABASE_URL --with-decryption
```

### Database connection issues

Check RDS is running:

```bash
aws rds describe-db-instances --db-instance-identifier sayitschedule-db-demo
```

### Deployment stuck

Check ECS events:

```bash
aws ecs describe-services \
  --cluster sayitschedule-cluster-demo \
  --services sayitschedule-service-demo \
  --query 'services[0].events[:5]'
```

Force a new deployment:

```bash
aws ecs update-service \
  --cluster sayitschedule-cluster-demo \
  --service sayitschedule-service-demo \
  --force-new-deployment
```

### SSL certificate issues

Ensure the ACM certificate:

1. Is in the **us-east-1** region
2. Is in **Issued** status (not Pending Validation)
3. Covers your domain (check Subject Alternative Names)

```bash
aws acm describe-certificate --certificate-arn YOUR_CERT_ARN
```
