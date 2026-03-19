# RequestBin

## Final Architecture

This project was deployed as a 4-instance multi-tier AWS architecture inside a custom VPC:

- Web server in the public subnet
- Application server in a private app subnet
- PostgreSQL server in a private DB subnet
- MongoDB server in a private DB subnet

Validated deployment layout:

- Public web server: `luudo.org`
- Web server private IP: `10.54.1.246`
- App server private IP: `10.54.2.50`
- PostgreSQL private IP: `10.54.3.197`
- MongoDB private IP: `10.54.3.209`

Traffic flow:

1. Browser connects to `luudo.org` over HTTPS.
2. Nginx on the web EC2 serves the frontend build from `/usr/share/nginx/html`.
3. Nginx proxies `/api/*`, `/socket.io/*`, and basket capture routes such as `/<endpoint>` to the private app server at `10.54.2.50:3001`.
4. The Express application stores relational metadata in PostgreSQL at `10.54.3.197:5432`.
5. The Express application stores request payload documents in MongoDB at `10.54.3.209:27017`.

## Local Development

Frontend:

```bash
cd frontend
npm install
npm start
```

Backend:

```bash
cd back_end
npm install
npm run build
npm start
```

## Deployment

Deployment guides:

- Single-instance Amazon Linux 2023: [deploy/EC2-AmazonLinux2023-deployment-guide.md](/Users/nazeershaikh/Capstone/RequestBin/deploy/EC2-AmazonLinux2023-deployment-guide.md)
- Multi-tier custom VPC on 4 EC2 instances: [deploy/EC2-multi-tier-vpc-deployment-guide.md](/Users/nazeershaikh/Capstone/RequestBin/deploy/EC2-multi-tier-vpc-deployment-guide.md)
- ALB + CloudFront + S3 architecture: [deploy/ALB-CloudFront-S3-deployment-guide.md](/Users/nazeershaikh/Capstone/RequestBin/deploy/ALB-CloudFront-S3-deployment-guide.md)

Included deployment assets:

- [deploy/requestbin.service](/Users/nazeershaikh/Capstone/RequestBin/deploy/requestbin.service)
- [deploy/nginx-requestbin.conf](/Users/nazeershaikh/Capstone/RequestBin/deploy/nginx-requestbin.conf)
- [deploy/requestbin.env.example](/Users/nazeershaikh/Capstone/RequestBin/deploy/requestbin.env.example)
