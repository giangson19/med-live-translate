# AWS Amplify Deployment Setup

This guide walks you through deploying the medical-translation-webapp directly from this repository using the subdirectory approach.

## Prerequisites

- [ ] AWS Account
- [ ] GitHub account (repository already set up)
- [ ] EC2 backend deployed (see AWS_DEPLOYMENT_GUIDE.md)

## Step 1: Push Amplify Configuration

The `amplify.yml` file is already created in the root directory. Commit and push it:

```bash
cd /Users/giangson/coding/live-translation
git add amplify.yml AMPLIFY_SETUP.md
git commit -m "Add Amplify configuration for subdirectory deployment"
git push origin main
```

## Step 2: Deploy to AWS Amplify

### 2.1 Create New App in Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click **"New app"** → **"Host web app"**

### 2.2 Connect Your Repository

1. Select **"GitHub"**
2. Click **"Continue"**
3. Authorize AWS Amplify to access your GitHub account
4. Select repository: **`live-translation`** (your current repo)
5. Select branch: **`main`**
6. Click **"Next"**

### 2.3 Configure Build Settings

Amplify should automatically detect the `amplify.yml` file. You should see:

- **App name**: `live-translation` (or rename to `medical-translation-app`)
- **Environment**: `production`
- **Build settings**: Detected from `amplify.yml`

The configuration should show:
```yaml
baseDirectory: medical-translation-webapp
```

Click **"Next"**

### 2.4 Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. Wait 2-5 minutes for the deployment to complete

### 2.5 Get Your Amplify URL

Once deployed, you'll see a URL like:
```
https://main.d1a2b3c4d5e6f7.amplifyapp.com
```

**Save this URL** - this is your production frontend!

## Step 3: Configure Backend Connection

Now you need to update the frontend to connect to your EC2 backend.

### Option A: Using Environment Variables (Recommended for Production)

1. In Amplify Console → Your app → **"Environment variables"**
2. Add variables:
   - Key: `BACKEND_IP`, Value: `YOUR_EC2_ELASTIC_IP`

3. Update `app.js` to read from environment (requires build step)

### Option B: Direct Configuration (Simpler for Now)

Update the WebSocket URL in `app.js`:

```bash
# Edit app.js
nano medical-translation-webapp/app.js
```

Change line 8 from:
```javascript
WS_BASE_URL: 'ws://localhost',
```

To:
```javascript
WS_BASE_URL: 'wss://YOUR_EC2_ELASTIC_IP',  // Replace with your EC2 IP
```

Then commit and push:
```bash
git add medical-translation-webapp/app.js
git commit -m "Configure WebSocket to use EC2 backend"
git push origin main
```

Amplify will automatically redeploy in 2-3 minutes.

## Step 4: Test Your Deployment

### 4.1 Accept SSL Certificates (Self-signed)

Open these URLs in new tabs and accept the security warnings:
```
https://YOUR_EC2_IP:8765
https://YOUR_EC2_IP:8766
```

### 4.2 Open Your Application

Visit your Amplify URL:
```
https://main.d1a2b3c4d5e6f7.amplifyapp.com
```

### 4.3 Test Features

1. Open browser console (F12)
2. Test Vietnamese → English translation
3. Test English → Vietnamese translation
4. Test upload and text modes

## Updating Your Frontend

To make updates, simply edit files and push:

```bash
cd /Users/giangson/coding/live-translation/medical-translation-webapp

# Make your changes
nano app.js
nano styles.css
nano index.html

# Commit and push
git add .
git commit -m "Description of changes"
git push origin main

# Amplify auto-deploys in 2-3 minutes!
```

No copying, no separate repository needed!

## Monitoring Deployments

- **Amplify Console** → Your app → **"Deployments"**
- View build logs, deployment status, and history
- Each git push triggers a new deployment

## Troubleshooting

### Build Fails

Check **Build logs** in Amplify Console. Common issues:
- `amplify.yml` syntax error
- Incorrect `baseDirectory` path

### Application Loads but WebSocket Fails

1. Verify EC2 backend is running
2. Check security group allows ports 8765, 8766
3. Ensure using `wss://` not `ws://`
4. Accept SSL certificates as described in Step 4.1

### Changes Not Appearing

1. Check Amplify Console → Deployments for build status
2. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
3. Verify commit was pushed to main branch

## Cost

- **Amplify hosting**: $0-2/month
  - Free tier: 1000 build minutes, 15 GB served/month
  - Pay-as-you-go after free tier
- **EC2 backend**: See AWS_DEPLOYMENT_GUIDE.md

## Next Steps

- [ ] Set up custom domain (optional)
- [ ] Configure monitoring and alerts
- [ ] Set up staging environment on different branch
- [ ] Add CI/CD testing

---

**Questions?** Refer to the [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
