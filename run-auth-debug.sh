#!/bin/bash

##############################################################################
# Automated Auth Debug Capture Script
#
# This script:
# 1. Checks for required dependencies (Node.js, npm)
# 2. Installs Puppeteer if needed
# 3. Runs the automation script to capture auth logs
# 4. Outputs results to a JSON file
##############################################################################

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${1:-auth-debug-$(date +%s).json}"

echo "════════════════════════════════════════════════════════"
echo "🔍 CloudPilot Auth Debug Capture"
echo "════════════════════════════════════════════════════════"
echo ""

# Check for Node.js
echo "📦 Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Please install Node.js first:"
    echo "  macOS:   brew install node"
    echo "  Ubuntu:  sudo apt install nodejs npm"
    echo "  Or visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js found: $NODE_VERSION"
echo ""

# Create temporary directory for the script
TEMP_DIR=$(mktemp -d)
echo "📁 Using temp directory: $TEMP_DIR"

# Copy the capture script
cat > "$TEMP_DIR/capture.js" << 'CAPTURE_SCRIPT_EOF'
#!/usr/bin/env node

/**
 * Automated Auth Debug Capture
 *
 * This script opens the browser, clicks the login button,
 * and captures all console logs and network traffic to a file.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = process.argv[2] || `auth-debug-${Date.now()}.json`;
const TARGET_URL = 'https://cloudpilot-web.pages.dev';

const logs = {
  metadata: {
    timestamp: new Date().toISOString(),
    url: TARGET_URL,
    outputFile: OUTPUT_FILE,
  },
  consoleLogs: [],
  networkRequests: [],
  errors: [],
  screenshots: [],
};

async function main() {
  console.log('🚀 Starting automated auth debug capture...');
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  console.log('');

  let browser;
  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Show browser so you can see what's happening
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: {
        width: 1280,
        height: 800,
      },
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        timestamp: new Date().toISOString(),
        text: msg.text(),
      };
      logs.consoleLogs.push(logEntry);
      const prefix = msg.type() === 'error' ? '❌' : msg.type() === 'warning' ? '⚠️' : '📝';
      console.log(`${prefix} [${msg.type()}]`, msg.text());
    });

    // Capture network requests and responses
    page.on('request', (request) => {
      const reqData = {
        type: 'request',
        timestamp: new Date().toISOString(),
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
      };
      logs.networkRequests.push(reqData);
      if (request.url().includes('/api/auth')) {
        console.log(`🌐 REQUEST: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      const resData = {
        type: 'response',
        timestamp: new Date().toISOString(),
        url,
        status: response.status(),
        headers: response.headers(),
        body: null,
      };

      if (url.includes('/api/auth') || url.includes('/api/health')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            resData.body = await response.json();
          } else {
            resData.body = await response.text();
          }
        } catch (e) {
          resData.bodyError = e.message;
        }
        console.log(`📥 RESPONSE: ${resData.status} ${url}`);
        if (resData.status >= 400 && resData.body) {
          console.log(`   Body: ${JSON.stringify(resData.body).substring(0, 300)}`);
        }
      }

      logs.networkRequests.push(resData);
    });

    page.on('pageerror', (error) => {
      logs.errors.push({
        type: 'pageerror',
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
      });
      console.log('❌ Page Error:', error.message);
    });

    page.on('requestfailed', (request) => {
      logs.errors.push({
        type: 'requestfailed',
        timestamp: new Date().toISOString(),
        url: request.url(),
        failure: request.failure(),
      });
      console.log('❌ Request Failed:', request.url());
    });

    // Navigate
    console.log(`📍 Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('✅ Page loaded');

    // Screenshot
    const screenshot1 = `screenshot-initial-${Date.now()}.png`;
    await page.screenshot({ path: screenshot1, fullPage: true });
    logs.screenshots.push({ name: 'initial', path: screenshot1 });
    console.log(`📸 Screenshot: ${screenshot1}`);

    await page.waitForTimeout(2000);

    // Find login button
    console.log('🔍 Looking for login button...');
    const loginButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(btn =>
        btn.textContent.toLowerCase().includes('sign in') ||
        btn.textContent.toLowerCase().includes('github')
      );
    });

    if (!loginButton || loginButton.asElement() === null) {
      console.log('❌ Login button not found!');
      const allButtons = await page.$$eval('button, a', buttons =>
        buttons.map(btn => ({ text: btn.textContent.trim() }))
      );
      console.log('Available buttons:', allButtons);
      logs.errors.push({ type: 'automation', message: 'Login button not found', availableButtons: allButtons });
    } else {
      console.log('🖱️  Clicking login button...');
      await loginButton.click();
      console.log('✅ Clicked!');

      await page.waitForTimeout(5000);

      const screenshot2 = `screenshot-after-click-${Date.now()}.png`;
      await page.screenshot({ path: screenshot2, fullPage: true });
      logs.screenshots.push({ name: 'after-click', path: screenshot2 });
      console.log(`📸 Screenshot: ${screenshot2}`);
    }

    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    logs.errors.push({ type: 'automation', message: error.message, stack: error.stack });
  } finally {
    console.log('');
    console.log('💾 Saving logs...');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(logs, null, 2));
    console.log(`✅ Saved to: ${OUTPUT_FILE}`);
    console.log('📊 Summary:');
    console.log(`  - Console logs: ${logs.consoleLogs.length}`);
    console.log(`  - Network requests: ${logs.networkRequests.length}`);
    console.log(`  - Errors: ${logs.errors.length}`);

    if (browser) {
      await browser.close();
    }
    console.log('✅ Done!');
  }
}

main().catch(console.error);
CAPTURE_SCRIPT_EOF

chmod +x "$TEMP_DIR/capture.js"

# Create package.json
cat > "$TEMP_DIR/package.json" << 'PACKAGE_EOF'
{
  "name": "auth-debug-capture",
  "version": "1.0.0",
  "dependencies": {
    "puppeteer": "^21.0.0"
  }
}
PACKAGE_EOF

cd "$TEMP_DIR"

# Install dependencies
echo ""
echo "📦 Installing Puppeteer (this may take a minute)..."
npm install --silent

# Run the capture script
echo ""
echo "🚀 Running capture script..."
echo ""
node capture.js "$OUTPUT_FILE"

# Copy output file to original directory
if [ -f "$OUTPUT_FILE" ]; then
    cp "$OUTPUT_FILE" "$SCRIPT_DIR/$OUTPUT_FILE"
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo "✅ SUCCESS!"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "📄 Log file: $SCRIPT_DIR/$OUTPUT_FILE"
    echo ""
    echo "To view the logs:"
    echo "  cat $SCRIPT_DIR/$OUTPUT_FILE | jq '.'"
    echo ""
    echo "To see just errors:"
    echo "  cat $SCRIPT_DIR/$OUTPUT_FILE | jq '.errors'"
    echo ""
    echo "To see auth requests:"
    echo "  cat $SCRIPT_DIR/$OUTPUT_FILE | jq '.networkRequests[] | select(.url | contains(\"/api/auth\"))'"
    echo ""
fi

# Copy screenshots
for screenshot in screenshot-*.png; do
    if [ -f "$screenshot" ]; then
        cp "$screenshot" "$SCRIPT_DIR/"
        echo "📸 Screenshot: $SCRIPT_DIR/$screenshot"
    fi
done

# Cleanup
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 All done! Review the output files above."
