# RequestBin ALB + CloudFront + S3 Deployment

This guide replaces the public Nginx web tier with:

- two private app EC2 instances behind an Application Load Balancer
- static frontend assets stored in Amazon S3
- a CloudFront distribution serving both static content and API traffic

Target architecture:

- CloudFront distribution as the public entry point
- S3 bucket origin for static frontend assets
- ALB origin for `/api/*`, `/socket.io/*`, and request-bin capture routes
- two app EC2 instances in private app subnets across different AZs
- managed PostgreSQL and DocumentDB in private DB subnets

## 1. App changes

The backend includes:

- `GET /health`
- `GET /api/health`

Use `/api/health` for the ALB target group health check path.

## 2. Add the second app instance

1. Create an AMI from the existing healthy app EC2 instance.
2. Launch a second EC2 instance from that AMI in the private app subnet of a different Availability Zone.
3. Attach the same app security group as the original app instance.
4. Verify the second instance starts the `requestbin` systemd service successfully.

Recommended app instance security group:

- Inbound `3001` from the ALB security group only
- Inbound `22` from your IP, bastion, or Session Manager path
- Outbound access to:
  - PostgreSQL on `5432`
  - DocumentDB on `27017`
  - package install traffic as needed

## 3. Create the target group

Create an Application Load Balancer target group with:

- Target type: `Instance`
- Protocol: `HTTP`
- Port: `3001`
- Health check path: `/api/health`
- Success codes: `200`

Register both app EC2 instances in the target group.

AWS notes that ALB target groups perform health checks per target group, and the health check path can be any valid URI path. Use `/api/health` here. Source: [Target groups for your Application Load Balancers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html), [Health checks for Application Load Balancer target groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html)

## 4. Create the Application Load Balancer

Create an internet-facing ALB:

- Scheme: `internet-facing`
- IP address type: `ipv4`
- Subnets: public subnets in at least two AZs
- Listener: `HTTP : 80`

Attach the target group from the previous step to the listener default action.

Recommended ALB security group:

- Inbound `80` from `0.0.0.0/0`
- Inbound `443` from `0.0.0.0/0` if you terminate TLS at the ALB
- Outbound `3001` to the app security group

The app instance security group should allow inbound `3001` from the ALB security group, not from the internet.

Verify target health in the target group before moving on.

## 5. Move static frontend assets to S3

Create an S3 bucket for the frontend build:

- Keep `Block all public access` enabled
- Do not enable static website hosting

Upload the contents of `frontend/build/` to the bucket root.

Use the regular S3 bucket endpoint as the CloudFront origin, not the S3 website endpoint, because Origin Access Control works only with a regular S3 origin. Source: [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html), [Use various origins with CloudFront distributions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)

## 6. Create the CloudFront distribution

Create a CloudFront distribution with two origins:

Origin 1: S3 bucket

- Origin domain: `bucket-name.s3.<region>.amazonaws.com`
- Origin access: create and attach an Origin Access Control
- Signing behavior: `Sign requests`

Origin 2: ALB DNS name

- Origin type: custom origin
- Protocol policy: `HTTP only` if ALB listener is only port `80`
- Protocol policy: `HTTPS only` if ALB has an HTTPS listener

AWS recommends OAC instead of OAI for securing S3 origins. Source: [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)

## 7. Configure CloudFront behaviors

Default behavior:

- Origin: S3
- Viewer protocol policy: `Redirect HTTP to HTTPS`
- Allowed methods: `GET, HEAD`

Additional behaviors:

- `/api/*` -> ALB origin
- `/socket.io/*` -> ALB origin
- `/*` for static frontend stays on S3 as the default behavior

If you want request-bin capture routes such as `/<endpoint>` to continue working through CloudFront, the easiest approach is to reserve a prefix for capture traffic or move the UI to a distinct path pattern. With the current app design, top-level basket URLs collide with SPA/static routing at the CDN layer. The practical options are:

- preferred: update the app so basket capture routes use a prefix such as `/bin/<endpoint>`
- alternative: keep basket capture traffic on a separate API hostname that points to the ALB

For this assignment, if your instructor expects the current naked `/<endpoint>` capture path to remain unchanged, use a separate API domain or be prepared to route most non-static traffic to the ALB.

## 8. Configure SPA error handling

For a single-page app hosted from S3 behind CloudFront, configure custom error responses:

- `403` -> `/index.html` with response code `200`
- `404` -> `/index.html` with response code `200`

This allows client-side routes to resolve correctly when S3 returns access or object-not-found errors for deep links. Source: [Configure error response behavior](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-procedure.html), [Custom error pages and error caching](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesErrorPages.html), [Change response codes returned by CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-response-code.html)

## 9. Optional custom domain and TLS

If you use a custom domain:

1. Request an ACM certificate in `us-east-1`.
2. Attach the certificate to the CloudFront distribution.
3. Point your DNS record at the CloudFront distribution.

CloudFront requires ACM certificates for viewer TLS to be in `us-east-1`.

## 10. Validation checklist

1. Both app instances are healthy in the ALB target group.
2. `http://ALB-DNS/api/health` returns `200`.
3. CloudFront serves static assets from S3.
4. `https://<cloudfront-domain>/api/health` returns `200` through CloudFront.
5. SPA deep links return `index.html` through CloudFront custom error handling.
6. Static S3 objects are not publicly accessible directly.
7. The S3 bucket is accessible through CloudFront only via OAC.

## 11. Operational notes

- Keep the app EC2 instances private. Only the ALB should be internet-facing.
- Keep S3 public access blocked. CloudFront should be the only path to the bucket.
- If you are still using the current top-level `/<endpoint>` request-bin capture route, be deliberate about CloudFront behavior design because it conflicts with SPA path handling.
