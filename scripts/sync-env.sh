#!/bin/bash

# Sync Integration Environment Variables to web/.env.local
# This script copies integration keys from root .env to web/.env.local

echo "🔄 Syncing integration environment variables..."

ROOT_ENV_FILE=".env.local"
WEB_ENV_FILE="web/.env.local"

if [ ! -f "$ROOT_ENV_FILE" ]; then
  echo "❌ Root .env.local not found. Please create it first from env.template"
  exit 1
fi

# Create web/.env.local if it doesn't exist
touch "$WEB_ENV_FILE"

# Integration keys to sync (these are needed by API routes)
KEYS_TO_SYNC=(
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "GOOGLE_SERVICE_ACCOUNT_KEY"
  "GOOGLE_DRIVE_FOLDER_ID"
  "CLICKUP_API_TOKEN"
  "CLICKUP_WORKSPACE_ID"
  "GREEN_API_INSTANCE_ID"
  "GREEN_API_TOKEN"
  "APIFY_TOKEN"
  "OPENAI_API_KEY"
  "GEMINI_API_KEY"
  "ALLOWED_DOMAIN"
)

for KEY in "${KEYS_TO_SYNC[@]}"; do
  # Get value from root .env.local
  VALUE=$(grep "^${KEY}=" "$ROOT_ENV_FILE" | cut -d '=' -f2-)
  
  if [ -n "$VALUE" ]; then
    # Remove existing key from web/.env.local
    sed -i.bak "/^${KEY}=/d" "$WEB_ENV_FILE" 2>/dev/null
    
    # Add new value
    echo "${KEY}=${VALUE}" >> "$WEB_ENV_FILE"
    echo "✓ Synced ${KEY}"
  else
    echo "⚠️  ${KEY} not found in root .env.local"
  fi
done

# Clean up backup file
rm -f "$WEB_ENV_FILE.bak"

echo ""
echo "✅ Environment variables synced to web/.env.local"
echo "🔄 Restart your dev server for changes to take effect"
