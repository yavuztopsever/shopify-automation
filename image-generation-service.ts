#!/usr/bin/env ts-node

/**
 * Image Generation Service
 * Modular service for generating AI images for products
 */

import { ImageGenerator } from './image-generator';
import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedImageUrls {
  garmentFull: string;
  garmentCloseup: string;
  garmentAngular: string;
  photoshoot1: string;
  photoshoot2: string;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrls?: GeneratedImageUrls;
  error?: string;
}

export interface EnhancedProductData {
  sourceProduct: any;
  enhancedContent: any;
}

export class ImageGenerationService {
  private imageGenerator: ImageGenerator;
  private processedGarments = new Set<string>();

  constructor() {
    this.imageGenerator = new ImageGenerator();
  }

  /**
   * Generate images for a single garment if not already processed
   * @param garmentId Unique identifier for the garment (Ürün Grup ID)
   * @param sourceProduct Original source product data
   * @param enhancedContent Enhanced content from GPT-4 processing
   * @returns Promise<ImageGenerationResult>
   */
  async generateImagesForGarment(
    garmentId: string, 
    sourceProduct: any,
    enhancedContent: any
  ): Promise<ImageGenerationResult> {
    try {
      // Check if this garment has already been processed
      if (this.processedGarments.has(garmentId)) {
        console.log(`⏭️ Skipping ${garmentId} - already processed`);
        return {
          success: false,
          error: 'Already processed'
        };
      }

      console.log(`🎨 Generating images for garment: ${garmentId}`);

      // Convert source product to Shopify format for image generator using enhanced content
      const shopifyProduct = this.convertToShopifyFormat(sourceProduct, enhancedContent);

      // Generate images using the existing image generator
      const result = await this.imageGenerator.generateImagesForSingleProduct(shopifyProduct);

      if (result.success && result.imageUrls) {
        // Mark this garment as processed
        this.processedGarments.add(garmentId);
        
        console.log(`✅ Generated images for ${garmentId}`);
        return {
          success: true,
          imageUrls: result.imageUrls
        };
      } else {
        console.error(`❌ Failed to generate images for ${garmentId}:`, result.error);
        return {
          success: false,
          error: result.error || 'Unknown error'
        };
      }

    } catch (error) {
      console.error(`❌ Error generating images for ${garmentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert source product data to Shopify format expected by image generator
   * Uses enhanced content from GPT-4 for better image generation prompts
   */
  private convertToShopifyFormat(sourceProduct: any, enhancedContent: any): any {
    const imageUrls = sourceProduct['Resim URL'].split(';').filter((url: string) => url.trim());
    
    // Create rich HTML description combining enhanced content
    const richDescription = this.createRichDescription(enhancedContent);
    
    return {
      Handle: this.generateHandle(sourceProduct['Slug'] || enhancedContent.title),
      Title: enhancedContent.title, // Use enhanced title
      'Body (HTML)': richDescription, // Use rich enhanced description
      'Image Src': imageUrls[0] || '',
      'Image Position': '1',
      'Image Alt Text': enhancedContent.title,
      'Option1 Value': sourceProduct['Varyant Değer 1'] || 'Default',
      'Option2 Value': sourceProduct['Varyant Değer 2'] || '',
      'Variant Price': sourceProduct['Satış Fiyatı'],
      Tags: enhancedContent.tags, // Use enhanced tags
      // Additional enhanced fields for better image generation
      _enhancedContent: {
        mainDescription: enhancedContent.mainDescription,
        materialInfo: enhancedContent.materialInfo,
        sizeInfo: enhancedContent.sizeInfo,
        styleStory: enhancedContent.styleStory,
        careInstructions: enhancedContent.careInstructions,
        aestheticStyle: enhancedContent.aestheticStyle
      }
    };
  }

  /**
   * Create rich HTML description from enhanced content for better image generation context
   */
  private createRichDescription(enhancedContent: any): string {
    return `
      <div class="product-description">
        <p class="main-description">${enhancedContent.mainDescription}</p>
        <div class="material-info">
          <strong>Material:</strong> ${enhancedContent.materialInfo}
        </div>
        <div class="size-info">
          <strong>Available Sizes:</strong> ${enhancedContent.sizeInfo}
        </div>
        <div class="style-story">
          <strong>Style:</strong> ${enhancedContent.styleStory}
        </div>
        <div class="aesthetic-style">
          <strong>Aesthetic:</strong> ${enhancedContent.aestheticStyle}
        </div>
        <div class="care-instructions">
          <strong>Care:</strong> ${enhancedContent.careInstructions}
        </div>
      </div>
    `.replace(/\s+/g, ' ').trim();
  }

  private generateHandle(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .slice(0, 50);
  }

  /**
   * Get the list of processed garments
   */
  getProcessedGarments(): string[] {
    return Array.from(this.processedGarments);
  }

  /**
   * Reset processed garments list
   */
  resetProcessedGarments(): void {
    this.processedGarments.clear();
  }
}