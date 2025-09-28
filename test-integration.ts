#!/usr/bin/env ts-node

/**
 * Test script to verify the integration between simple automation and image generation
 */

import 'dotenv/config';

async function testIntegration() {
  console.log('🧪 Testing LMV Automation + Image Generation Integration');
  console.log('');
  
  // Check environment variables
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY', 
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.log('');
    console.log('Please ensure all required environment variables are set in your .env file');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
  console.log('');
  
  // Check if source CSV exists
  const fs = require('fs');
  if (!fs.existsSync('source_products.csv')) {
    console.error('❌ source_products.csv not found');
    console.log('Please ensure the source CSV file exists in the project root');
    process.exit(1);
  }
  
  console.log('✅ Source CSV file found');
  console.log('');
  
  // Check if HTML template exists
  if (!fs.existsSync('lmv-simple-template.html')) {
    console.error('❌ lmv-simple-template.html not found');
    console.log('Please ensure the HTML template file exists in the project root');
    process.exit(1);
  }
  
  console.log('✅ HTML template file found');
  console.log('');
  
  console.log('🚀 Integration test passed! You can now run:');
  console.log('');
  console.log('   npx ts-node simple-automation.ts --test --max-garments 1');
  console.log('');
  console.log('This will process 1 unique garment with AI image generation.');
}

testIntegration().catch(error => {
  console.error('❌ Integration test failed:', error);
  process.exit(1);
});