import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config();

interface Product {
  Handle: string;
  Title: string;
  'Body (HTML)': string;
  'Image Src': string;
  'Image Position': string;
  'Image Alt Text': string;
  'Option1 Value': string;
  'Option2 Value': string;
  'Variant Price': string;
  Tags: string;
  [key: string]: string | string[];
}

interface GeneratedImage {
  originalUrl: string;
  generatedImages: string[];
  metadata: any;
}

interface PhotoshootScene {
  aesthetic: string;
  setting: string;
  mood: string;
  lighting: string;
  styling: string;
  model_description: string;
  composition: string;
  props: string[];
}

class ImageGenerator {
  private genAI: GoogleGenerativeAI;
  private tempDir: string;
  private requestCount: number = 0;
  private dailyRequestCount: number = 0;
  private lastResetTime: number = Date.now();
  private cloudinaryFolder: string;


  private readonly RATE_LIMITS = {
    requestsPerMinute: parseInt(process.env.GEMINI_REQUESTS_PER_MINUTE || '400'),
    requestsPerDay: parseInt(process.env.GEMINI_REQUESTS_PER_DAY || '500000'),
    delayBetweenRequests: parseInt(process.env.GEMINI_DELAY_BETWEEN_REQUESTS || '150'),
    imagesPerProduct: parseInt(process.env.GEMINI_IMAGES_PER_PRODUCT || '4')
  };

  constructor() {
    // Initialize Gemini AI
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(geminiApiKey);

    // Initialize Cloudinary
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials not found in environment variables. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    this.cloudinaryFolder = process.env.CLOUDINARY_FOLDER || 'product-images';

    // Create temp directory
    this.tempDir = path.join(__dirname, 'temp_images');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private createProductDirectories(productId: string): { originalDir: string; generatedDir: string } {
    const productDir = path.join(this.tempDir, productId);
    const originalDir = path.join(productDir, 'original');
    const generatedDir = path.join(productDir, 'generated');

    // Create directories if they don't exist
    [productDir, originalDir, generatedDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    return { originalDir, generatedDir };
  }

  private generateUrlHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  }



  private createFallbackPrompt(product: Product, imageType: string): string {
    const title = product.Title;
    const color = product['Option2 Value'] || '';

    if (imageType === 'garment_long') {
      return `Create a professional product photograph of the ${title} in ${color} color floating against a pure white background. Show the complete garment with natural drape and proportions. Studio lighting with soft shadows. E-commerce product photography style.`;
    } else if (imageType === 'garment_close') {
      return `Create a detailed close-up photograph of the ${title} in ${color} color against a pure white background. Focus on fabric texture, stitching, and material quality. Professional product photography with sharp focus.`;
    } else {
      return `Create a fashion photograph of a model wearing the ${title} in ${color} color. Professional fashion photography with natural lighting and commercial appeal. The garment should be the main focus.`;
    }
  }

  private enhancePromptWithTechnicalSpecs(basePrompt: string): string {
    return `${basePrompt}

Professional photography quality with natural lighting, accurate colors, and realistic proportions.`;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinute = 60 * 1000;
    const oneDay = 24 * 60 * 60 * 1000;

    // Reset counters if needed
    if (now - this.lastResetTime > oneDay) {
      this.dailyRequestCount = 0;
      this.requestCount = 0;
      this.lastResetTime = now;
    } else if (now - this.lastResetTime > oneMinute) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check daily limit
    if (this.dailyRequestCount >= this.RATE_LIMITS.requestsPerDay) {
      throw new Error(`Daily rate limit exceeded (${this.RATE_LIMITS.requestsPerDay} requests/day)`);
    }

    // Check per-minute limit
    if (this.requestCount >= this.RATE_LIMITS.requestsPerMinute) {
      const waitTime = oneMinute - (now - this.lastResetTime);
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }
  }

  private async executeWithRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    await this.checkRateLimit();
    
    this.requestCount++;
    this.dailyRequestCount++;
    
    try {
      const result = await operation();
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMITS.delayBetweenRequests));
      
      return result;
    } catch (error) {
      // Don't count failed requests against rate limit
      this.requestCount--;
      this.dailyRequestCount--;
      throw error;
    }
  }

  private async downloadImage(url: string, targetDir: string, filename: string): Promise<string> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const filePath = path.join(targetDir, filename);
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(filePath));
          writer.on('error', reject);
        });
      } catch (error: any) {
        retryCount++;
        const isNetworkError = error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET';
        
        if (retryCount < maxRetries && isNetworkError) {
          const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
          console.log(`⏳ Network error, retrying in ${waitTime}ms... (${error.code})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        console.error(`❌ Failed to download ${url}:`, error);
        throw error;
      }
    }
    
    throw new Error(`Failed to download after ${maxRetries} attempts`);
  }

  private createGarmentOnlyPrompt(product: Product, isCloseShot: boolean): string {
    const title = product.Title;
    const color = product['Option2 Value'] || '';

    if (isCloseShot) {
      return `Create a close-up product photograph of the ${title} in ${color} color floating against a pure white background. Show detailed fabric texture and construction details. Using the provided reference image, replicate the exact color and design details.`;
    } else {
      return `Create a full-view product photograph of the ${title} in ${color} color floating against a pure white background. Show the complete garment from top to bottom. Using the provided reference image, replicate the exact color and silhouette.`;
    }
  }

  private async generatePhotoshootScenes(product: Product, imageData: Buffer): Promise<PhotoshootScene[]> {
    const title = product.Title;
    const color = product['Option2 Value'] || '';
    const tags = product.Tags;
    const description = product['Body (HTML)'].replace(/<[^>]*>/g, ''); // Strip HTML

    // Expanded list of vintage and timeless aesthetics
    const aestheticStyles = [
      // Original aesthetics
      'Boho', '60s housewife', '60s LA', 'Woodstock', 'French new wave', 'French noir', 'Old money',
      'Beatnik Chic', 'Ivy League/Preppy', 'Utility/Workwear', 'Hollywood Glamour (Golden Age)',
      'Safari/Explorer', 'Minimalist Modern', 'Art Deco Elegance', 'Sporty Luxe', 'Gothic Romance',
      'Victorian/Edwardian Inspired', 'Rocker/Rebel', 'Nautical', 'Western/Cowboy', 'Flapper (1920s)',
      'Mod (Mid-60s British)', 'Cottagecore', 'Androgynous Tailoring', 'Punk (Early)', 
      'Savile Row Bespoke', 'Mediterranean Resort',
      // 10 additional vintage/timeless aesthetics
      'Italian Riviera (1950s)', 'Parisian Atelier', 'English Country Estate', 'New York Socialite (1940s)',
      'Scandinavian Hygge', 'Japanese Minimalism', 'Russian Ballet', 'Moroccan Bohemian',
      'Swiss Alpine Chic', 'Cuban Havana (1950s)'
    ];

    // Randomly select ONE aesthetic for this product
    const selectedAesthetic = aestheticStyles[Math.floor(Math.random() * aestheticStyles.length)];
    
    console.log(`🎨 Selected aesthetic: ${selectedAesthetic} for ${title}`);

    const prompt = `Using the provided garment image as reference, create a single fashion photoshoot concept for the ${title} in ${color} color using the ${selectedAesthetic} aesthetic.

Garment Details:
- Product: ${title}
- Color: ${color}
- Style characteristics: ${tags}
- Description: ${description}

AESTHETIC REQUIREMENT: You must create a scene using the ${selectedAesthetic} aesthetic style.

Analyze the provided garment image and create a detailed photoshoot concept that includes:

1. Why the ${selectedAesthetic} aesthetic perfectly suits this specific garment
2. A specific, authentic location that embodies ${selectedAesthetic} style
3. The exact mood and atmosphere that captures ${selectedAesthetic} essence
4. Professional lighting setup appropriate for ${selectedAesthetic} aesthetic
5. Complete model styling (hair, makeup, accessories) authentic to ${selectedAesthetic}
6. Model pose and expression that embodies ${selectedAesthetic} attitude
7. Camera composition and framing that enhances ${selectedAesthetic} visual language
8. 3-5 specific props that are authentic to ${selectedAesthetic} period/style

The scene must be aspirational, magazine-quality, and make the garment the hero while authentically representing the ${selectedAesthetic} aesthetic. Focus on historical accuracy and lifestyle authenticity for the chosen aesthetic.`;

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              aesthetic: { 
                type: SchemaType.STRING,
                description: "The chosen aesthetic style"
              },
              setting: { 
                type: SchemaType.STRING,
                description: "Detailed description of the location/environment"
              },
              mood: { 
                type: SchemaType.STRING,
                description: "The overall atmosphere and emotional tone"
              },
              lighting: { 
                type: SchemaType.STRING,
                description: "Specific lighting style and quality"
              },
              styling: { 
                type: SchemaType.STRING,
                description: "Accessories, hair, makeup, and styling choices"
              },
              model_description: { 
                type: SchemaType.STRING,
                description: "Description of the model including pose and expression"
              },
              composition: { 
                type: SchemaType.STRING,
                description: "Camera angle, framing, and visual composition"
              },
              props: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "List of relevant props and set pieces"
              }
            },
            required: ["aesthetic", "setting", "mood", "lighting", "styling", "model_description", "composition", "props"]
          }
        }
      });

      console.log(`🎬 Generating photoshoot scenes for ${product.Title}...`);

      const result = await this.executeWithRateLimit(async () => {
        return await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageData.toString('base64'),
              mimeType: 'image/webp'
            }
          }
        ]);
      });

      const response = result.response;
      const jsonResponse = JSON.parse(response.text());
      
      console.log(`✅ Generated photoshoot scene with ${jsonResponse.aesthetic} aesthetic for ${product.Title}`);
      return [jsonResponse]; // Return as array to maintain compatibility

    } catch (error) {
      console.error(`❌ Error generating photoshoot scenes for ${product.Title}:`, error);
      // Return fallback scene (single scene)
      const fallbackAesthetics = ['Minimalist Modern', 'Old money', 'French new wave'];
      const randomFallback = fallbackAesthetics[Math.floor(Math.random() * fallbackAesthetics.length)];
      
      return [
        {
          aesthetic: randomFallback,
          setting: 'Clean, elegant studio with neutral backdrop',
          mood: 'Professional and sophisticated',
          lighting: 'Soft natural lighting',
          styling: 'Clean, minimal accessories',
          model_description: 'Confident model with natural pose',
          composition: 'Center-focused with negative space',
          props: ['minimal furniture', 'clean lines', 'elegant decor']
        }
      ];
    }
  }

  private createPhotoshootPrompt(product: Product, scene: PhotoshootScene): string {
    const title = product.Title;
    const color = product['Option2 Value'] || '';

    return `A photorealistic fashion photograph of a professional model wearing the ${title} in ${color} color, set in ${scene.setting}. The scene is illuminated by ${scene.lighting}, creating a ${scene.mood} atmosphere. Captured with an 85mm portrait lens, emphasizing the garment's fit, drape, and fabric texture. The styling includes ${scene.styling}. The model ${scene.model_description}. The composition follows ${scene.composition} with props including ${scene.props.join(', ')}.

The aesthetic is ${scene.aesthetic} with authentic period styling and environmental details. Professional fashion photography quality with natural lighting, realistic fabric behavior, and commercial appeal. The garment should be the clear hero of the image while maintaining the aspirational lifestyle context.

Using the provided reference image, ensure the garment maintains its exact color, fit, and design details as shown in the original. The model should wear the garment naturally without distorting its original silhouette or proportions.`;
  }

  private async generateImages(product: Product, originalImagePath: string, generatedDir: string): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });
      
      // Read the original image
      const imageData = fs.readFileSync(originalImagePath);
      
      const generatedImages: string[] = [];
      
      // First, generate photoshoot scenes using structured output
      console.log(`🎬 Generating photoshoot scene concepts for ${product.Title}...`);
      const photoshootScenes = await this.generatePhotoshootScenes(product, imageData);
      
      // Save scene concepts to metadata
      const scenesPath = path.join(generatedDir, 'photoshoot_scenes.json');
      fs.writeFileSync(scenesPath, JSON.stringify(photoshootScenes, null, 2));
      
      // Define the 4 image types we want to generate - ALL use original image as input
      const selectedScene = photoshootScenes[0]; // Use the single generated scene
      const imageTypes = [
        { type: 'garment_long', name: 'Garment Full View', useOriginal: true, scene: null },
        { type: 'garment_close', name: 'Garment Close-up', useOriginal: true, scene: null },
        { type: 'photoshoot_1', name: `Styled Photoshoot (${selectedScene?.aesthetic || 'Scene 1'})`, useOriginal: true, scene: selectedScene },
        { type: 'photoshoot_2', name: `Styled Photoshoot Variation (${selectedScene?.aesthetic || 'Scene 2'})`, useOriginal: true, scene: selectedScene }
      ];
      
      // Generate 4 specific images with rate limiting
      for (let i = 0; i < imageTypes.length; i++) {
        try {
          const imageType = imageTypes[i];
          let prompt: string;
          let contentArray: any[];

          if (imageType.type === 'garment_long') {
            const basePrompt = this.createGarmentOnlyPrompt(product, false);
            prompt = this.enhancePromptWithTechnicalSpecs(basePrompt);
            contentArray = [
              prompt,
              {
                inlineData: {
                  data: imageData.toString('base64'),
                  mimeType: 'image/webp'
                }
              }
            ];
          } else if (imageType.type === 'garment_close') {
            const basePrompt = this.createGarmentOnlyPrompt(product, true);
            prompt = this.enhancePromptWithTechnicalSpecs(basePrompt);
            contentArray = [
              prompt,
              {
                inlineData: {
                  data: imageData.toString('base64'),
                  mimeType: 'image/webp'
                }
              }
            ];
          } else if (imageType.scene) {
            // Photoshoot images - use generated scene concept with original image as reference
            const basePrompt = this.createPhotoshootPrompt(product, imageType.scene);
            prompt = this.enhancePromptWithTechnicalSpecs(basePrompt);
            contentArray = [
              prompt,
              {
                inlineData: {
                  data: imageData.toString('base64'),
                  mimeType: 'image/webp'
                }
              }
            ];
          } else {
            // Fallback for photoshoot without scene
            console.warn(`⚠️ No scene generated for ${imageType.name}, using fallback`);
            continue;
          }

          console.log(`📸 Generating ${imageType.name} for ${product.Title}...`);

          // Retry logic for failed API calls
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;
          let currentPrompt = prompt;
          let currentContentArray = contentArray;

          while (retryCount < maxRetries && !success) {
            try {
              // Use rate-limited execution
              const result = await this.executeWithRateLimit(async () => {
                return await model.generateContent(currentContentArray);
              });

              // Save generated image to the generated directory
              const response = result.response;
              if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                  if (part.inlineData) {
                    const filename = `generated_${i + 1}_${imageType.type}.png`;
                    const filePath = path.join(generatedDir, filename);
                    
                    fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
                    generatedImages.push(filePath);
                    
                    console.log(`✅ Generated ${imageType.name} for ${product.Title} saved to ${filePath}`);
                    success = true;
                    break;
                  }
                }
              }

              if (!success) {
                console.warn(`⚠️ No image data received for ${imageType.name}, retrying...`);
                retryCount++;
              }

            } catch (error) {
              retryCount++;
              console.error(`❌ Attempt ${retryCount}/${maxRetries} failed for ${imageType.name}:`, error instanceof Error ? error.message : error);
              
              if (retryCount < maxRetries) {
                // Try with fallback prompt on second retry
                if (retryCount === 2) {
                  console.log(`🔄 Trying with simplified prompt for ${imageType.name}...`);
                  const fallbackPrompt = this.createFallbackPrompt(product, imageType.type);
                  currentContentArray = [
                    fallbackPrompt,
                    {
                      inlineData: {
                        data: imageData.toString('base64'),
                        mimeType: 'image/webp'
                      }
                    }
                  ];
                }
                
                const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }

          if (!success) {
            console.error(`❌ Failed to generate ${imageType.name} after ${maxRetries} attempts with both enhanced and fallback prompts`);
          }

        } catch (error) {
          console.error(`❌ Error generating ${imageTypes[i].name} for ${product.Title}:`, error);
          
          // Check if it's a rate limit error and handle accordingly
          if (error instanceof Error && (error.message?.includes('rate limit') || error.message?.includes('quota'))) {
            console.log('⏳ Rate limit hit, waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
            i--; // Retry this iteration
            continue;
          }
        }
      }
      
      return generatedImages;
    } catch (error) {
      console.error(`❌ Error in generateImages for ${product.Title}:`, error);
      return [];
    }
  }

  private async uploadToCloudinary(imagePath: string, title: string, productHandle?: string): Promise<string | null> {
    try {
      if (!fs.existsSync(imagePath)) return null;

      const sanitizedTitle = title.replace(/[^a-zA-Z0-9\-_]/g, '_').toLowerCase();
      const timestamp = Date.now();
      const publicId = productHandle 
        ? `${productHandle}/${sanitizedTitle}_${timestamp}`
        : `${sanitizedTitle}_${timestamp}`;

      const uploadResult = await cloudinary.uploader.upload(imagePath, {
        public_id: publicId,
        folder: this.cloudinaryFolder,
        resource_type: 'image',
        quality: 'auto:good',
        tags: ['product-image', 'generated', productHandle].filter(Boolean),
        context: {
          title: title,
          product_handle: productHandle || '',
          generated_at: new Date().toISOString()
        }
      });

      return uploadResult?.secure_url || null;
    } catch (error: any) {
      console.error(`❌ Cloudinary upload failed:`, error.message);
      return null;
    }
  }



  private async saveMetadata(product: Product, generatedImages: GeneratedImage, productDir: string): Promise<void> {
    const metadataPath = path.join(productDir, 'metadata.json');
    const metadata = {
      product: {
        handle: product.Handle,
        title: product.Title,
        originalImageUrl: product['Image Src']
      },
      generatedImages: generatedImages,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }



  async listProducts(csvPath: string = '/home/yavuz/Projects/shopify_automation/output/lmv_shopify_products.csv', limit: number = 10): Promise<void> {
    const products: Product[] = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row: Product) => {
          if (row['Image Src'] && row.Title && row['Image Src'].trim() !== '') {
            products.push(row);
          }
        })
        .on('end', () => {
          const uniqueProducts = products.filter((product, index, self) => 
            index === self.findIndex(p => p.Handle === product.Handle)
          );
          
          console.log(`📦 Found ${uniqueProducts.length} unique products with images\n`);
          console.log('First', Math.min(limit, uniqueProducts.length), 'products:');
          console.log('─'.repeat(80));
          
          uniqueProducts.slice(0, limit).forEach((product, index) => {
            console.log(`${index + 1}. Handle: ${product.Handle}`);
            console.log(`   Title: ${product.Title}`);
            console.log(`   Color: ${product['Option2 Value'] || 'N/A'}`);
            console.log(`   Tags: ${product.Tags}`);
            console.log(`   Image: ${product['Image Src'].substring(0, 60)}...`);
            console.log('');
          });
          
          if (uniqueProducts.length > limit) {
            console.log(`... and ${uniqueProducts.length - limit} more products`);
          }
          
          resolve();
        })
        .on('error', reject);
    });
  }

  async processProducts(options: {
    limit?: number;
    startIndex?: number;
    csvPath?: string;
    testMode?: boolean;
    specificHandle?: string;
  } = {}): Promise<void> {
    const {
      limit,
      startIndex = 0,
      csvPath = '/home/yavuz/Projects/shopify_automation/output/lmv_shopify_products.csv',
      testMode = false,
      specificHandle
    } = options;

    const products: Product[] = [];
    
    // Read CSV
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row: Product) => {
          // Only process rows with images and titles
          if (row['Image Src'] && row.Title && row['Image Src'].trim() !== '') {
            products.push(row);
          }
        })
        .on('end', async () => {
          console.log(`Found ${products.length} products with images`);
          
          // Process unique products (avoid duplicates from size variants)
          let uniqueProducts = products.filter((product, index, self) => 
            index === self.findIndex(p => p.Handle === product.Handle)
          );
          
          // Filter by specific handle if provided
          if (specificHandle) {
            uniqueProducts = uniqueProducts.filter(p => p.Handle === specificHandle);
            if (uniqueProducts.length === 0) {
              console.log(`❌ No product found with handle: ${specificHandle}`);
              console.log(`Available handles: ${products.slice(0, 10).map(p => p.Handle).join(', ')}...`);
              resolve();
              return;
            }
          }
          
          // Apply start index and limit
          const startIdx = Math.max(0, startIndex);
          const endIdx = limit ? Math.min(startIdx + limit, uniqueProducts.length) : uniqueProducts.length;
          const productsToProcess = uniqueProducts.slice(startIdx, endIdx);
          
          console.log(`Processing ${productsToProcess.length} unique products (${startIdx + 1}-${endIdx} of ${uniqueProducts.length})`);
          console.log(`📊 Rate Limits: ${this.RATE_LIMITS.requestsPerMinute}/min, ${this.RATE_LIMITS.requestsPerDay}/day, ${this.RATE_LIMITS.delayBetweenRequests}ms delay, ${this.RATE_LIMITS.imagesPerProduct} images per product`);
          
          if (testMode) {
            console.log(`🧪 TEST MODE: Processing ${productsToProcess.length} products`);
          }
          
          const processedProducts: Product[] = [];
          
          for (const product of productsToProcess) {
            try {
              console.log(`Processing: ${product.Title}`);
              
              // Create organized directory structure using product handle
              const { originalDir, generatedDir } = this.createProductDirectories(product.Handle);
              
              // Process the main image URL
              const imageUrl = product['Image Src'].trim();
              const urlHash = this.generateUrlHash(imageUrl);
              
              try {
                // Download original image to organized directory
                const originalImagePath = await this.downloadImage(
                  imageUrl,
                  originalDir,
                  `original_${urlHash}.webp`
                );
                
                // Generate new images in the generated directory
                const generatedImagePaths = await this.generateImages(product, originalImagePath, generatedDir);
                
                if (generatedImagePaths.length > 0) {
                  // Upload to Cloudinary with descriptive titles
                  const uploadedUrls: string[] = [];
                  const imageTypeNames = [
                    'Full View - White Background',
                    'Close-up Details - White Background', 
                    'Styled Photoshoot Scene 1',
                    'Styled Photoshoot Scene 2'
                  ];
                  
                  console.log(`📤 Uploading ${generatedImagePaths.length} images to Cloudinary...`);
                  
                  for (let i = 0; i < generatedImagePaths.length; i++) {
                    const imageTypeName = imageTypeNames[i] || `Generated ${i + 1}`;
                    console.log(`📤 Processing image ${i + 1}/${generatedImagePaths.length}: ${imageTypeName}`);
                    
                    // Upload to Cloudinary
                    const uploadedUrl = await this.uploadToCloudinary(
                      generatedImagePaths[i], 
                      `${product.Title} - ${imageTypeName}`,
                      product.Handle
                    );
                    
                    if (uploadedUrl && !uploadedUrl.includes('file://')) {
                      uploadedUrls.push(uploadedUrl);
                      console.log(`✅ Upload ${i + 1} successful: ${uploadedUrl}`);
                    } else {
                      // Use local file path as fallback
                      const localPath = `file://${generatedImagePaths[i]}`;
                      uploadedUrls.push(localPath);
                      console.log(`📁 Using local path for image ${i + 1}: ${path.basename(generatedImagePaths[i])}`);
                    }
                  }
                  
                  const successfulUploads = uploadedUrls.filter(url => !url.includes('file://')).length;
                  console.log(`📊 Upload summary: ${successfulUploads}/${generatedImagePaths.length} uploaded to Cloudinary, ${generatedImagePaths.length - successfulUploads} stored locally`);
                  
                  if (uploadedUrls.length > 0) {
                    // Read the generated scenes for metadata
                    let photoshootScenes: PhotoshootScene[] = [];
                    const scenesPath = path.join(generatedDir, 'photoshoot_scenes.json');
                    if (fs.existsSync(scenesPath)) {
                      photoshootScenes = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
                    }

                    // Save metadata
                    const generatedImages: GeneratedImage = {
                      originalUrl: product['Image Src'],
                      generatedImages: uploadedUrls,
                      metadata: {
                        title: product.Title,
                        handle: product.Handle,
                        generatedCount: uploadedUrls.length,
                        photoshootScenes: photoshootScenes,
                        imageTypes: [
                          { 
                            type: 'garment_full_view', 
                            url: uploadedUrls[0] || null, 
                            description: 'Full garment view on white background' 
                          },
                          { 
                            type: 'garment_closeup', 
                            url: uploadedUrls[1] || null, 
                            description: 'Close-up details on white background' 
                          },
                          { 
                            type: 'styled_photoshoot_1', 
                            url: uploadedUrls[2] || null, 
                            description: `Professional styled photoshoot - ${photoshootScenes[0]?.aesthetic || 'Scene 1'}`,
                            scene: photoshootScenes[0] || null
                          },
                          { 
                            type: 'styled_photoshoot_2', 
                            url: uploadedUrls[3] || null, 
                            description: `Professional styled photoshoot variation - ${photoshootScenes[0]?.aesthetic || 'Scene 2'}`,
                            scene: photoshootScenes[0] || null
                          }
                        ]
                      }
                    };
                    
                    await this.saveMetadata(product, generatedImages, path.join(this.tempDir, product.Handle));
                    
                    // Store all generated URLs for CSV update
                    product['_generatedImages'] = uploadedUrls;
                    
                    console.log(`✅ Processed ${product.Title} - Generated ${uploadedUrls.length} images`);
                  }
                }
              } catch (error) {
                console.error(`❌ Error processing image URL ${imageUrl}:`, error);
                console.log(`⏭️  Skipping ${product.Title} - cannot process without original image`);
                continue; // Skip this product entirely
              }
              
              processedProducts.push(product);
              
            } catch (error) {
              console.error(`❌ Error processing ${product.Title}:`, error);
              processedProducts.push(product); // Keep original
            }
          }
          
          // Update CSV with new image URLs
          await this.updateCsv(products, processedProducts);
          
          console.log('✅ Processing complete!');
          resolve();
        })
        .on('error', reject);
    });
  }

  private async updateCsv(allProducts: Product[], processedProducts: Product[]): Promise<void> {
    // Create a map of processed products with generated images
    const processedMap = new Map(processedProducts.map(p => [p.Handle, p]));
    
    const updatedProducts: Product[] = [];
    
    for (const product of allProducts) {
      const processed = processedMap.get(product.Handle);
      
      if (processed && processed['_generatedImages']) {
        const generatedImages = Array.isArray(processed['_generatedImages']) 
          ? processed['_generatedImages'] as string[]
          : [];
        
        // Find the highest existing image position for this product
        const existingImagePositions = allProducts
          .filter(p => p.Handle === product.Handle && p['Image Position'])
          .map(p => parseInt(p['Image Position'].toString()) || 0);
        
        const maxPosition = existingImagePositions.length > 0 ? Math.max(...existingImagePositions) : 0;
        
        // Add the original product (unchanged)
        updatedProducts.push(product);
        
        // Add new image rows for ALL generated images (don't skip any)
        for (let i = 0; i < generatedImages.length; i++) {
          const imageUrl = generatedImages[i];
          const imagePosition = maxPosition + i + 1;
          
          // Create image-only row (all other fields empty except Handle and image fields)
          const imageRow: Product = {
            ...Object.keys(product).reduce((acc, key) => {
              acc[key] = '';
              return acc;
            }, {} as Product),
            Handle: product.Handle,
            'Image Src': imageUrl,
            'Image Position': imagePosition.toString(),
            'Image Alt Text': `${product.Title} - Generated Image ${i + 1}`
          };
          
          updatedProducts.push(imageRow);
        }

      } else {
        // No generated images, keep original
        updatedProducts.push(product);
      }
    }
    
    // Write updated CSV
    const outputPath = path.join(__dirname, 'output', 'updated_lmv_shopify_products.csv');
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Clean up the _generatedImages field before writing
    const cleanedProducts = updatedProducts.map(product => {
      const { _generatedImages, ...cleanProduct } = product as any;
      return cleanProduct;
    });
    
    // Get original headers (without _generatedImages)
    const originalHeaders = Object.keys(allProducts[0]).filter(key => key !== '_generatedImages');
    
    // Also ensure cleanedProducts don't have the _generatedImages field in their keys
    const finalProducts = cleanedProducts.map(product => {
      const cleanedProduct: any = {};
      originalHeaders.forEach(header => {
        cleanedProduct[header] = product[header] || '';
      });
      return cleanedProduct;
    });
    
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: originalHeaders.map(key => ({ id: key, title: key }))
    });
    
    await csvWriter.writeRecords(finalProducts);
    console.log(`✅ Updated CSV saved to: ${outputPath} with ${finalProducts.length} rows`);
    
    // Log summary of changes
    const processedHandles = Array.from(processedMap.keys());
    const addedImageRows = finalProducts.filter(p => 
      processedHandles.includes(p.Handle) && p['Image Src'] && !p.Title
    ).length;
    
    console.log(`📊 Summary: Added ${addedImageRows} new image rows for ${processedHandles.length} processed products`);
  }
}

// Command line argument parsing
function parseArguments(): {
  limit?: number;
  startIndex?: number;
  csvPath?: string;
  testMode?: boolean;
  specificHandle?: string;
  help?: boolean;
  list?: boolean;
  listLimit?: number;
} {
  const args = process.argv.slice(2);
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--limit':
      case '-l':
        options.limit = parseInt(args[++i]);
        break;
      case '--start':
      case '-s':
        options.startIndex = parseInt(args[++i]);
        break;
      case '--csv':
      case '-c':
        options.csvPath = args[++i];
        break;
      case '--test':
      case '-t':
        options.testMode = true;
        break;
      case '--handle':
      case '-h':
        options.specificHandle = args[++i];
        break;
      case '--list':
        options.list = true;
        // Check if next arg is a number for list limit
        if (args[i + 1] && args[i + 1].match(/^\d+$/)) {
          options.listLimit = parseInt(args[++i]);
        }
        break;
      case '--help':
        options.help = true;
        break;
      default:
        // Handle shorthand number arguments
        if (arg.match(/^\d+$/)) {
          options.limit = parseInt(arg);
        }
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
🎨 Image Generator - Command Line Usage

BASIC USAGE:
  ts-node image-generator.ts                    # Process all products
  ts-node image-generator.ts 5                  # Process first 5 products
  ts-node image-generator.ts --limit 10         # Process first 10 products

LISTING PRODUCTS:
  ts-node image-generator.ts --list             # List first 10 products
  ts-node image-generator.ts --list 20          # List first 20 products

ADVANCED OPTIONS:
  --limit, -l <number>               # Limit number of products to process
  --start, -s <number>               # Start from specific index (0-based)
  --csv, -c <path>                   # Use custom CSV file path
  --test, -t                         # Enable test mode with extra logging
  --handle, -h <handle>              # Process specific product by handle
  --list [number]                    # List available products (default: 10)
  --help                             # Show this help message

EXAMPLES:
  ts-node image-generator.ts 3                 # Process first 3 products
  ts-node image-generator.ts --limit 5 --start 10    # Process products 11-15
  ts-node image-generator.ts --test --limit 2        # Test mode with 2 products
  ts-node image-generator.ts --handle "kasmir-karisimli-triko-esofman-takimi"  # Process specific product
  ts-node image-generator.ts --csv "./custom.csv" --limit 5  # Custom CSV file
  ts-node image-generator.ts --list 15               # List first 15 products

QUICK TESTING:
  ts-node image-generator.ts --list             # See available products
  ts-node image-generator.ts --test 1           # Test with 1 product
  ts-node image-generator.ts --test --handle "product-handle"  # Test specific product

RATE LIMITS:
  - Default: 400 requests/minute, 500k requests/day
  - Each product uses 5 API calls (1 scene + 4 images)
  - Approximately 80 products per minute maximum

OUTPUT:
  - Images saved to: ./temp_images/[product-handle]/
  - Original images: ./temp_images/[product-handle]/original/
  - Generated images: ./temp_images/[product-handle]/generated/
  - Updated CSV: ./output/updated_lmv_shopify_products.csv
`);
}

// Main execution
async function main() {
  try {
    const options = parseArguments();
    
    if (options.help) {
      showHelp();
      return;
    }
    
    const generator = new ImageGenerator();
    
    // Handle list command
    if (options.list) {
      await generator.listProducts(options.csvPath, options.listLimit || 10);
      return;
    }
    
    // Validate arguments
    if (options.limit !== undefined && (options.limit < 1 || options.limit > 1000)) {
      console.error('❌ Limit must be between 1 and 1000');
      process.exit(1);
    }
    
    if (options.startIndex !== undefined && options.startIndex < 0) {
      console.error('❌ Start index must be 0 or greater');
      process.exit(1);
    }
    
    if (options.csvPath && !fs.existsSync(options.csvPath)) {
      console.error(`❌ CSV file not found: ${options.csvPath}`);
      process.exit(1);
    }
    
    // Show execution plan
    console.log('🚀 Image Generator Starting...');
    if (options.limit) console.log(`📊 Limit: ${options.limit} products`);
    if (options.startIndex) console.log(`📍 Starting from index: ${options.startIndex}`);
    if (options.csvPath) console.log(`📄 CSV file: ${options.csvPath}`);
    if (options.testMode) console.log(`🧪 Test mode: ENABLED`);
    if (options.specificHandle) console.log(`🎯 Specific handle: ${options.specificHandle}`);
    console.log('');
    
    await generator.processProducts(options);
    
    console.log('\n✅ Image generation completed successfully!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ImageGenerator };