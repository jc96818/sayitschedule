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

The AWS credentials must have permissions to push to ECR, update ECS, and run one-off ECS tasks for migrations. If you want the workflow to print migration logs on failure, also grant CloudWatch Logs read access:

- `logs:GetLogEvents`
- `logs:DescribeLogStreams`

Example IAM statement (scope down further if desired):

```json
{
  "Effect": "Allow",
  "Action": ["logs:GetLogEvents", "logs:DescribeLogStreams"],
  "Resource": [
    "arn:aws:logs:us-east-1:313746776981:log-group:/ecs/sayitschedule-demo:log-stream:*"
  ]
}
```

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

---

## Database Migrations with Prisma

Say It Schedule uses Prisma 7 with the PostgreSQL driver adapter (`@prisma/adapter-pg`) for database management.

### How Migrations Work

| Environment | Command | When |
|-------------|---------|------|
| Development | `npx prisma migrate dev` | Creating new migrations |
| Production | `npx prisma migrate deploy` | Applying migrations (via CI/CD) |

### Initial Deployment (Clean Database)

For the first deployment to a new environment:

1. **Deploy the application** - Push to the deployment branch (`env-demo` or `main`)
2. **Migrations run automatically** - GitHub Actions runs `npx prisma migrate deploy` after deployment
3. **Seed the database manually** - Run the seed script as a one-off ECS task:

```bash
# Set your cluster/service names
CLUSTER=sayitschedule-cluster-demo
SERVICE=sayitschedule-service-demo

# Get network configuration from the running service
SERVICE_INFO=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE)
SUBNETS=$(echo $SERVICE_INFO | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.subnets | join(",")')
SG=$(echo $SERVICE_INFO | jq -r '.services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]')
TASK_DEF=$(echo $SERVICE_INFO | jq -r '.services[0].taskDefinition')

# Run seed script
aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides": [{"name": "sayitschedule", "command": ["node", "dist/db/seed.js"]}]}'
```

The seed creates:
- Demo organization with subdomain `demo`
- Super admin: `superadmin@sayitschedule.com` / `admin123`
- Admin: `admin@demo.sayitschedule.com` / `admin123`
- Assistant: `assistant@demo.sayitschedule.com` / `admin123`
- Sample rooms, staff, patients, and rules

### Creating New Migrations (Development)

When you need to modify the database schema:

```bash
cd backend

# 1. Edit the schema
#    Modify prisma/schema.prisma with your changes

# 2. Generate and apply the migration locally
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/sayitschedule" \
  npx prisma migrate dev --name describe_your_change

# 3. Regenerate the Prisma client (usually automatic)
npx prisma generate

# 4. Commit the new migration file
git add prisma/migrations/
git commit -m "feat: add description of schema change"

# 5. Push to deploy
git push origin env-demo  # or main for production
```

### Deploying Migrations to Production

Migrations are deployed automatically via GitHub Actions:

1. **On push** - The workflow builds and deploys the application
2. **After deployment** - A separate job runs `npx prisma migrate deploy`
3. **Migration tracking** - Prisma tracks applied migrations in `_prisma_migrations` table

The relevant workflow step:

```yaml
# From .github/workflows/deploy-demo.yml
- name: Run migration task
  run: |
    aws ecs run-task \
      --overrides '{"containerOverrides": [{"name": "sayitschedule", "command": ["npx", "prisma", "migrate", "deploy"]}]}'
```

### Important Considerations

#### Migration History

- Never delete migration files after they've been deployed
- Each migration is tracked by filename in `_prisma_migrations`
- Re-running migrations is safe (already-applied migrations are skipped)

#### Breaking Changes

For destructive changes (dropping columns/tables):

1. **Deploy code that stops using the column/table**
2. **Wait for deployment to complete**
3. **Create migration to remove the schema element**
4. **Deploy the migration**

This two-phase approach prevents errors during deployment when old code might still reference removed schema.

#### Rollbacks

Prisma doesn't support automatic rollbacks. If a migration needs to be reversed:

1. **Create a new migration** that undoes the changes
2. **Test locally** before deploying
3. **Deploy the reversal migration**

For emergency situations, you can manually run SQL in the database, but this creates drift from the migration history.

### Useful Prisma Commands

```bash
# View migration status
npx prisma migrate status

# Reset database (development only - destroys all data)
npx prisma migrate reset

# Generate Prisma client without running migrations
npx prisma generate

# Open Prisma Studio (database browser)
npx prisma studio

# Format schema file
npx prisma format
```

### Migration Files

Migration files are stored in `backend/prisma/migrations/`:

```
prisma/
├── schema.prisma           # Schema definition
├── migrations/
│   └── 20251227185957_init/
│       └── migration.sql   # SQL for initial schema
```

Each migration folder contains:
- `migration.sql` - The SQL statements to apply
- Migration metadata tracked in `_prisma_migrations` table
