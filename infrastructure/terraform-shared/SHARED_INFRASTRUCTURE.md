# Shared Infrastructure Note

This project uses shared infrastructure owned by the **wss** project.

## Shared Resources

| Resource | ID | Owner |
|----------|-----|-------|
| VPC | `vpc-0e0711556d24da4ae` | wss |
| RDS | `wss-prod-postgres` | wss |
| ALB | `wss-prod-alb` | wss |

## Current Workaround

The `rds-access.tf` file adds a security group rule to allow this project's ECS tasks to connect to the shared RDS. The wss project uses `lifecycle { ignore_changes }` to prevent Terraform from removing this rule.

This works but is fragile.

## Future Migration

A proper shared-infra project is planned. See the full migration plan:

```
/Users/jconnor/Development/language/20251213/terraform/docs/SHARED_INFRASTRUCTURE_MIGRATION.md
```

## If Things Break

1. Check if wss ran `terraform apply` recently
2. Verify the security group rule exists: `sg-0b3232f2f4a1fcc63` → `sg-01110eb27d0760f6f`
3. Re-run `terraform apply` in this directory if needed
