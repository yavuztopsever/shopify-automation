#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import { ImageGenerator } from './image-generator';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting Image Generation Process...');
  console.log('📁 Processing CSV:', '/home/yavuz/Projects/shopify_automation/output/lmv_shopify_products.csv');
  
  try {
    const generator = new ImageGenerator();
    await generator.processProducts();
    console.log('✅ Image generation completed successfully!');
  } catch (error) {
    console.error('❌ Error during image generation:', error);
    process.exit(1);
  }
}

main();