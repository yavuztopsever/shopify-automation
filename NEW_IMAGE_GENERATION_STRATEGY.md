# New 4-Image Generation Strategy with AI Scene Generation

## Overview

The image generator now creates **4 distinct images** per product using AI-powered scene generation, designed to provide comprehensive visual coverage for e-commerce listings:

## Scene Generation Process

Before creating photoshoot images, the system makes a **structured output call** to Gemini to generate 2 unique scene concepts based on aesthetic styles that match the garment's vibe.

## Image Types Generated

### 1. **Garment Full View** (White Background)
- **Purpose**: Clean product shot showing complete garment
- **Style**: Floating garment on pure white background
- **Focus**: Complete silhouette and overall design
- **Use Case**: Primary product listing image, catalog views

### 2. **Garment Close-up** (White Background)  
- **Purpose**: Detail shot highlighting material quality
- **Style**: Floating garment on pure white background
- **Focus**: Fabric texture, stitching, buttons, unique design elements
- **Use Case**: Product detail pages, quality showcase

### 3. **Styled Photoshoot Scene 1**
- **Purpose**: Aspirational lifestyle image with model
- **Style**: High-fashion photography with professional styling
- **Focus**: Garment worn by diverse model in contextual scene
- **Use Case**: Marketing materials, social media, lifestyle promotion

### 4. **Styled Photoshoot Scene 2**
- **Purpose**: Alternative lifestyle presentation
- **Style**: Different scene/angle showcasing garment versatility
- **Focus**: Alternative styling and context for the same garment
- **Use Case**: Additional marketing angles, A/B testing imagery

## Available Aesthetic Styles

The system chooses from 27 curated aesthetic styles:
- **Classic**: Boho, 60s housewife, 60s LA, Woodstock, French new wave, French noir, Old money
- **Refined**: Beatnik Chic, Ivy League/Preppy, Savile Row Bespoke, Art Deco Elegance
- **Functional**: Utility/Workwear, Safari/Explorer, Minimalist Modern, Nautical
- **Glamorous**: Hollywood Glamour (Golden Age), Sporty Luxe, Mediterranean Resort
- **Alternative**: Gothic Romance, Rocker/Rebel, Punk (Early), Androgynous Tailoring
- **Period**: Victorian/Edwardian, Flapper (1920s), Mod (Mid-60s British)
- **Lifestyle**: Cottagecore, Western/Cowboy

## Technical Implementation

### Step 1: AI Scene Generation
```typescript
// Structured output call to generate 2 scene concepts
const scenes = await generatePhotoshootScenes(product);
// Returns: [{ aesthetic, setting, mood, lighting, styling, model_description, composition, props }, ...]
```

### Step 2: Image Generation

#### Garment-Only Images (1 & 2)
```typescript
// Uses original image + text prompt for clean product shots
const prompt = createGarmentOnlyPrompt(product, isCloseShot);
const contentArray = [
  prompt,
  {
    inlineData: {
      data: imageData.toString('base64'),
      mimeType: 'image/webp'
    }
  }
];
```

#### Photoshoot Images (3 & 4)
```typescript
// Uses generated scene + original image for styled photography
const prompt = createPhotoshootPrompt(product, generatedScene);
const contentArray = [
  prompt,
  {
    inlineData: {
      data: imageData.toString('base64'),
      mimeType: 'image/webp'
    }
  }
];
```

### File Naming Convention
- `generated_1_garment_long.png` - Full view white background
- `generated_2_garment_close.png` - Close-up white background  
- `generated_3_photoshoot_1.png` - Styled scene 1
- `generated_4_photoshoot_2.png` - Styled scene 2

### Upload Titles
- "Product Name - Full View - White Background"
- "Product Name - Close-up Details - White Background"
- "Product Name - Styled Photoshoot Scene 1"
- "Product Name - Styled Photoshoot Scene 2"

## Key Prompt Features

### Garment-Only Prompts
- **Background**: Pure white (RGB 255,255,255)
- **Presentation**: Floating/hovering garment
- **Lighting**: Professional studio lighting
- **Style**: Clean, minimalist e-commerce aesthetic
- **No models or mannequins**

### Photoshoot Prompts
- **Model**: Diverse, attractive model wearing garment
- **Focus**: Garment remains the hero of the image
- **Quality**: High-end fashion magazine standard
- **Styling**: Scene matches garment's aesthetic (casual vs formal)
- **Lighting**: Professional fashion photography lighting

## Benefits

1. **Comprehensive Coverage**: 4 different image styles for various use cases
2. **E-commerce Ready**: Clean white background shots for product listings
3. **Marketing Ready**: Styled photoshoot images for promotional materials
4. **Versatile**: Multiple angles and presentations of the same product
5. **Professional Quality**: All images maintain high commercial standards

## Rate Limiting Considerations

- **Total Images**: 4 per product
- **API Calls**: 5 Gemini API calls per product (1 scene generation + 4 images)
- **Processing Time**: ~12-18 seconds per product (with delays)
- **Daily Capacity**: Approximately 100,000 products per day (500k requests ÷ 5)

### API Call Breakdown
1. **Scene Generation**: 1 structured output call (Gemini 2.5 Flash)
2. **Garment Images**: 2 image+text-to-image calls (Gemini 2.5 Flash Image Preview)
3. **Photoshoot Images**: 2 image+text-to-image calls (Gemini 2.5 Flash Image Preview)

## Usage

The updated image generator automatically creates all 4 image types when processing products. No additional configuration required beyond setting `GEMINI_IMAGES_PER_PRODUCT=4` in the environment variables.

```bash
# Run the updated generator
npx ts-node run-image-generator.ts
```

## Output Structure

```
temp_images/
└── product-handle/
    ├── original/
    │   └── original_hash.webp
    ├── generated/
    │   ├── generated_1_garment_long.png
    │   ├── generated_2_garment_close.png
    │   ├── generated_3_photoshoot_1.png
    │   └── generated_4_photoshoot_2.png
    └── metadata.json
```

The metadata.json now includes detailed information about each image type and its intended use case.