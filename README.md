# RequestBin

## Local development

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

## Production / EC2

This app expects:

- A Node.js process running the backend
- PostgreSQL running on the EC2 instance
- MongoDB running on the EC2 instance
- A built React frontend in `frontend/build`

Required backend environment variables:

```bash
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/requestbin
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=requestbin
PGUSER=requestbin_user
PGPASSWORD=...
```

Deploy flow:

```bash
git clone <repo>
cd frontend && npm install && npm run build
cd ../back_end && npm install && npm run build && npm start
```

Recommended on EC2:

- Serve `frontend/build` from `nginx`
- Proxy `/api` and `/socket.io` to `localhost:3000`
- Keep `3000`, `5432`, and `27017` private
- Run the Node app with `systemd` or `pm2`

Example deployment assets are in `deploy/`:

- `deploy/requestbin.service`
- `deploy/nginx-requestbin.conf`

## EC2 monolith setup

This assignment setup keeps all services on one Ubuntu EC2 instance.

Install PostgreSQL from the PostgreSQL APT repository:

```bash
sudo apt update
sudo apt install -y postgresql-common ca-certificates
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt install -y postgresql-18
```

Install MongoDB Community Edition from MongoDB's official APT repository.
Pick the repository line that matches your Ubuntu release:

Ubuntu 24.04:

```bash
sudo apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

Ubuntu 22.04:

```bash
sudo apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

Enable and start both database services:

```bash
sudo systemctl enable --now postgresql
sudo systemctl enable --now mongod
```

Create a Postgres role and database:

```bash
sudo -u postgres psql
CREATE ROLE requestbin_user WITH LOGIN PASSWORD 'change-me';
CREATE DATABASE requestbin OWNER requestbin_user;
\q
```

Then create `back_end/.env`:

```bash
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/requestbin
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=requestbin
PGUSER=requestbin_user
PGPASSWORD=change-me
```
