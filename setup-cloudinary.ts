#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupCloudinary() {
  console.log('🚀 Cloudinary Setup for Kiro Image Generator\n');
  console.log('This script will help you configure Cloudinary credentials in your .env file.\n');
  
  console.log('📋 You can find these credentials in your Cloudinary dashboard:');
  console.log('   1. Go to https://cloudinary.com/console');
  console.log('   2. Sign in to your account');
  console.log('   3. Copy the credentials from your dashboard\n');

  try {
    const cloudName = await question('Enter your Cloudinary Cloud Name: ');
    const apiKey = await question('Enter your Cloudinary API Key: ');
    const apiSecret = await question('Enter your Cloudinary API Secret: ');
    const folder = await question('Enter folder name for images (default: product-images): ') || 'product-images';

    if (!cloudName || !apiKey || !apiSecret) {
      console.log('❌ All credentials are required. Please try again.');
      rl.close();
      return;
    }

    // Read existing .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add Cloudinary configuration
    const cloudinaryConfig = `
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=${cloudName}
CLOUDINARY_API_KEY=${apiKey}
CLOUDINARY_API_SECRET=${apiSecret}
CLOUDINARY_FOLDER=${folder}`;

    // Remove existing Cloudinary configuration if present
    envContent = envContent.replace(/# Cloudinary Configuration[\s\S]*?(?=\n#|\n[A-Z]|$)/g, '');
    
    // Add new configuration
    envContent += cloudinaryConfig;

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Cloudinary configuration saved to .env file!');
    console.log('\n🧪 Testing your configuration...');

    // Test the configuration
    const { testCloudinaryConfig } = await import('./test-cloudinary');
    const configOk = await testCloudinaryConfig();

    if (configOk) {
      console.log('\n🎉 Setup complete! Your Cloudinary configuration is working.');
      console.log('\nNext steps:');
      console.log('   1. Run: npm run test-cloudinary');
      console.log('   2. Run: npm run test-single-image');
      console.log('   3. Start generating images with: npm run generate-images');
    } else {
      console.log('\n❌ Configuration test failed. Please check your credentials and try again.');
    }

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  setupCloudinary().catch(console.error);
}

export { setupCloudinary };