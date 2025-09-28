# Product Content Automation

Automated Turkish product content enhancement and AI image generation for Shopify.

## Setup

1. **Configure .env:**
```bash
GEMINI_API_KEY=your_gemini_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=product-images
OPENAI_API_KEY=your_openai_key
```

2. **Install & Run:**
```bash
npm install
npm run automation      # Process Turkish CSV to Shopify format
npm run generate-images # Generate AI images for products
```

## Features

- **Simple Automation**: Turkish CSV → Shopify CSV with GPT-4 content enhancement
- **Image Generator**: 4 AI-generated images per product using Gemini
- **Cloudinary Integration**: Automatic image optimization and CDN delivery
- **LMV Brand Styling**: Avant-garde aesthetic with vintage/timeless appeal

## Files

- `simple-automation.ts` - Main automation script
- `image-generator.ts` - AI image generation
- `source_products.csv` - Input Turkish CSV
- `output/` - Generated Shopify CSV and images