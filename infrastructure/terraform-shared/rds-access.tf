# RDS Access - Allow sayitschedule ECS tasks to connect to shared RDS
# This creates a security group rule on the wss-prod RDS security group

resource "aws_security_group_rule" "sayitschedule_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  description              = "PostgreSQL from sayitschedule ECS tasks"
  security_group_id        = local.rds_security_group_id
  source_security_group_id = aws_security_group.ecs_tasks.id
}
