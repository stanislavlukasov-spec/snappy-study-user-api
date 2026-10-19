#!/usr/bin/env bash
set -euo pipefail

# Deployment script for snappy-study-user-api (Lambda + HTTP API via CloudFormation)

if [ -f .env ]; then
  echo "Loading environment from .env"
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/#.*//') || true
fi

REGION="${REGION:-eu-central-1}"
APP_NAME="${APP_NAME:-snappy-study-user}"

MONTH_BUCKET="${APP_NAME}-artifacts-$(date +%Y-%m)"
RELEASE_PATH="releases/$(date +%Y/%m/%d-%H%M%S)"
ZIP_NAME="snappy-study-user-api.zip"
S3_KEY="${RELEASE_PATH}/${ZIP_NAME}"

echo "Region:        ${REGION}"
echo "App name:      ${APP_NAME}"
echo "Bucket:        ${MONTH_BUCKET}"
echo "Artifact key:  ${S3_KEY}"

aws s3 mb "s3://${MONTH_BUCKET}" --region "${REGION}" 2>/dev/null || echo "Bucket exists or could not be created (ok if already exists)"

# Install / update dependencies so the zip always has the latest node_modules
echo "Installing dependencies..."
npm install

# Refresh Google's public signing keys so the Lambda can verify ID tokens offline
echo "Refreshing Google public keys..."
node scripts/fetch-google-keys.js

# Download the AWS RDS CA bundle so the Lambda can verify the DB certificate.
# This is a public certificate (not a secret) — safe to bundle with the deployment.
echo "Downloading RDS CA bundle..."
curl -sf "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" \
  -o src/shared/rds-ca-bundle.pem \
  || { echo "ERROR: Failed to download RDS CA bundle"; exit 1; }
echo "RDS CA bundle downloaded ($(wc -c < src/shared/rds-ca-bundle.pem | tr -d ' ') bytes)"

# Package only what Lambda needs (src/, node_modules/, package.json)
rm -f "${ZIP_NAME}"
zip -r "${ZIP_NAME}" src/ node_modules package.json > /dev/null

echo "Created archive ${ZIP_NAME}"

aws s3 cp "${ZIP_NAME}" "s3://${MONTH_BUCKET}/${S3_KEY}" --region "${REGION}"

echo "Uploaded to s3://${MONTH_BUCKET}/${S3_KEY}"

aws cloudformation deploy \
  --template-file aws/template.yaml \
  --stack-name snappy-study-user-api \
  --region "${REGION}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --s3-bucket "${MONTH_BUCKET}" \
  --parameter-overrides \
    ArtifactBucket="${MONTH_BUCKET}" \
    ArtifactKey="${S3_KEY}" \
    DbHost="${DB_HOST:-}" \
    DbUser="${DB_USER:-}" \
    DbPassword="${DB_PASSWORD:-}" \
    DbName="${DB_NAME:-snappy_study_user}" \
    JwtSecret="${JWT_SECRET:-}" \
    GoogleClientId="${GOOGLE_CLIENT_ID:-}" \
    AppleBundleId="${APPLE_BUNDLE_ID:-com.snappystudy.app}" \
    SenderEmail="${SENDER_EMAIL:-noreply@snappystudy.com}" \
    VpcId="${VPC_ID:-}" \
    SubnetIds="${SUBNET_IDS:-}" \
    RdsSecurityGroupId="${RDS_SG_ID:-}" \
    PrivateRouteTableId="${PRIVATE_ROUTE_TABLE_ID:-}" \
    RevenueCatWebhookAuth="${REVENUECAT_WEBHOOK_AUTH:-}" \
    SentryDsn="${SENTRY_DSN:-}" \
    UserApiKey="${USER_API_KEY:?USER_API_KEY is required}"

API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name snappy-study-user-api \
  --region "${REGION}" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

echo "Deployment complete. User API endpoint: ${API_ENDPOINT}"

# Run database migrations against the live DB
echo "Running migrations..."
bash ./migrate.sh

echo "All done."
