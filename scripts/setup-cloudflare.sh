#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Cloudflare Infrastructure Setup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI not found${NC}"
    echo "Please install it with: pnpm install -g wrangler"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "apps/api/wrangler.toml" ]; then
    echo -e "${RED}Error: Must run this script from the repository root${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Creating D1 Database${NC}"
echo ""

# Create D1 database (ignore error if it already exists)
if wrangler d1 create cloudpilot 2>/dev/null; then
    echo -e "${GREEN}✓ D1 database created${NC}"
else
    echo -e "${YELLOW}⚠ Database may already exist, continuing...${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Getting Database ID${NC}"
echo ""

# Get the database ID
D1_ID=$(wrangler d1 list --json | jq -r '.[] | select(.name == "cloudpilot") | .uuid' | head -1)

if [ -z "$D1_ID" ]; then
    echo -e "${RED}Error: Could not find D1 database 'cloudpilot'${NC}"
    echo "Please check your Cloudflare account and try again."
    exit 1
fi

echo -e "${GREEN}✓ Found database ID: ${D1_ID}${NC}"

echo ""
echo -e "${YELLOW}Step 3: Updating wrangler.toml${NC}"
echo ""

# Update wrangler.toml with the database ID
cat > apps/api/wrangler.toml << EOF
name = "cloudpilot-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[dev]
port = 8787

[[d1_databases]]
binding = "DB"
database_name = "cloudpilot"
database_id = "local"
migrations_dir = "../../migrations"

[env.preview]
name = "cloudpilot-api-preview"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "cloudpilot"
database_id = "local"
migrations_dir = "../../migrations"

[env.production]
name = "cloudpilot-api"

[[env.production.d1_databases]]
binding = "DB"
database_name = "cloudpilot"
database_id = "$D1_ID"
migrations_dir = "../../migrations"
EOF

echo -e "${GREEN}✓ Updated wrangler.toml${NC}"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Database Configuration:"
echo "  Name: cloudpilot"
echo "  ID: $D1_ID"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff apps/api/wrangler.toml"
echo "  2. Commit the changes: git add apps/api/wrangler.toml && git commit -m 'chore: configure D1 database ID'"
echo "  3. Push to GitHub: git push"
echo "  4. Deploy will run migrations automatically"
echo ""
echo -e "${BLUE}================================================${NC}"
