# Project Context

This is a Turkish product content automation system for Shopify with AI image generation.

## Main Components

- **simple-automation.ts**: Processes Turkish CSV to Shopify format using GPT-4
- **image-generator.ts**: Generates 4 AI images per product using Gemini
- **LMV Brand**: Avant-garde, chic, vintage aesthetic targeting Turkish fashion market

## Key APIs

- **Gemini 2.5 Flash**: For image generation (4 images per product)
- **GPT-4**: For Turkish content enhancement and translation
- **Cloudinary**: For image hosting and optimization

## Rate Limits

- Gemini: 400 requests/minute, 500k/day
- Process in batches with delays between requests
- Generate: garment views + styled photoshoot scenes