# AWS Production Cost Analysis (Dedicated VPC + HIPAA + Nova)

This document summarizes the AWS resources used by Say It Schedule and provides a production cost model for a **dedicated VPC** deployment with **HIPAA organizations** using **Amazon Bedrock Nova** (LLM) and **Amazon Transcribe Medical Streaming** (speech-to-text).

## What’s In Scope

- **AWS infrastructure** for a production deployment (dedicated VPC, NAT, ECS/Fargate, ALB, RDS, logging, secrets).
- **AI interactions** and the AWS services they drive (Bedrock Nova, Transcribe Streaming, optional SES).
- A **cost model** with clear assumptions and formulas so you can plug in different org/user volumes.

## Current AWS Footprint (From This Repo)

These are the AWS services referenced in code and Terraform in this repo:

- **ECS Fargate + ECR** (container build/push + run): `infrastructure/terraform-shared/ecs.tf`, `.github/workflows/deploy*.yml`
- **ALB** (HTTP/HTTPS listener rules, host-based routing): `infrastructure/terraform-shared/alb.tf`
- **RDS PostgreSQL** (shared in `terraform-shared`, dedicated in `do_not_use/terraform`): `infrastructure/do_not_use/terraform/rds.tf`
- **VPC + NAT Gateway** (dedicated VPC example in `do_not_use/terraform`): `infrastructure/do_not_use/terraform/vpc.tf`
- **CloudWatch Logs** (ECS task logs): `infrastructure/terraform-shared/ecs.tf`
- **SSM Parameter Store (SecureString)** (DB/JWT/MFA/OpenAI key): `infrastructure/terraform-shared/ssm.tf`
- **AI services in backend**
  - **Amazon Transcribe Streaming** (Medical/Standard) over WebSocket: `backend/src/routes/transcription.ts`, `backend/src/services/transcription/**`
  - **Amazon Bedrock Nova** (LLM): `backend/src/services/novaProvider.ts` (model: `us.amazon.nova-2-lite-v1:0`)
  - Provider switching between Nova/OpenAI: `backend/src/services/aiProvider.ts`

## Assumptions (Requested)

### Tenancy & Usage

- Organizations: **N orgs** (examples provided for `N=50` and `N=200`).
- Data volume per org: **50 patients**, **10 staff**.
- Voice usage: **60 minutes / org / month**.
- All orgs are HIPAA: transcription uses **Amazon Transcribe Medical Streaming**.
- LLM provider: **Bedrock Nova** (no OpenAI usage).

### Deployment Architecture

- Region: `us-east-1` (change region and rerun the formulas if needed).
- Dedicated VPC with private subnets and **2 NAT Gateways** (one per AZ) for HA.
- ECS Fargate behind an ALB.
- RDS PostgreSQL **Multi-AZ**.

### Sizing (Baseline Starting Point)

These are “sane default” starting sizes for a multi-org production app; adjust after observing load:

- ECS Fargate service: average **2–3 tasks** at **0.5 vCPU / 1 GB** each.
- RDS: start at **`db.t4g.medium` Multi-AZ** with **100 GB gp3** (adjust instance/storage based on workload).
- Logs: 7–30 day retention depending on compliance posture (Terraform differs by env).

## AI Interaction Summary (What Drives Variable Cost)

- **Transcription**: streaming audio from the browser to the backend, then to **Transcribe Medical Streaming**; cost scales primarily with **minutes streamed**.
- **Voice parsing**: parsed text (transcript) is sent to Nova via `chatCompletion()`; cost scales with **token volume**.
- **Schedule generation**: weekly schedule generation sent to Nova; cost scales with **token volume** (and prompt size grows with staff/patients/rules).

Implementation notes:
- Schedule generation uses up to `maxTokens: 8192` in Nova provider (`backend/src/services/novaProvider.ts`).
- Voice parsing uses `maxTokens: 1024–2048` depending on context (`backend/src/services/voiceParser.ts`).

## Monthly Cost Model

### 1) “Fixed-ish” Infrastructure Costs (Do Not Scale Much With Org Count)

These costs are primarily driven by uptime and baseline capacity, not the number of organizations:

- **NAT Gateways (2×)**: typically ~`$66/mo` base (plus small per-GB processing).
- **ALB**: typically ~`$20–$35/mo` for a small-to-moderate traffic profile.
- **ECS Fargate**: typically ~`$36–$75/mo` for 2–3 tasks at 0.5 vCPU / 1 GB.
- **RDS PostgreSQL Multi-AZ**: commonly ~`$110–$220/mo` for `db.t4g.medium` Multi-AZ + ~100 GB gp3.
- **CloudWatch Logs + ECR + Route53 + SSM**: typically ~`$5–$25/mo`.

**Infra subtotal (typical baseline):** **~`$240–$420/mo`**

### 2) Variable AI Costs (Scale With Org Count)

#### Amazon Transcribe Medical Streaming (dominant variable)

Let:

- `M = 60` minutes/org/month
- `N = org count`
- `P_med = $/minute` for Transcribe Medical Streaming (check current AWS pricing for your region)

Then:

`Transcribe_cost ≈ M × N × P_med`

Using a commonly-cited public list-price ballpark of **`P_med ≈ $0.078/min`**:

- Per-org: `60 × 0.078 ≈ $4.68/org/month`
- `N=50`: `3,000 min/month` ⇒ **~`$234/month`**
- `N=200`: `12,000 min/month` ⇒ **~`$936/month`**

#### Bedrock Nova (LLM tokens)

Nova cost is token-driven, and this repo currently does not log token usage. Use this formula once you capture usage:

- `Nova_cost = (input_tokens/1,000,000 × price_in) + (output_tokens/1,000,000 × price_out)`

Practical next step: add application-level metrics for:

- tokens in/out per request type (`voiceParsing`, `scheduleGeneration`, `ruleAnalysis`)
- request counts per org/day
- average prompt size as your patient/staff/rule counts grow

## Example Totals (Excluding Nova Tokens)

### If N=50 orgs

- Infra: **~`$240–$420/mo`**
- Transcribe Medical: **~`$234/mo`**
- **Total (excluding Nova): ~`$474–$654/mo`**

### If N=200 orgs

- Infra: **~`$240–$420/mo`**
- Transcribe Medical: **~`$936/mo`**
- **Total (excluding Nova): ~`$1,176–$1,356/mo`**

## Biggest Cost Drivers & Levers

- **Transcribe minutes**: the biggest variable cost. If real usage exceeds 60 min/org/month, costs scale roughly linearly.
- **RDS instance class**: the biggest “fixed-ish” lever; right-size early, then consider Reserved Instances once stable.
- **NAT Gateways**: 2 NATs is the HA pattern; 1 NAT reduces cost but introduces cross-AZ dependency and blast-radius risk.

## Optimization Ideas (Non-breaking, Production-friendly)

- **Reduce NAT dependence with VPC endpoints**: `ecr.api`, `ecr.dkr`, `logs`, `ssm`, `kms` (and `bedrock-runtime` if available) to keep service traffic private and reduce NAT egress/processing variability.
- **Serve frontend via S3 + CloudFront**: keep ECS/ALB focused on API + WebSockets (often improves performance and reduces ALB LCUs).
- **Tune log retention**: balance observability and compliance; store long-term logs in S3 if required.

## Next Steps to Make This Estimate “Tight”

1. Confirm expected **organization count (N)** for year-1 and year-2.
2. Capture real usage metrics in production-like tests:
   - transcription minutes per org
   - Nova calls per org (voice parsing + schedule generation) and token in/out
3. Re-run this model with measured token counts and the current Bedrock Nova pricing for your chosen region.

