#!/bin/bash
# Monitor Cloudflare Workers logs and save to file
# Usage: ./scripts/monitor-logs.sh [environment] [output-file]

ENVIRONMENT=${1:-production}
OUTPUT_FILE=${2:-logs/cloudflare-tail.log}
LOG_DIR=$(dirname "$OUTPUT_FILE")

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "Starting Cloudflare Workers log monitor..."
echo "Environment: $ENVIRONMENT"
echo "Output file: $OUTPUT_FILE"
echo "Press Ctrl+C to stop"
echo ""

cd apps/api

# Run wrangler tail and append to file with timestamps
pnpm wrangler tail --env "$ENVIRONMENT" --format pretty 2>&1 | while IFS= read -r line; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line" | tee -a "../../$OUTPUT_FILE"
done
