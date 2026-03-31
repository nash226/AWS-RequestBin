# RequestBin

## Final Architecture

This project was deployed as a 4-instance multi-tier AWS architecture inside a custom VPC:

- Web server in the public subnet
- Application server in a private app subnet
- PostgreSQL server in a private DB subnet
- MongoDB server in a private DB subnet

Traffic flow:

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
