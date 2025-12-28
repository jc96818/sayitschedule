# Route53 DNS Configuration for Multi-Tenant Subdomains

# Look up existing Route53 hosted zone
data "aws_route53_zone" "main" {
  name = var.domain_name
}

# Wildcard A record - routes all subdomains (*.sayitschedule.com) to ALB
resource "aws_route53_record" "wildcard" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "*.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Root domain A record - routes sayitschedule.com to ALB
resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
