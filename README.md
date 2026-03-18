# RequestBin

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

Included deployment assets:

- [deploy/requestbin.service](/Users/nazeershaikh/Capstone/RequestBin/deploy/requestbin.service)
- [deploy/nginx-requestbin.conf](/Users/nazeershaikh/Capstone/RequestBin/deploy/nginx-requestbin.conf)
