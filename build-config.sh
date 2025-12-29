#!/bin/bash
# Build script to inject environment variables into static files
# This runs during Amplify deployment

set -e

echo "Starting build-config.sh..."

# Default values for local development
BACKEND_URL="${BACKEND_URL:-ws://localhost}"
NODE_ENV="${NODE_ENV:-production}"

echo "Environment: $NODE_ENV"
echo "Backend URL: $BACKEND_URL"

# Navigate to the webapp directory
cd medical-translation-webapp

# Create a temporary config file with environment variables
cat > config.env.js << EOF
// Auto-generated configuration from environment variables
// DO NOT EDIT - This file is generated during build
window.ENV_CONFIG = {
    BACKEND_URL: '${BACKEND_URL}',
    NODE_ENV: '${NODE_ENV}'
};
EOF

echo "✅ Configuration file created: config.env.js"
echo "✅ Build configuration complete!"
