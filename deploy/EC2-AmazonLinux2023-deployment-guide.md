# RequestBin EC2 Setup

This guide assumes:

- You are launching an Amazon Linux 2023 EC2 instance
- You want a monolith deployment on one instance
- Nginx will serve the frontend
- The Node backend, PostgreSQL, and MongoDB will all run on the same EC2 instance
- The repo will live at `/home/ec2-user/RequestBin`

## 1. Launch the EC2 instance

Use an Amazon Linux 2023 AMI.

In the security group, allow inbound:

- `22` from your IP
- `80` from anywhere

Do not expose:

- `3000`
- `5432`
- `27017`

## 2. connect into the instance

## 3. Install packages

```bash
sudo dnf update -y
sudo dnf install -y git nginx curl gcc-c++ make
sudo dnf install -y nodejs20 npm
sudo dnf install -y postgresql17 postgresql17-server postgresql17-contrib
```

## 4. Install MongoDB

Create the MongoDB repo file:

```bash
sudo nano /etc/yum.repos.d/mongodb-org-8.0.repo
```

Paste:

```ini
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-8.0.asc
```

Then install MongoDB:

```bash
sudo dnf install -y mongodb-org
```

## 5. Start PostgreSQL and MongoDB

Initialize PostgreSQL:

```bash
sudo /usr/bin/postgresql-setup --initdb
```

Start both services:

```bash
sudo systemctl enable --now postgresql
sudo systemctl enable --now mongod
```

## 6. Fix PostgreSQL localhost authentication

Find the active `pg_hba.conf`:

```bash
sudo -u postgres psql -t -P format=unaligned -c "SHOW hba_file;"
```

Edit the file: CHANGE THE ident INTO scram-sha-256

```bash
sudo nano /var/lib/pgsql/data/pg_hba.conf
```

Change:

```conf
host    all             all             127.0.0.1/32            ident
host    all             all             ::1/128                 ident
```

to:

```conf
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

Reload PostgreSQL:

```bash
sudo systemctl reload postgresql
```

## 7. Create the PostgreSQL role and database

Open `psql`:

```bash
sudo -u postgres psql
```

Run:

```sql
CREATE ROLE nazeershaikh WITH LOGIN PASSWORD 'password';
CREATE DATABASE requestbin OWNER nazeershaikh;
\q
```

If your teammate wants a different DB user or password, that is fine. They just need to keep `.env` in sync.

## 8. Clone the repo

```bash
cd /home/ec2-user
git clone <your-repo-url> RequestBin
cd RequestBin
```

## 9. Build the app

This repo can be built locally and pushed, or built on EC2.

Just use the prebuilt files in the repo

## 10. Create `back_end/.env`

```bash
nano /home/ec2-user/RequestBin/back_end/.env
```

Use:

you can change the user / password to whatever you initialized in your EC2 instance

```bash
PGUSER=nazeershaikh
PGPASSWORD=password
PGHOST=127.0.0.1
PGDATABASE=requestbin
PGPORT=5432
MONGODB_URI=mongodb://127.0.0.1:27017/requestbin
PORT=3000
```

## 11. Verify PostgreSQL login

```bash
PGPASSWORD='password' psql -h 127.0.0.1 -U nazeershaikh -d requestbin -c "SELECT 1;"
```

If this fails with `Ident authentication failed`, step 6 was not applied correctly. there are a couple places where you need to change 
the ident to scram-sha-256 make sure you didnt miss any 

## 12. Start the backend manually once

```bash
cd /home/ec2-user/RequestBin/back_end
npm start
```

Expected output includes:

- `Creating tables...`
- `Running on port 3000`
- `Database schema initialized.`

Stop it with `Ctrl+C` after verifying.

## 13. Set up systemd for the backend

this just runs it in the background

```bash
sudo cp /home/ec2-user/RequestBin/deploy/requestbin.service /etc/systemd/system/requestbin.service
sudo systemctl daemon-reload
sudo systemctl enable --now requestbin
sudo systemctl status requestbin
```

Useful commands:

```bash
sudo systemctl restart requestbin
sudo systemctl stop requestbin
sudo systemctl status requestbin
journalctl -u requestbin -n 50 --no-pager
```

## 14. Copy the frontend build into Nginx's web root

```bash
sudo systemctl enable --now nginx
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r /home/ec2-user/RequestBin/frontend/build/* /usr/share/nginx/html/
```

Verify:

```bash
ls -la /usr/share/nginx/html
```

You should see `index.html`, `asset-manifest.json`, and `static/`.

## 15. Configure Nginx

also this config file is in deploy/niginx-requestbin.conf if its easier 
to copy paste

```bash
sudo nano /etc/nginx/conf.d/requestbin.conf
```

Paste:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /static/ {
        try_files $uri =404;
    }

    location = / {
        try_files /index.html =404;
    }

    location = /favicon.ico { try_files $uri =404; }
    location = /manifest.json { try_files $uri =404; }
    location = /robots.txt { try_files $uri =404; }
    location = /logo192.png { try_files $uri =404; }
    location = /logo512.png { try_files $uri =404; }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 16. Verify the deployment

Frontend:

```bash
curl http://127.0.0.1/
```

Backend direct:

```bash
curl http://127.0.0.1:3000/api/web
```

Backend through Nginx:

```bash
curl http://127.0.0.1/api/web
```

Expected:

- `/` returns the React HTML
- `/api/web` returns JSON like `{"newEndPoint":"abc1234"}`

## 17. Test basket capture

Open:

```text
http://<your-ec2-public-ip>/ to find public IP you need to go to the EC2 instance area in the aws site.
```

Create a basket in the UI. Then visit the basket url.

Refresh the basket view and confirm the request appears.

## Troubleshooting

`Ident authentication failed for user ...`

- `pg_hba.conf` still uses `ident` for localhost TCP auth
- Fix step 6 and reload PostgreSQL

`extension "pgcrypto" is not available`

- Install the contrib package and restart PostgreSQL:

```bash
sudo dnf install -y postgresql17-contrib
sudo systemctl restart postgresql
```

Frontend loads but basket capture does not work

- Nginx is sending `/<endpoint>` to the frontend instead of the backend
- Use the Nginx config from step 15

Frontend build is missing `index.html` or `static/`