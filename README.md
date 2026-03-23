# RequestBin

## What This Application Does

RequestBin is a request inspection tool for capturing and reviewing inbound HTTP traffic. It lets a user create a unique endpoint, send requests to that URL, and inspect the captured request details from a web interface.

The application is useful for:

- Testing webhooks and callback URLs
- Inspecting request headers and payloads during development
- Verifying that third-party services are sending the expected HTTP method and body
- Keeping multiple request bins for different integrations or debugging sessions

## Core Workflow

1. The user opens the web app and creates a new basket.
2. The app generates a unique public capture URL in the format `/bin/<endpoint>`.
3. Any HTTP request sent to that URL is stored by the backend.
4. Request metadata such as method, headers, and timestamps are stored in PostgreSQL.
5. Request bodies are stored in MongoDB.
6. The frontend displays captured requests and updates in real time through Socket.IO.

## Main Features

- Create and manage multiple request bins from the browser
- Persist basket ownership with a generated master token stored in local storage
- Capture requests sent to dynamic `/bin/:endpoint` routes
- View request history for a selected basket
- Inspect headers and body payloads for each captured request
- Receive live updates when new requests arrive
- Delete individual requests or entire baskets

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
