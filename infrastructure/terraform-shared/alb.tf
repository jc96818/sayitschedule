# ALB Configuration for Say It Schedule
# Uses shared ALB from wss-prod with host-based routing

# Target Group for sayitschedule
resource "aws_lb_target_group" "app" {
  name        = "${local.app_name}-tg-demo"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
  }

  tags = {
    Name = "${local.app_name}-tg-demo"
  }
}

# Listener Rule for host-based routing
# Routes requests for sayitschedule.domain.com to this target group
resource "aws_lb_listener_rule" "app" {
  listener_arn = local.alb_listener_arn
  priority     = 100  # Lower number = higher priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    host_header {
      values = [var.host_header]
    }
  }

  tags = {
    Name = "${local.app_name}-listener-rule-demo"
  }
}
