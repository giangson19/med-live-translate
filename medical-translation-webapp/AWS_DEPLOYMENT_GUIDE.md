# AWS Deployment Guide - Medical Translation Web Application

**Deployment Architecture**: Frontend on AWS Amplify + Backend on EC2

**Target**: 1-10 concurrent users, production-ready
**Estimated Monthly Cost**: $4-116 (depending on usage)
**Total Setup Time**: 3-4 hours

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│   AWS Amplify (Frontend)            │
│   https://main.d123.amplifyapp.com  │
│   - index.html, app.js, styles.css  │
│   - Free SSL + CDN                  │
└─────────────────────────────────────┘
           ↓ WebSocket (wss://)
┌─────────────────────────────────────┐
│   EC2 Instance (Backend + Models)   │
│   - Translation servers (8765/8766) │
│   - ML models loaded in memory      │
│   - Self-signed SSL for WebSocket   │
└─────────────────────────────────────┘
```

**Why This Architecture?**
- ✅ No domain required - Amplify provides free `https://xxx.amplifyapp.com`
- ✅ Free SSL for frontend (automatic)
- ✅ Easy frontend updates - Just `git push`
- ✅ Global CDN - Faster page loads worldwide
- ✅ Backend + Models together - ML models stay with backend logic
- ✅ Cost-effective - Amplify ~$0-2/month

---

## Cost Breakdown

### Monthly Costs

| Resource | Type | Cost | Notes |
|----------|------|------|-------|
| **Frontend (Amplify)** | Static hosting | $0-2/mo | Free tier: 1000 build min, 15 GB served |
| **Backend - CPU** | t3.2xlarge | ~$240/mo | 8 vCPU, 32 GB RAM - large models |
| **Backend - GPU** | g4dn.xlarge | ~$380/mo | 4 vCPU, 16 GB RAM, T4 GPU - 10x faster |
| **Storage** | 50 GB gp3 | ~$4/mo | Operating system + large models |
| **Elastic IP** | 1 IP | Free | While attached to running instance |
| **Data Transfer** | 10 GB out | Free | First 100 GB/month free |
| **Total (CPU)** | | **~$244/mo** | **If running 24/7** |
| **Total (GPU)** | | **~$384/mo** | **If running 24/7** |

### Cost Optimization Options

1. **Stop when not in use**: ~$4-6/mo (only storage)
   - Stop EC2 instance after work hours
   - Save ~$236-376/month
   - **Best for internal demo with predictable usage**

2. **Use Spot Instance**:
   - CPU (t3.2xlarge): ~$72/mo (70% discount)
   - GPU (g4dn.xlarge): ~$114/mo (70% discount)
   - Risk: Can be terminated with 2-min notice
   - **Best for production 24/7**

3. **Reserved Instance (1 year)**:
   - CPU: ~$144/mo (40% discount)
   - GPU: ~$228/mo (40% discount)
   - Only if you'll use it continuously
   - **Recommended if running production 24/7 long-term**

4. **Auto Start/Stop Schedule**:
   - Run only during business hours (8 AM - 6 PM, weekdays)
   - ~40 hours/week vs 168 hours/week
   - Save ~75% of costs
   - CPU: ~$60/mo | GPU: ~$95/mo

**💡 Recommended Strategy**:
- **For demos/testing**: Use **on-demand** + **stop when not in use** = **$4-6/month**
- **For production**: Use **Spot Instance** = **$72-114/month**

---

## Prerequisites

Before you begin, ensure you have:

- [ ] AWS Account (free tier eligible if new)
- [ ] GitHub Account (for Amplify deployment)
- [ ] SSH client (Terminal on Mac/Linux, PuTTY on Windows)
- [ ] Basic command line knowledge
- [ ] Your frontend code ready (HTML/CSS/JS)

**Note**: No domain required! Amplify provides a free domain with SSL.

---

## Deployment Steps

### Phase 1: Deploy Backend + Models to EC2 (2-3 hours)

#### Step 1.1: Launch EC2 Instance

1. **Log into AWS Console** → [https://console.aws.amazon.com](https://console.aws.amazon.com)
2. **Navigate to EC2 Dashboard** → Click "Launch Instance"
3. **Configure Instance:**

   **Name and tags**:
   ```
   Name: medcomms-translation-backend
   ```

   **Application and OS Images (Amazon Machine Image)**:
   - Select: **Ubuntu Server 22.04 LTS**
   - Architecture: **64-bit (x86)**
   - Free tier eligible ✅

   **Instance type**:
   - For CPU: **t3.2xlarge** (8 vCPU, 32 GB RAM) - ~$240/month
   - For GPU: **g4dn.xlarge** (4 vCPU, 16 GB RAM, T4 GPU) - ~$380/month ⭐ **Recommended**

   **Why these sizes?**
   - PhoWhisper-large: ~6 GB RAM
   - Whisper-large-v3: ~10 GB RAM
   - VinAI translate (2 models): ~3 GB RAM
   - OS + Overhead: ~3 GB RAM
   - Total: ~22 GB needed (32 GB provides headroom)

   **Key pair (login)**:
   - Click **"Create new key pair"**
   - Name: `medcomms-key`
   - Type: **RSA**
   - Format:
     - Mac/Linux: **.pem**
     - Windows (PuTTY): **.ppk**
   - Click **"Create key pair"**
   - **IMPORTANT**: Save the downloaded file securely (you can't download it again)

   **Network settings**:
   - Click **"Edit"**
   - **Firewall (security groups)**: Create new security group
   - Security group name: `medcomms-backend-sg`
   - Description: `Security group for MedComms backend servers`

   **Security group rules**:
   - ✅ SSH (22) - Source: My IP (for secure access)
   - ✅ Custom TCP (8765) - Source: 0.0.0.0/0 (WebSocket vi→en)
   - ✅ Custom TCP (8766) - Source: 0.0.0.0/0 (WebSocket en→vi)

   Click **"Add security group rule"** for each:
   - Type: SSH, Port: 22, Source: My IP
   - Type: Custom TCP, Port: 8765, Source: Anywhere (0.0.0.0/0)
   - Type: Custom TCP, Port: 8766, Source: Anywhere (0.0.0.0/0)

   **Configure storage**:
   - Size: **50 GB** (large models need more space)
   - Volume type: **gp3** (general purpose SSD)
   - Delete on termination: **Yes** ✅
   - IOPS: 3000 (default)
   - Throughput: 125 MB/s (default)

4. **Review and Launch**:
   - Review all settings
   - Click **"Launch instance"**
   - Wait 2-3 minutes for instance to start

5. **Get Instance IP Address**:
   - Go to **EC2 Dashboard → Instances**
   - Find your instance
   - Copy **Public IPv4 address** (e.g., `54.123.45.67`)

#### Step 1.2: Allocate Elastic IP (Recommended)

An Elastic IP ensures your IP address doesn't change when you stop/start the instance.

1. Go to **EC2 Dashboard → Network & Security → Elastic IPs**
2. Click **"Allocate Elastic IP address"**
3. Click **"Allocate"**
4. Select the new IP → **Actions → Associate Elastic IP address**
5. Select your instance → Click **"Associate"**
6. **Note your Elastic IP** - you'll need it later
7. **Note**: Elastic IPs are FREE when attached to a running instance, but cost $0.005/hour (~$3.60/month) if not attached

---

#### Step 1.3: Connect to EC2 via SSH

**Mac/Linux**:
```bash
# Set correct permissions on key file
chmod 400 ~/Downloads/medcomms-key.pem

# Connect to instance
ssh -i ~/Downloads/medcomms-key.pem ubuntu@YOUR_ELASTIC_IP
```

**Windows (PuTTY)**:
1. Open PuTTY
2. Host Name: `ubuntu@YOUR_ELASTIC_IP`
3. Connection → SSH → Auth → Browse to your `.ppk` file
4. Click **"Open"**

#### Step 1.4: Update System and Install Dependencies

```bash
# Update package list
sudo apt update

# Upgrade packages
sudo apt upgrade -y

# Install essential tools
sudo apt install -y git python3-pip python3-venv nginx htop net-tools
```

#### Step 1.5: Install GPU Drivers (GPU Instance Only)

**Skip this step if using CPU instance (t3.2xlarge)**

If using **g4dn.xlarge** (GPU instance):

```bash
# Check if NVIDIA GPU is detected
lspci | grep -i nvidia
# Expected: NVIDIA Corporation TU104GL [Tesla T4]

# Install NVIDIA drivers
sudo apt install -y ubuntu-drivers-common
sudo ubuntu-drivers autoinstall

# Reboot to load drivers
sudo reboot

# After reboot, reconnect and verify NVIDIA driver
nvidia-smi
# Expected: Driver Version: 535.x, CUDA Version: 12.x

# Install CUDA Toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt update
sudo apt install -y cuda-toolkit-12-2

# Verify PyTorch can use CUDA
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}')"
# Expected: CUDA available: True, GPU: Tesla T4
```

#### Step 1.6: Install live-translation Backend

```bash
# Clone repository (or upload your modified version)
cd ~
git clone https://github.com/AbdullahHendy/live-translation.git
cd live-translation

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install live-translation
pip install -e .

# Verify installation
live-translate-server --help
```

**If you have local modifications**, upload your code:

```bash
# Option 1: Using SCP (from your local machine)
cd /Users/giangson/coding/live-translation
scp -i ~/Downloads/medcomms-key.pem -r . ubuntu@YOUR_ELASTIC_IP:~/live-translation/

# Then on EC2:
cd ~/live-translation
source venv/bin/activate
pip install -e .
```

#### Step 1.7: Download ML Models (20-30 minutes)

The **large models** will take 15-30 minutes to download (6-10 GB total).

```bash
# Activate virtual environment
cd ~/live-translation
source venv/bin/activate

# Download PhoWhisper-large (Vietnamese → English)
# For CPU instance:
live-translate-server \
  --asr_backend phowhisper \
  --whisper_model vinai/PhoWhisper-large \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-vi2en-v2 \
  --src_lang vi \
  --tgt_lang en \
  --ws_port 8865 \
  --device cpu &

# For GPU instance, use --device cuda

# Wait for models to download (check with `htop` in another terminal)
# PhoWhisper-large: ~6 GB, takes 10-15 minutes
# Once you see "Server started on port 8865", press Ctrl+C

# Download Whisper-large (English → Vietnamese)
live-translate-server \
  --asr_backend whisper \
  --whisper_model large-v3 \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-en2vi-v2 \
  --src_lang en \
  --tgt_lang vi \
  --ws_port 8866 \
  --device cpu &

# For GPU instance, use --device cuda

# Wait for models to download
# Whisper-large-v3: ~3 GB, takes 5-10 minutes
# Press Ctrl+C when done
```

**Monitor download progress:**
```bash
# In another terminal
htop  # Press F10 to quit
```

---

#### Step 1.8: Setup SSL for WebSocket

Since Amplify uses HTTPS, the backend WebSocket must also use SSL to avoid mixed content errors.

**Generate self-signed certificate:**

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/medcomms
cd /etc/ssl/medcomms

# Generate self-signed certificate (valid for 365 days)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=US/ST=State/L=City/O=MedComms/CN=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"

# Set permissions
sudo chmod 600 /etc/ssl/medcomms/server.key
sudo chmod 644 /etc/ssl/medcomms/server.crt
```

**Configure nginx (SSL proxy for WebSocket):**

nginx is recommended for WebSocket SSL proxying because it properly handles WebSocket upgrade headers.

```bash
# Create nginx configuration for WebSocket SSL proxy
sudo nano /etc/nginx/sites-available/medcomms
```

**Paste this configuration:**

```nginx
# Vietnamese to English (port 8765)
server {
    listen 8765 ssl;
    server_name _;

    ssl_certificate /etc/ssl/medcomms/server.crt;
    ssl_certificate_key /etc/ssl/medcomms/server.key;

    location / {
        proxy_pass http://127.0.0.1:8865;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

# English to Vietnamese (port 8766)
server {
    listen 8766 ssl;
    server_name _;

    ssl_certificate /etc/ssl/medcomms/server.crt;
    ssl_certificate_key /etc/ssl/medcomms/server.key;

    location / {
        proxy_pass http://127.0.0.1:8866;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

**Save and exit**: `Ctrl+O`, `Enter`, `Ctrl+X`

**Enable the nginx site:**

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/medcomms /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

#### Step 1.9: Create Systemd Services

**Create service for Vietnamese → English:**

```bash
sudo nano /etc/systemd/system/medcomms-vi-en.service
```

**Paste this content** (change `--device cpu` to `--device cuda` if using GPU):

```ini
[Unit]
Description=MedComms Translation Server (Vietnamese to English)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/live-translation
Environment="PATH=/home/ubuntu/live-translation/venv/bin"
ExecStart=/home/ubuntu/live-translation/venv/bin/live-translate-server \
  --asr_backend phowhisper \
  --whisper_model vinai/PhoWhisper-large \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-vi2en-v2 \
  --src_lang vi \
  --tgt_lang en \
  --ws_port 8865 \
  --device cuda

Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
MemoryMax=16G

[Install]
WantedBy=multi-user.target
```

**Save and exit**: `Ctrl+O`, `Enter`, `Ctrl+X`

**Create service for English → Vietnamese:**

```bash
sudo nano /etc/systemd/system/medcomms-en-vi.service
```

**Paste this content** (change device if using GPU):

```ini
[Unit]
Description=MedComms Translation Server (English to Vietnamese)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/live-translation
Environment="PATH=/home/ubuntu/live-translation/venv/bin"
ExecStart=/home/ubuntu/live-translation/venv/bin/live-translate-server \
  --asr_backend whisper \
  --whisper_model large-v3 \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-en2vi-v2 \
  --src_lang en \
  --tgt_lang vi \
  --ws_port 8866 \
  --device cuda

Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
MemoryMax=16G

[Install]
WantedBy=multi-user.target
```

**Save and exit**: `Ctrl+O`, `Enter`, `Ctrl+X`

**Enable and start all services:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable medcomms-vi-en medcomms-en-vi nginx

# Start services
sudo systemctl start medcomms-vi-en medcomms-en-vi

# Verify all services are running
sudo systemctl status medcomms-vi-en
sudo systemctl status medcomms-en-vi
sudo systemctl status nginx

# Check ports are listening
sudo netstat -tlnp | grep -E '8765|8766|8865|8866'
# Expected output:
# 8765 - nginx (SSL proxy)
# 8766 - nginx (SSL proxy)
# 8865 - python (backend)
# 8866 - python (backend)
```

**Test WebSocket SSL:**

```bash
# Test that SSL is working
curl -i https://localhost:8765/ -k
# Should return "426 Upgrade Required" - this is expected for WebSocket servers
```

**✅ Backend deployment complete!** EC2 is now running translation servers with SSL.

---

### Phase 2: Deploy Frontend to AWS Amplify (30 minutes)

#### Step 2.1: Prepare Frontend Repository

**Create separate frontend repository:**

```bash
# On your local machine
cd /Users/giangson/coding/live-translation

# Create new directory for frontend-only
mkdir medical-webapp-frontend
cd medical-webapp-frontend

# Copy frontend files
cp ../medical-translation-webapp/*.html .
cp ../medical-translation-webapp/*.css .
cp ../medical-translation-webapp/*.js .
cp ../medical-translation-webapp/*.wasm .

# Initialize git
git init
git add .
git commit -m "Initial frontend for AWS Amplify"

# Create GitHub repository
# Go to https://github.com/new
# Name: medical-webapp-frontend
# Create repository (don't initialize with README)

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/medical-webapp-frontend.git
git branch -M main
git push -u origin main
```

#### Step 2.2: Deploy to AWS Amplify

**Using AWS Console:**

1. **Go to AWS Amplify Console:**
   - Navigate to: https://console.aws.amazon.com/amplify
   - Click **"New app"** → **"Host web app"**

2. **Connect Repository:**
   - Select **"GitHub"**
   - Click **"Continue"**
   - Authorize AWS Amplify to access your GitHub
   - Select repository: `medical-webapp-frontend`
   - Select branch: `main`
   - Click **"Next"**

3. **Configure Build Settings:**
   - App name: `medcomms-translation`
   - Environment: `production`
   - Build settings: Amplify will auto-detect static site
   - Click **"Next"**

4. **Review and Deploy:**
   - Review settings
   - Click **"Save and deploy"**
   - Wait 2-5 minutes for deployment

5. **Get Your Amplify URL:**
   - Once deployed, you'll see: `https://main.d1a2b3c4d5e6f7.amplifyapp.com`
   - **Copy this URL** - this is your production frontend URL!

#### Step 2.3: Update Frontend Configuration

**Update app.js with EC2 backend URL:**

```bash
# On your local machine
cd medical-webapp-frontend
nano app.js
```

**Find the CONFIG object (around line 13) and update:**

```javascript
const CONFIG = {
    // IMPORTANT: Use wss:// (secure WebSocket) and your EC2 Elastic IP
    WS_BASE_URL: 'wss://YOUR_EC2_ELASTIC_IP',  // Replace with your EC2 Elastic IP
    PORTS: {
        'vi-en': '8765',  // SSL port (nginx)
        'en-vi': '8766'   // SSL port (nginx)
    },
    SAMPLE_RATE: 16000,
    CHUNK_SIZE: 640,
    OPUS_BITRATE: 30000,
    MAX_TEXT_LENGTH: 5000,
    LANGUAGES: {
        'vi': 'Vietnamese',
        'en': 'English'
    },
    DEFAULT_DIRECTION: 'vi-en'
};
```

**Save, commit, and push:**

```bash
git add app.js
git commit -m "Configure WebSocket to use EC2 backend"
git push origin main
```

**Amplify will auto-deploy** in 2-3 minutes. Watch the progress in Amplify Console.

---

### Phase 3: Test Your Deployment (15 minutes)

#### Step 3.1: Accept SSL Certificates

Since we're using self-signed certificates on EC2, you need to accept them first:

1. **Open in new tabs:**
   ```
   https://YOUR_EC2_IP:8765
   https://YOUR_EC2_IP:8766
   ```

2. **Accept security warnings:**
   - Chrome: Click "Advanced" → "Proceed to [IP] (unsafe)"
   - Firefox: Click "Advanced" → "Accept the Risk and Continue"

3. You should see "Connection closed" or similar - this is OK, we just needed to accept the certificate

#### Step 3.2: Test the Application

1. **Open your Amplify URL** in browser:
   ```
   https://main.d1a2b3c4d5e6f7.amplifyapp.com
   ```

2. **Open browser console** (F12 → Console tab)

3. **Test Vietnamese → English:**
   - Select "Vietnamese → English"
   - Click "Record Audio"
   - Allow microphone access
   - Speak in Vietnamese
   - Verify transcription and translation appear

4. **Test English → Vietnamese:**
   - Click language switch button
   - Click "Record Audio"
   - Speak in English
   - Verify transcription and translation appear

5. **Test Upload Audio:**
   - Click "Upload Audio"
   - Upload a Vietnamese audio file
   - Verify processing works

6. **Test Type Text:**
   - Click "Type Text"
   - Enter Vietnamese text
   - Verify translation appears

**Expected console output:**

```
Connecting to: wss://YOUR_EC2_IP:8765
WebSocket connected successfully
Audio encoding initialized
Recording started
Received transcription: [Vietnamese text]
Received translation: [English text]
```

#### Step 3.3: Monitor Server Resources

```bash
# SSH to EC2
ssh -i ~/Downloads/medcomms-key.pem ubuntu@YOUR_EC2_IP

# Check CPU and memory usage
htop

# Expected usage:
# - Both models loaded: ~22 GB RAM
# - CPU: varies with usage (0-100%)
# - Should NOT be swapping (SWAP should be low)

# Check disk space
df -h

# Check server logs
sudo journalctl -u medcomms-vi-en -f  # Ctrl+C to exit
sudo journalctl -u medcomms-en-vi -f
```

**✅ Deployment complete!** Your application is now live on AWS.

---

## Managing Your Deployment

### Starting/Stopping EC2 Instance (Save Money)

**Stop instance** (saves ~$236-376/month):
```bash
# From AWS Console:
# EC2 → Instances → Select instance → Instance state → Stop instance
```

**Start instance**:
```bash
# From AWS Console:
# EC2 → Instances → Select instance → Instance state → Start instance

# Note: Elastic IP stays the same, no config changes needed!
```

### Updating Frontend

```bash
# On your local machine
cd medical-webapp-frontend

# Make changes to HTML/CSS/JS
nano app.js  # or edit in your IDE

# Commit and push
git add .
git commit -m "Update feature X"
git push origin main

# Amplify auto-deploys in 2-3 minutes
# Check progress: Amplify Console → Your app → Deployments
```

### Updating Backend

```bash
# SSH to EC2
ssh -i ~/Downloads/medcomms-key.pem ubuntu@YOUR_EC2_IP

# Update code
cd ~/live-translation
git pull
source venv/bin/activate
pip install -e .

# Restart services
sudo systemctl restart medcomms-vi-en medcomms-en-vi

# Verify services restarted successfully
sudo systemctl status medcomms-vi-en medcomms-en-vi
```

### Viewing Logs

**Frontend logs (Amplify):**
- Amplify Console → Your app → Deployments → Click build → View logs

**Backend logs (EC2):**
```bash
# View live logs
sudo journalctl -u medcomms-vi-en -f
sudo journalctl -u medcomms-en-vi -f
# nginx logs are in /var/log/nginx/
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log

# View last 100 lines
sudo journalctl -u medcomms-vi-en -n 100

# View errors only
sudo journalctl -u medcomms-vi-en -p err

# View logs from last hour
sudo journalctl -u medcomms-vi-en --since "1 hour ago"
```

### Cost Monitoring

**Amplify costs:**
- Amplify Console → Your app → Settings → Usage
- Free tier: 1000 build minutes/month, 15 GB served/month

**EC2 costs:**
- AWS Console → Billing Dashboard → Bills
- Set up billing alerts: Billing → Billing preferences → Enable alerts

---

## Troubleshooting

### Issue: "WebSocket connection failed" / "net::ERR_CERT_AUTHORITY_INVALID"

**Cause:** Browser blocks self-signed SSL certificate

**Solution:**
1. Open `https://YOUR_EC2_IP:8765` in new tab
2. Accept security warning
3. Repeat for `https://YOUR_EC2_IP:8766`
4. Return to Amplify app and retry

### Issue: "Mixed content" error

**Cause:** Amplify (HTTPS) trying to connect to EC2 (HTTP)

**Solution:** Ensure you're using `wss://` (not `ws://`) in `app.js`

### Issue: Can't connect to WebSocket

**Check EC2 security group:**
```bash
# AWS Console → EC2 → Security Groups
# Verify rules allow:
# - Custom TCP 8765 from 0.0.0.0/0
# - Custom TCP 8766 from 0.0.0.0/0
```

**Check nginx is running:**
```bash
sudo systemctl status nginx
sudo netstat -tlnp | grep nginx
```

**Check backend services:**
```bash
sudo systemctl status medcomms-vi-en medcomms-en-vi
```

### Issue: "Out of memory" / Server crashes

**Symptoms**: Services crash, server becomes unresponsive

**Solutions:**
1. You're using large models on t3.2xlarge (32 GB RAM). If still running out:
   ```
   Current: t3.2xlarge (32 GB RAM)
   Upgrade to: t3.4xlarge (64 GB RAM) - costs ~$480/month
   Or use: g4dn.xlarge (16 GB RAM + GPU) - more efficient
   ```

2. Add swap space (not recommended for large models, but can help):
   ```bash
   # Create 8 GB swap
   sudo fallocate -l 8G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile

   # Make permanent
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. Switch to GPU instance for better memory efficiency:
   - GPU offloads model weights to VRAM
   - g4dn.xlarge has 16 GB GPU memory
   - More cost-effective than large CPU instances

4. Use smaller models (if large models not required):
   ```
   Change: vinai/PhoWhisper-large → vinai/PhoWhisper-small
   Change: large-v3 Whisper → base Whisper
   ```

### Issue: "Connection closed unexpectedly"

**Check backend logs:**
```bash
sudo journalctl -u medcomms-vi-en -n 100
```

**Common causes:**
- Out of memory (check with `htop`)
- Model not loaded (check logs for errors)
- Port mismatch (verify 8865, 8866 internally, 8765, 8766 externally)

### Issue: Amplify deployment failed

**Check build logs:**
- Amplify Console → Your app → Deployments → Failed build → View logs

**Common issues:**
- Missing files in repository
- Incorrect build settings
- GitHub connection expired (reconnect in Amplify settings)

---

## Optional: Add Custom Domain

If you want a custom domain instead of `xxx.amplifyapp.com`:

### Step 1: Add Domain in Amplify

1. **In Amplify Console** → Your app → **"Domain management"**
2. Click **"Add domain"**
3. Enter your domain: `medcomms.yourdomain.com`
4. Amplify will provide DNS records

### Step 2: Update DNS

Add these records at your domain registrar:

```
Type: CNAME
Name: medcomms
Value: [Amplify provides this]
TTL: 300
```

### Step 3: Wait for SSL

Amplify automatically provisions SSL certificate via AWS Certificate Manager (5-10 minutes).

### Step 4: (Optional) Add Real SSL to EC2 Backend

For production, replace self-signed cert with Let's Encrypt:

```bash
# On EC2, you'll need a domain pointing to your EC2 IP first
# Add A record: backend.yourdomain.com → YOUR_EC2_IP

# Install certbot with nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (certbot will automatically configure nginx)
sudo certbot --nginx -d backend.yourdomain.com

# Or get certificate only (manual configuration)
sudo certbot certonly --standalone -d backend.yourdomain.com \
  --pre-hook "sudo systemctl stop nginx" \
  --post-hook "sudo systemctl start nginx"
```

If using manual configuration, update nginx config:
```bash
sudo nano /etc/nginx/sites-available/medcomms
```

Change cert paths:
```nginx
ssl_certificate /etc/letsencrypt/live/backend.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/backend.yourdomain.com/privkey.pem;
```

Restart nginx:
```bash
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

**Auto-renewal:** Certbot sets up automatic renewal. Test with:
```bash
sudo certbot renew --dry-run
```

---

## Security Best Practices

### 1. Restrict SSH Access

```bash
# Edit security group in AWS Console
# EC2 → Security Groups → medcomms-backend-sg
# SSH rule: Change source from "My IP" to specific IP ranges
```

### 2. Setup Firewall (Optional)

```bash
# Install UFW (Uncomplicated Firewall)
sudo apt install ufw

# Allow SSH, WebSocket ports
sudo ufw allow 22/tcp
sudo ufw allow 8765/tcp
sudo ufw allow 8766/tcp

# Deny all other incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable firewall
sudo ufw enable
```

### 3. Regular Updates

```bash
# Setup automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 4. Backup Important Data

```bash
# Create snapshot of EBS volume
# AWS Console → EC2 → Elastic Block Store → Snapshots → Create snapshot
# Select your volume → Create
# Cost: ~$0.05 per GB-month
```

---

## Cost Optimization Summary

| Strategy | CPU (t3.2xlarge) | GPU (g4dn.xlarge) | Trade-off |
|----------|------------------|-------------------|-----------|
| **On-demand 24/7** | ~$244/mo | ~$384/mo | Always available |
| **Stop when not in use** | ~$4-6/mo | ~$4-6/mo | Manual start/stop |
| **Auto start/stop (40h/week)** | ~$60/mo | ~$95/mo | Business hours only |
| **Spot instance 24/7** | ~$72/mo | ~$114/mo | Can be interrupted |
| **Reserved (1 year)** | ~$144/mo | ~$228/mo | 1-year commitment |
| **Spot + Auto-restart** | ~$72/mo | ~$114/mo | Best value |

**💡 Recommended Strategy**:

**For Internal Demo/Testing:**
1. Use **on-demand** instance (CPU or GPU)
2. **Stop when not in use** (evenings/weekends)
3. Total cost: **$4-6/month** (storage only)
4. Set calendar reminder to stop instance after demos

**For Production (24/7):**
1. Use **Spot Instance** with auto-restart script
2. CPU: **~$72/month** | GPU: **~$114/month**
3. 70% cost savings vs on-demand
4. Minimal interruptions (~1-2 times per month)
5. Auto-restart ensures high availability

---

## Conclusion

You now have a fully functional, production-ready medical translation system running on AWS!

**Architecture**: Frontend (Amplify) + Backend (EC2) + Models
**Setup Cost**: $0 (no upfront costs, free SSL)
**Monthly Cost**: $4-116 (depending on usage pattern)
**Setup Time**: 3-4 hours

**Your URLs**:
- Frontend: `https://main.d123.amplifyapp.com` (Amplify provides)
- Backend: `wss://YOUR_EC2_IP:8765` (vi→en)
- Backend: `wss://YOUR_EC2_IP:8766` (en→vi)

**Next Steps:**
1. ✅ Test thoroughly with your team
2. ✅ Monitor costs in AWS Billing Dashboard
3. ✅ Setup CloudWatch alarms for high costs (optional)
4. ✅ Document URLs and access info for your team
5. ✅ Schedule regular backups (snapshots)

**Questions?** Check the troubleshooting section or AWS documentation.

---

**Last Updated**: 2025-12-29
**Version**: 2.1 (Amplify + EC2 + nginx)
