# RequestBin Multi-Tier EC2 Deployment

This guide deploys RequestBin into a custom VPC with four EC2 instances:

- `web-1` in a public subnet
- `app-1` in a private app subnet
- `postgres-1` in a private db subnet
- `mongo-1` in a private db subnet

The web server serves the frontend build and forwards dynamic traffic to the private application server. The application server runs the Express app and connects to PostgreSQL and MongoDB over private IPs.

## 1. Target architecture

- VPC CIDR: `10.0.0.0/16`
- Public subnet: `10.0.1.0/24`
- Private app subnet: `10.0.2.0/24`
- Private db subnet: `10.0.3.0/24`
- Internet Gateway attached to the VPC
- NAT Gateway in the public subnet

Route tables:

- Public subnet route table: `0.0.0.0/0 -> Internet Gateway`
- Private app subnet route table: `0.0.0.0/0 -> NAT Gateway`
- Private db subnet route table: `0.0.0.0/0 -> NAT Gateway`

Assign private IPs so the configuration stays predictable:

- `web-1`: `10.0.1.10`
- `app-1`: `10.0.2.10`
- `postgres-1`: `10.0.3.10`
- `mongo-1`: `10.0.3.11`

Reference deployment used for this project:

- Public web domain: `luudo.org`
- `web-1`: `10.54.1.246`
- `app-1`: `10.54.2.50`
- `postgres-1`: `10.54.3.197`
- `mongo-1`: `10.54.3.209`
- App subnet CIDR allowed in PostgreSQL: `10.54.2.0/24`

## 2. Security groups

Create these security groups.

`requestbin-web-sg`

- Inbound `22` from your IP
- Inbound `80` from `0.0.0.0/0`
- Outbound `all`

`requestbin-app-sg`

- Inbound `22` from your IP or from a bastion if you use one
- Inbound `3001` from `requestbin-web-sg`
- Outbound `5432` to `requestbin-postgres-sg`
- Outbound `27017` to `requestbin-mongo-sg`
- Outbound `443` and `80` for package installs through the NAT gateway

`requestbin-postgres-sg`

- Inbound `22` from your IP or bastion
- Inbound `5432` from `requestbin-app-sg`

`requestbin-mongo-sg`

- Inbound `22` from your IP or bastion
- Inbound `27017` from `requestbin-app-sg`

Do not expose `3001`, `5432`, or `27017` to the internet.

## 3. Launch the EC2 instances

Use Amazon Linux 2023 for all four instances.

Instance placement:

- `web-1`: public subnet, auto-assign public IP enabled
- `app-1`: private app subnet, no public IP
- `postgres-1`: private db subnet, no public IP
- `mongo-1`: private db subnet, no public IP

You can connect to private instances with AWS Systems Manager Session Manager or through a bastion host in the public subnet.

## 4. Database server setup

### PostgreSQL instance

On `postgres-1`:

```bash
sudo dnf update -y
sudo dnf install -y postgresql17 postgresql17-server postgresql17-contrib
sudo /usr/bin/postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Allow PostgreSQL to listen on the private interface:

```bash
sudo sed -i "s/^#listen_addresses =.*/listen_addresses = '*'/" /var/lib/pgsql/data/postgresql.conf
```

Edit `pg_hba.conf` and allow only the app subnet:

```conf
host    all             all             10.0.2.0/24            scram-sha-256
host    all             all             127.0.0.1/32           scram-sha-256
host    all             all             ::1/128                scram-sha-256
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

Create the database and app user:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE requestbin WITH LOGIN PASSWORD 'change-me';
CREATE DATABASE requestbin OWNER requestbin;
\q
```

### MongoDB instance

On `mongo-1`:

```bash
sudo dnf update -y
sudo tee /etc/yum.repos.d/mongodb-org-8.0.repo > /dev/null <<'EOF'
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
EOF
sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod
```

Allow MongoDB to listen on the private interface:

```bash
sudo sed -i 's/^  bindIp: .*/  bindIp: 127.0.0.1,10.0.3.11/' /etc/mongod.conf
sudo systemctl restart mongod
```

Verify MongoDB is listening:

```bash
ss -lntp | grep 27017
```

## 5. Application server setup

On `app-1`:

```bash
sudo dnf update -y
sudo dnf install -y git curl gcc-c++ make
sudo dnf install -y nodejs20 npm
```

Clone the repo:

```bash
cd /home/ec2-user
git clone <your-repo-url> RequestBin
cd RequestBin/back_end
npm install
npm run build
```

Create `/home/ec2-user/RequestBin/back_end/.env` using [deploy/requestbin.env.example](/Users/nazeershaikh/Capstone/RequestBin/deploy/requestbin.env.example):

```bash
PGUSER=requestbin
PGPASSWORD=change-me
PGHOST=10.0.3.10
PGDATABASE=requestbin
PGPORT=5432
MONGODB_URI=mongodb://10.0.3.11:27017/requestbin
PORT=3001
CORS_ORIGIN=http://WEB_SERVER_PUBLIC_DNS_OR_IP
SOCKET_IO_ORIGIN=http://WEB_SERVER_PUBLIC_DNS_OR_IP
TRUST_PROXY=true
```

Validate database connectivity from the app instance:

```bash
PGPASSWORD='change-me' psql -h 10.0.3.10 -U requestbin -d requestbin -c "SELECT 1;"
```

```bash
mongosh "mongodb://10.0.3.11:27017/requestbin" --eval "db.runCommand({ ping: 1 })"
```

Start the backend once:

```bash
cd /home/ec2-user/RequestBin/back_end
npm start
```

Expected output:

- `Creating tables...`
- `Database schema initialized.`
- `Running on port 3001`

Stop it after validation, then install the systemd unit:

```bash
sudo cp /home/ec2-user/RequestBin/deploy/requestbin.service /etc/systemd/system/requestbin.service
sudo systemctl daemon-reload
sudo systemctl enable --now requestbin
sudo systemctl status requestbin
```

Useful commands:

```bash
sudo systemctl restart requestbin
journalctl -u requestbin -n 100 --no-pager
```

## 6. Web server setup

On `web-1`:

```bash
sudo dnf update -y
sudo dnf install -y git nginx
cd /home/ec2-user
git clone <your-repo-url> RequestBin
```

Copy the frontend build into Nginx's web root:

```bash
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r /home/ec2-user/RequestBin/frontend/build/* /usr/share/nginx/html/
```

Copy the Nginx config and replace `APP_SERVER_PRIVATE_IP` with the private IP of `app-1`:

```bash
sed "s/APP_SERVER_PRIVATE_IP/10.0.2.10/" /home/ec2-user/RequestBin/deploy/nginx-requestbin.conf | sudo tee /etc/nginx/conf.d/requestbin.conf > /dev/null
```

Test and start Nginx:

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl restart nginx
```

## 7. Validation checklist

From `web-1`:

```bash
curl http://10.0.2.10:3001/health
```

From `app-1`:

```bash
curl http://10.0.3.10:5432
curl http://10.0.3.11:27017
```

From your laptop:

- Open `http://WEB_SERVER_PUBLIC_DNS_OR_IP`
- Create a basket
- Send a request to the generated basket URL
- Confirm the request appears in the UI

Validated deployment example:

- Open `https://luudo.org`
- Confirm the frontend loads from Nginx
- Create a basket from the browser
- Confirm requests appear in the UI after being forwarded through the private app tier

## 8. Traffic flow

1. Browser connects to `web-1` over port `80`.
2. Nginx serves static frontend files directly.
3. Nginx forwards `/api/*`, `/socket.io/*`, and request-bin capture routes such as `/<endpoint>` to `app-1`.
4. The Express app stores metadata in PostgreSQL on `postgres-1`.
5. The Express app stores request payload documents in MongoDB on `mongo-1`.

Validated project deployment traffic flow:

1. Browser connects to `https://luudo.org`.
2. Nginx on `10.54.1.246` serves the frontend build from `/usr/share/nginx/html`.
3. Nginx forwards `/api/*`, `/socket.io/*`, and request capture routes to `10.54.2.50:3001`.
4. The application server on `10.54.2.50` connects to PostgreSQL on `10.54.3.197:5432`.
5. The application server on `10.54.2.50` connects to MongoDB on `10.54.3.209:27017`.

## 9. Notes

- This is a four-instance architecture, but it is still single-node per tier. There is no high availability yet.
- The current MongoDB setup does not enable authentication. If you need production hardening, enable Mongo auth and update `MONGODB_URI`.
- If you rebuild the frontend, do it before copying assets onto `web-1`.
- During migration from an older monolith deployment, clearing the browser's stored `userToken` may be necessary because a stale token from the previous database can cause basket creation to fail.
