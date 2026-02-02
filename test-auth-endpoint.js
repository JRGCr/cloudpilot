#!/usr/bin/env node

/**
 * Test script to check GitHub auth endpoint and capture errors
 */

const BASE_URL = 'https://cloudpilot-web.pages.dev';

async function testAuthEndpoint() {
  console.log('🧪 Testing GitHub Auth Endpoint');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  try {
    // Test 1: Check auth health/status
    console.log('1. Testing auth endpoint health...');
    const healthResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CloudPilot-Test/1.0',
      },
    });

    console.log(`   Status: ${healthResponse.status} ${healthResponse.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(healthResponse.headers.entries()));
    
    if (healthResponse.status !== 200) {
      const errorText = await healthResponse.text();
      console.log(`   Error Body: ${errorText.substring(0, 500)}`);
    }
    console.log('');

    // Test 2: Try to initiate GitHub OAuth (this should trigger the 500 error)
    console.log('2. Testing GitHub OAuth initiation...');
    const oauthResponse = await fetch(`${BASE_URL}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': BASE_URL,
        'User-Agent': 'CloudPilot-Test/1.0',
      },
      body: JSON.stringify({
        provider: 'github',
      }),
    });

    console.log(`   Status: ${oauthResponse.status} ${oauthResponse.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(oauthResponse.headers.entries()));
    
    const responseText = await oauthResponse.text();
    console.log(`   Response Body: ${responseText}`);
    
    if (oauthResponse.status >= 400) {
      try {
        const errorData = JSON.parse(responseText);
        console.log('   Parsed Error:', errorData);
      } catch (e) {
        console.log('   Raw Error Text:', responseText);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testAuthEndpoint().catch(console.error);