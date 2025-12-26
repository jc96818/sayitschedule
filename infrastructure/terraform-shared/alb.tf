# ALB Configuration for Say It Schedule
# Uses shared ALB from wss-prod with host-based routing

# Target Group for sayitschedule
resource "aws_lb_target_group" "app" {
  name        = "${local.app_name}-tg-demo"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  # Reduce deregistration delay for faster deployments (default is 300s)
  deregistration_delay = 30

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

# HTTPS Listener on port 443 (creates if it doesn't exist)
# This uses the sayitschedule.com SSL certificate
resource "aws_lb_listener" "https" {
  count = var.use_https && var.certificate_arn != "" ? 1 : 0

  load_balancer_arn = local.alb_arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  tags = {
    Name = "${local.app_name}-https-listener"
  }

  # Ignore if listener already exists on this port
  lifecycle {
    ignore_changes = [default_action]
  }
}

# HTTP to HTTPS redirect listener rule (optional)
resource "aws_lb_listener_rule" "http_redirect" {
  count = var.use_https && var.certificate_arn != "" ? 1 : 0

  listener_arn = data.aws_lb_listener.http.arn
  priority     = 99  # High priority to catch before other rules

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  condition {
    host_header {
      values = [var.host_header]
    }
  }

  tags = {
    Name = "${local.app_name}-http-redirect-demo"
  }
}

# Listener Rule for host-based routing on HTTPS
resource "aws_lb_listener_rule" "app_https" {
  count = var.use_https && var.certificate_arn != "" ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
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
    Name = "${local.app_name}-listener-rule-https-demo"
  }
}

# Listener Rule for host-based routing on HTTP (fallback when no HTTPS)
resource "aws_lb_listener_rule" "app_http" {
  count = !var.use_https || var.certificate_arn == "" ? 1 : 0

  listener_arn = data.aws_lb_listener.http.arn
  priority     = 100

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
    Name = "${local.app_name}-listener-rule-http-demo"
  }
}

# Route53 record pointing to the ALB
data "aws_route53_zone" "main" {
  count = var.route53_zone_name != "" ? 1 : 0
  name  = var.route53_zone_name
}

resource "aws_route53_record" "app" {
  count = var.route53_zone_name != "" ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "${var.subdomain}.${var.route53_zone_name}"
  type    = "A"

  alias {
    name                   = local.alb_dns_name
    zone_id                = data.aws_lb.wss_prod.zone_id
    evaluate_target_health = true
  }
}
