#!/bin/bash
# deploy.sh — Build and deploy Subway Awesome Game to AWS S3 + CloudFront
#
# Usage:
#   ./deploy.sh          # Development mode (short cache + invalidation)
#   ./deploy.sh --prod   # Production mode (long cache, no invalidation needed)
#
# Prerequisites: AWS CLI configured with profile 'global_ruiliang'

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
AWS_PROFILE="global_ruiliang"
AWS_REGION="us-east-1"
S3_BUCKET="subway-awesome-game-1774199755"
CF_DISTRIBUTION_ID="E9W9IOW3TPE6T"
CF_DOMAIN="https://d1tmob3bfp3y6g.cloudfront.net"

# ─── Parse arguments ─────────────────────────────────────────────────────────
MODE="dev"
if [[ "${1:-}" == "--prod" ]]; then
  MODE="prod"
fi

echo "Deploying in ${MODE} mode..."
echo ""

# ─── Step 1: Build ───────────────────────────────────────────────────────────
echo "[1/4] Building production bundle..."
npm run build
echo "  Build complete."
echo ""

# ─── Step 2: Upload to S3 ───────────────────────────────────────────────────
echo "[2/4] Uploading to S3..."

if [[ "$MODE" == "prod" ]]; then
  # Production: hashed assets get long cache (1 year), index.html gets short cache (10 min)
  # Hashed filenames change on every build, so long cache is safe
  aws s3 sync dist/assets/ "s3://${S3_BUCKET}/assets/" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --delete \
    --cache-control "public, max-age=31536000, immutable"

  aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --cache-control "public, max-age=600"

  echo "  Uploaded with production cache headers."
else
  # Development: short cache everywhere + force invalidation
  aws s3 sync dist/ "s3://${S3_BUCKET}/" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --delete \
    --cache-control "public, max-age=60"

  echo "  Uploaded with dev cache headers (60s TTL)."
fi

echo ""

# ─── Step 3: Invalidate CloudFront cache (dev mode only) ────────────────────
if [[ "$MODE" == "dev" ]]; then
  echo "[3/4] Invalidating CloudFront cache..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "${CF_DISTRIBUTION_ID}" \
    --paths "/*" \
    --profile "${AWS_PROFILE}" \
    --query 'Invalidation.Id' \
    --output text)

  echo "  Invalidation: ${INVALIDATION_ID}"
  echo "  Waiting for completion (usually 30-60 seconds)..."

  aws cloudfront wait invalidation-completed \
    --distribution-id "${CF_DISTRIBUTION_ID}" \
    --id "${INVALIDATION_ID}" \
    --profile "${AWS_PROFILE}"

  echo "  Invalidation complete. Changes are live now."
else
  echo "[3/4] Skipping invalidation (production mode uses hashed assets)."
fi

echo ""

# ─── Step 4: Done ────────────────────────────────────────────────────────────
echo "[4/4] Deployment complete!"
echo ""
echo "  Live at: ${CF_DOMAIN}"
echo "  Mode:    ${MODE}"
echo ""
if [[ "$MODE" == "dev" ]]; then
  echo "  Changes are immediately visible (cache invalidated)."
else
  echo "  Hashed assets cached for 1 year. index.html refreshes every 10 minutes."
fi
