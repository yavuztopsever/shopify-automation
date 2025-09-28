# 🚀 Image Generator Setup Instructions

## Quick Start

1. **Get your API keys:**
   ```bash
   # Gemini API Key (Free tier available)
   # Visit: https://makersuite.google.com/app/apikey
   
   # Cloudinary API Keys (Free tier available)  
   # Visit: https://cloudinary.com/console
   ```

2. **Update .env file:**
   ```bash
   # Replace these with your actual API keys
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   CLOUDINARY_CLOUD_NAME=your_cloud_name_here
   CLOUDINARY_API_KEY=your_api_key_here
   CLOUDINARY_API_SECRET=your_api_secret_here
   CLOUDINARY_FOLDER=product-images
   ```

3. **Test the setup:**
   ```bash
   npm run test-setup
   ```

4. **Run a demo (see what prompts look like):**
   ```bash
   npm run demo
   ```

5. **Generate images for products:**
   ```bash
   npm run generate-images
   ```

## What happens when you run it:

1. **Reads your CSV** (`/home/yavuz/Projects/shopify_automation/output/lmv_shopify_products.csv`)
2. **Downloads original product images** to `temp_images/` folder
3. **Generates 3 enhanced images per product** using Gemini AI:
   - Front view with perfect studio lighting
   - Angled view showing texture and details  
   - Elegant lifestyle presentation
4. **Uploads generated images** to Cloudinary (gets optimized public URLs)
5. **Creates updated CSV** with new image URLs (`output/updated_lmv_shopify_products.csv`)
6. **Saves metadata** as JSON files for each product

## Output Files:

- `output/updated_lmv_shopify_products.csv` - Your original CSV with new image URLs
- `temp_images/` - All generated images and metadata
- `temp_images/*_metadata.json` - Generation details for each product

## Features:

✅ **Professional e-commerce prompts** - Detailed prompts for high-quality product photos  
✅ **High-fidelity to originals** - Uses your original images as reference  
✅ **3 variations per product** - Multiple angles and styles  
✅ **Batch processing** - Handles multiple products efficiently  
✅ **Error handling** - Continues even if individual products fail  
✅ **Metadata tracking** - Saves generation details  
✅ **Rate limiting** - Built-in delays to avoid API limits  

## Current Settings:

- Processes **first 5 products** for testing (change in `image-generator.ts` line 165)
- **2 second delay** between image generations to avoid rate limits
- **30 second timeout** for image downloads
- **Professional e-commerce photography style** prompts

## Customization:

Edit the `createProductPrompt()` method in `image-generator.ts` to customize prompts for your specific needs.

## Need Help?

Run `npm run test-setup` to check if everything is configured correctly.