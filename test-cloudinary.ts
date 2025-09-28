#!/usr/bin/env ts-node

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testCloudinaryConnection() {
  console.log('☁️ Testing Cloudinary API connection...');
  
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || 'product-images';
  
  if (!cloudName || !apiKey || !apiSecret) {
    console.error('❌ Cloudinary credentials not found in environment variables');
    console.error('Please set: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    return;
  }
  
  console.log(`🔑 Using cloud: ${cloudName}, folder: ${folder}`);
  
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  
  // Create a simple test image (1x1 pixel PNG)
  const testImageData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  const testImagePath = path.join(__dirname, 'test-cloudinary-image.png');
  fs.writeFileSync(testImagePath, testImageData);
  
  try {
    console.log('📤 Uploading test image to Cloudinary...');
    
    const timestamp = Date.now();
    const publicId = `test/kiro_test_${timestamp}`;
    
    const uploadResult = await cloudinary.uploader.upload(testImagePath, {
      public_id: publicId,
      folder: folder,
      resource_type: 'image',
      quality: 'auto:good',
      tags: ['test', 'kiro-image-generator'],
      context: {
        title: 'Kiro Test Image',
        generated_at: new Date().toISOString(),
        test: 'true'
      }
    });

    console.log('✅ Cloudinary upload successful!');
    console.log('📊 Upload details:');
    console.log(`   Public ID: ${uploadResult.public_id}`);
    console.log(`   Secure URL: ${uploadResult.secure_url}`);
    console.log(`   Format: ${uploadResult.format}`);
    console.log(`   Size: ${uploadResult.bytes} bytes`);
    console.log(`   Width: ${uploadResult.width}px`);
    console.log(`   Height: ${uploadResult.height}px`);
    
    // Test image transformation
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto',
      format: 'webp'
    });
    
    console.log(`🔄 Transformed URL (300x300): ${transformedUrl}`);
    
    // Clean up - delete the test image
    console.log('🧹 Cleaning up test image...');
    await cloudinary.uploader.destroy(uploadResult.public_id);
    console.log('✅ Test image deleted from Cloudinary');
    
  } catch (error: any) {
    console.error('❌ Cloudinary test error:');
    if (error.http_code) {
      console.error('HTTP Code:', error.http_code);
    }
    if (error.message) {
      console.error('Message:', error.message);
    }
    console.error('Full error:', error);
  } finally {
    // Clean up local test file
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('🧹 Local test file cleaned up');
    }
  }
}

// Test Cloudinary configuration without uploading
async function testCloudinaryConfig() {
  console.log('🔧 Testing Cloudinary configuration...');
  
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  
  if (!cloudName || !apiKey || !apiSecret) {
    console.error('❌ Cloudinary credentials not found in environment variables');
    console.error('Please set: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    return false;
  }
  
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary API ping successful:', result);
    return true;
  } catch (error: any) {
    console.error('❌ Cloudinary configuration test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting Cloudinary tests...\n');
  
  // Test 1: Configuration
  const configOk = await testCloudinaryConfig();
  if (!configOk) {
    console.log('\n❌ Configuration test failed. Please check your Cloudinary credentials.');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Upload and cleanup
  await testCloudinaryConnection();
  
  console.log('\n✅ All Cloudinary tests completed!');
}

if (require.main === module) {
  runTests().catch(console.error);
}

export { testCloudinaryConnection, testCloudinaryConfig };