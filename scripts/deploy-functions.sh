#!/usr/bin/env bash
# One-shot script to deploy Supabase edge functions and set secrets.
# Run from the repo root: bash scripts/deploy-functions.sh
#
# Reads credentials from .env.local — make sure that file exists first.

set -e

SUPABASE_PROJECT_REF="pquyvedrppnskeeoymqa"
ENV_FILE="$(dirname "$0")/../.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.local not found at $ENV_FILE"
  echo "Create it from .env.example and fill in your credentials."
  exit 1
fi

# Source env vars from .env.local
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Installing Supabase CLI (if not already installed)..."
if ! command -v supabase &> /dev/null; then
  npm install -g supabase
fi

echo "Logging in to Supabase..."
supabase login

echo "Linking project..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "Deploying edge functions..."
supabase functions deploy amc-proxy --no-verify-jwt
supabase functions deploy omdb-proxy --no-verify-jwt
supabase functions deploy send-digest

echo "Setting secrets..."
supabase secrets set \
  AMC_API_KEY="${VITE_AMC_API_KEY}" \
  OMDB_API_KEY="${OMDB_API_KEY}" \
  TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID}" \
  TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN}" \
  TWILIO_FROM_NUMBER="${TWILIO_FROM_NUMBER}"

echo ""
echo "Done! Edge functions are live."
echo "  amc-proxy:   https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/amc-proxy"
echo "  send-digest: https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/send-digest"
echo ""
echo "To schedule the daily digest, enable pg_cron in:"
echo "  Supabase Dashboard > Database > Extensions"
echo "Then run this in the SQL editor (replace SERVICE_ROLE_KEY):"
echo ""
echo "  SELECT cron.schedule("
echo "    'send-digest',"
echo "    '0 14 * * *',"
echo "    \$\$SELECT net.http_post("
echo "      url := 'https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/send-digest',"
echo "      headers := '{\"Authorization\": \"Bearer <SERVICE_ROLE_KEY>\"}'::jsonb"
echo "    );\$\$"
echo "  );"
