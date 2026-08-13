# 🚀 Easy Step-by-Step AWS EC2 Deployment Guide for KodaSoft POS

This guide will help you deploy **KodaSoft POS** to an **AWS EC2 instance** using simple steps and simple English.

---

## 📋 Prerequisites

Before starting, make sure you have:
1. An **AWS Account**.
2. A **Domain Name** (e.g., `myposapp.com`) pointing to your EC2 IP address (optional but recommended for SSL/HTTPS).
3. **SSH Key Pair** downloaded from AWS (e.g., `my-key.pem`).

---

## 🔹 Step 1: Launch an AWS EC2 Instance

1. Log into your **AWS Management Console**.
2. Go to **EC2** -> Click **Launch Instance**.
3. **Name**: `kodasoft-pos-server`.
4. **OS (AMI)**: Select **Ubuntu Server 22.04 LTS (64-bit x86)**.
5. **Instance Type**: Select **`t3.small`** or **`t3.medium`** (minimum 2 GB RAM recommended).
6. **Key Pair**: Select or create a key pair (`.pem` file).
7. **Network Settings (Security Group)**:
   - Allow **SSH** (Port 22) - from **My IP** (do NOT use Anywhere).
   - Allow **HTTP** (Port 80) - from Anywhere (0.0.0.0/0).
   - Allow **HTTPS** (Port 443) - from Anywhere (0.0.0.0/0).
8. **Storage**: Set disk size to at least **20 GB** (gp3).
9. Click **Launch Instance**.

---

## 🔹 Step 2: Connect to Your EC2 Instance

Open your computer's terminal (or PowerShell on Windows) and run:

```bash
# Set key permission (Mac/Linux only)
chmod 400 my-key.pem

# Connect to EC2 (replace IP with your EC2 Public IP)
ssh -i "my-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## 🔹 Step 3: Install Docker & Docker Compose

Once connected inside your EC2 server, run these simple commands one by one:

```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-plugin

# Start Docker and enable it on system restart
sudo systemctl start docker
sudo systemctl enable docker

# Allow ubuntu user to run Docker without sudo
sudo usermod -aG docker ubuntu

# Apply new group settings (or log out and log in again)
newgrp docker
```

To verify Docker installation, run:
```bash
docker --version
docker compose version
```

---

## 🔹 Step 4: Clone the Project & Create Environment File

```bash
# 1. Clone your project code from GitHub
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git casheer

# 2. Enter the project folder
cd casheer

# 3. Create the production environment file from the template
cp .env.example .env

# 4. Edit the environment variables
nano .env
```

> ⚠️ This is the **root** `.env` used by Docker Compose. Do NOT confuse it with
> `apps/api/.env` (that one is only for local development).

### ⚙️ Update these values inside `.env`:

```env
# REQUIRED — used to sign access/refresh tokens. 32+ random characters.
# Generate one with:  openssl rand -base64 48
JWT_SECRET=Write_A_Random_Long_Secret_Key_Min_32_Chars!

# Public URL of the web app (must be your real domain in production)
CLIENT_URL=https://yourdomain.com

# Public URL of the API (used for payment webhook callbacks)
API_URL=https://yourdomain.com

# Port the WEB app listens on (we use 8080 so Nginx can safely use port 80 for SSL).
PORT=8080

# Database credentials — docker-compose uses these to create the DB
# (only use letters, numbers, - and _ characters)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Write_A_Very_Strong_Password_2026!
POSTGRES_DB=casheer_db

# Payments (sandbox by default; set to live + provider keys for real billing)
PAYMENT_MODE=sandbox
PAYMENT_PROVIDER=stripe
# STRIPE_SECRET_KEY=...
# STRIPE_WEBHOOK_SECRET=...
# STRIPE_PUBLISHABLE_KEY=...
# PAYTABS_PROFILE_ID=...
# PAYTABS_SERVER_KEY=...
# MOYASAR_PUBLISHABLE_KEY=...
# MOYASAR_SECRET_KEY=...

# Optional: separate key for ZATCA at-rest encryption (falls back to JWT_SECRET).
# Generate one with `openssl rand -base64 32`, then paste the output here:
# ZATCA_ENC_KEY=paste-the-generated-value
```

> ℹ️ **Ports:** `PORT` in this file controls where the **web app** is exposed on
> your server (we recommend 8080). The API runs inside the Docker network on
> port 3001 and is exposed to the internet **only** through the web container's
> reverse proxy at `/api/` — you do not need to open port 3001 in AWS.

*Press `CTRL + O` then `ENTER` to save, and `CTRL + X` to exit `nano`.*

---

## 🔹 Step 5: Start the Application with Docker Compose

Run this command to build and start all services (Database, API, Web):

```bash
docker compose up -d --build
```

### Check status:
```bash
# View running containers
docker compose ps

# View live application logs
docker compose logs -f
```

> ℹ️ **On first start**, the API container automatically runs the database
> **migrations** (`prisma migrate deploy`) and then the **seed script**, which
> creates a default store you can log into immediately:
>
> | Login | Email | Password | PIN |
> | :--- | :--- | :--- | :--- |
> | **Owner** | `admin@kodasoft.com` | `admin123` | `1234` |
> | **Cashier** | `cashier@kodasoft.com` | `admin123` | `0000` |
> | **Platform admin** (SaaS console) | `admin@casheer.app` | `admin123` | — |
>
> ⚠️ **Change these default passwords immediately** after your first login
> (Dashboard → Settings → Users). Never deploy with them in production.

Your app is now running: the **web app** is on port **8080** on the server, and the **API** is
reachable at `/api/...` on the same port (proxied by the web container's nginx).

---

## 🔹 Step 6: Setup Nginx & Free SSL (HTTPS) with Certbot

To serve your website safely with `https://yourdomain.com`:

### 0. Point your domain at the server (DNS)

Before requesting SSL, your domain must resolve to your EC2 IP. In your domain
registrar's DNS settings create two **A records** (skip the `www` one if you do
not want `www`):

| Type | Name/Host | Value |
| :--- | :--- | :--- |
| A | `@` | `YOUR_EC2_PUBLIC_IP` |
| A | `www` | `YOUR_EC2_PUBLIC_IP` |

DNS can take anywhere from a few minutes to 24 hours to propagate. Verify it
works before continuing (replace with your domain):

```bash
dig +short yourdomain.com
# or on Windows/PowerShell:
Resolve-DnsName yourdomain.com
```

### 1. Install Nginx & Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/kodasoft
```

Paste the following configuration (replace `yourdomain.com` with your actual domain name):

```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/kodasoft /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Get Free SSL Certificate (HTTPS):
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts on the screen (enter your email, agree to terms). Certbot will automatically configure HTTPS for you!

---

## 🛠️ Useful Management Commands

| Action | Command |
| :--- | :--- |
| **View logs** | `docker compose logs -f` |
| **Stop application** | `docker compose down` |
| **Restart application** | `docker compose restart` |
| **Update code & redeploy** | `git pull && docker compose up -d --build` |
| **Database Backup** | `docker compose exec db pg_dump -U postgres casheer_db > backup.sql` |
| **Restore Database** | `cat backup.sql \| docker compose exec -T db psql -U postgres casheer_db` |
| **Full reset (deletes ALL data)** | `docker compose down -v` |

---

🎉 **Congratulations!** Your **KodaSoft POS** application is now fully deployed on AWS EC2 with Docker, Nginx, and free SSL (HTTPS)!
