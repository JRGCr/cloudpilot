#!/bin/bash

# Development script for Pages Functions
# This script builds the app and starts the Pages dev server with Functions support

set -e

echo "🏗️  Building web app..."
npm run build

echo ""
echo "🚀 Starting Pages Functions dev server..."
echo ""
echo "📍 Server will be available at: http://localhost:8788"
echo "📍 API endpoints: http://localhost:8788/api/*"
echo ""
echo "Test endpoints:"
echo "  - Health: http://localhost:8788/api/health"
echo "  - Auth:   http://localhost:8788/api/auth/sign-in/social"
echo ""

# Start Pages dev server with Functions
npx wrangler pages dev dist --port 8788 --binding DB=local
