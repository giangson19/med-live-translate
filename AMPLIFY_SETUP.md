# AWS Amplify Deployment Setup

This guide walks you through deploying the medical-translation-webapp directly from this repository using the subdirectory approach.

## Prerequisites

- [ ] AWS Account
- [ ] GitHub account (repository already set up)
- [ ] EC2 backend deployed (see AWS_DEPLOYMENT_GUIDE.md)

## Step 1: Push Your Work

`amplify.yml` and `build-config.sh` are already committed at the repository root — nothing to add.
Just make sure `main` is up to date, since Amplify builds from the pushed branch:

```bash
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
4. Select repository: **`med-live-translate`**
5. Select branch: **`main`**
6. Click **"Next"**

### 2.3 Configure Build Settings

Amplify should automatically detect the `amplify.yml` file. You should see:

- **App name**: `med-live-translate` (or rename to `medcomms`)
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

The backend URL is set with an **Amplify environment variable** — never by editing `app.js`.
During the build, `build-config.sh` writes it into `medical-translation-webapp/config.env.js`,
which `app.js` reads as `window.ENV_CONFIG.BACKEND_URL`.

1. Amplify Console → your app → **"Environment variables"** → **"Manage variables"**
2. Add:

   | Key | Value |
   |---|---|
   | `BACKEND_URL` | `wss://YOUR_EC2_ELASTIC_IP` |
   | `NODE_ENV` | `production` |

3. **Redeploy** for the variables to take effect: **"Redeploy this version"**, or push to `main`.

Notes:
- Use `wss://`, not `ws://` — an HTTPS page cannot open an insecure WebSocket.
- Omit the port. `app.js` appends `8765` (vi→en) or `8766` (en→vi) itself.
- If the deployed app still talks to `ws://localhost`, the variable is missing or the build did not
  rerun — that string is the fallback baked into `app.js`.

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

1. Open browser console (F12) and expand the in-app **Connection Log**
2. Test Vietnamese → English translation (record audio)
3. Test English → Vietnamese translation (swap with ⇄, then record)
4. Confirm completed exchanges land in **Dialogue History**

(Text input mode is currently hidden pending a server-side text-only endpoint.)

## Updating Your Frontend

To make updates, simply edit files and push:

```bash
cd medical-translation-webapp

# Make your changes to app.js / styles.css / index.html

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
