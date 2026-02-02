#!/usr/bin/env node

/**
 * Check deployment status and logs
 */

const BASE_URL = 'https://cloudpilot-web.pages.dev';

async function checkDeployment() {
  console.log('🔍 Checking Deployment Status');
  console.log('============================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  try {
    // Check if the site is up and get build info
    console.log('1. Checking main site...');
    const siteResponse = await fetch(`${BASE_URL}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'CloudPilot-Test/1.0',
      },
    });

    console.log(`   Status: ${siteResponse.status} ${siteResponse.statusText}`);
    
    if (siteResponse.ok) {
      const html = await siteResponse.text();
      // Look for build version in the HTML
      const buildMatch = html.match(/"buildVersion":"([^"]+)"/);
      const buildTimeMatch = html.match(/"buildTime":"([^"]+)"/);
      
      if (buildMatch) {
        console.log(`   Build Version: ${buildMatch[1]}`);
      }
      if (buildTimeMatch) {
        console.log(`   Build Time: ${buildTimeMatch[1]}`);
      }
    }
    console.log('');

    // Check the auth endpoint paths exist
    console.log('2. Checking auth endpoint routing...');
    const paths = [
      '/api/auth',
      '/api/auth/session', 
      '/api/auth/sign-in/social'
    ];

    for (const path of paths) {
      try {
        const response = await fetch(`${BASE_URL}${path}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        console.log(`   ${path}: ${response.status} ${response.statusText}`);
        
        // If we get a response with content, show some of it
        if (response.status !== 404 && response.headers.get('content-length') !== '0') {
          const text = await response.text();
          if (text.length > 0) {
            console.log(`     Body preview: ${text.substring(0, 200)}`);
          }
        }
      } catch (e) {
        console.log(`   ${path}: Error - ${e.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkDeployment().catch(console.error);