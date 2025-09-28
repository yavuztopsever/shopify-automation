#!/usr/bin/env ts-node

/**
 * LMV Shopify Product Automation
 * Processes Turkish CSV through GPT-4 with LMV branding and HTML template parsing
 */

import fs from 'fs';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import OpenAI from 'openai';
import 'dotenv/config';

// Simple interfaces
interface SourceProduct {
  'Ürün Grup ID': string;
  'Varyant ID': string;
  'İsim': string;
  'Açıklama': string;
  'Satış Fiyatı': string;
  'İndirimli Fiyatı': string;
  'SKU': string;
  'Marka': string;
  'Kategoriler': string;
  'Etiketler': string;
  'Resim URL': string;
  'Metadata Başlık': string;
  'Metadata Açıklama': string;
  'Slug': string;
  'Varyant Tip 1': string;
  'Varyant Değer 1': string;
  'Varyant Tip 2': string;
  'Varyant Değer 2': string;
}

interface ShopifyProduct {
  Handle: string;
  Title: string;
  'Body (HTML)': string;
  Vendor: string;
  'Product Category': string;
  Type: string;
  Tags: string;
  Published: boolean;
  'Option1 Name': string;
  'Option1 Value': string;
  'Option2 Name': string;
  'Option2 Value': string;
  'Option3 Name': string;
  'Option3 Value': string;
  'Variant SKU': string;
  'Variant Grams': string;
  'Variant Inventory Tracker': string;
  'Variant Inventory Qty': number;
  'Variant Inventory Policy': string;
  'Variant Fulfillment Service': string;
  'Variant Price': string;
  'Variant Compare At Price': string;
  'Variant Requires Shipping': boolean;
  'Variant Taxable': boolean;
  'Variant Barcode': string;
  'Image Src': string;
  'Image Position': number;
  'Image Alt Text': string;
  'Gift Card': boolean;
  'SEO Title': string;
  'SEO Description': string;
  'Google Shopping / Google Product Category': string;
  'Google Shopping / Gender': string;
  'Google Shopping / Age Group': string;
  'Google Shopping / MPN': string;
  'Google Shopping / Condition': string;
  'Google Shopping / Custom Product': boolean;
  'Variant Image': string;
  'Variant Weight Unit': string;
  'Status': string;
}

// Enhanced content structure for LMV branding - Simplified
interface EnhancedContent {
  title: string; // Max 50 chars
  mainDescription: string; // 2-3 sentences
  materialInfo: string; // Short material description
  sizeInfo: string; // Available sizes
  styleStory: string; // 1-2 sentences
  careInstructions: string; // Simple care text
  metaTitle: string; // SEO title max 55 chars
  metaDescription: string; // SEO description max 155 chars
  tags: string; // Comma-separated tags
  aestheticStyle: string; // Selected aesthetic
}

// LMV Brand Aesthetics
const LMV_AESTHETICS = [
  'Boho Chic', '60s Housewife', '60s LA', 'Woodstock Vibes', 'French New Wave',
  'French Noir', 'Old Money', 'Beatnik Chic', 'Ivy League', 'Utility Workwear',
  'Hollywood Glamour', 'Safari Explorer', 'Minimalist Modern', 'Art Deco',
  'Sporty Luxe', 'Gothic Romance', 'Victorian Inspired', 'Rocker Rebel',
  'Nautical', 'Western Cowboy', 'Flapper 1920s', 'Mod British', 'Cottagecore',
  'Androgynous Tailoring', 'Early Punk', 'Savile Row Bespoke', 'Mediterranean Resort'
];

class LMVAutomation {
  private openai: OpenAI;
  private processedCount = 0;
  private errorCount = 0;
  private productGroups = new Map<string, SourceProduct[]>();
  private htmlTemplate: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Load simplified HTML template
    this.htmlTemplate = fs.readFileSync('lmv-simple-template.html', 'utf8');
  }

  async run(testMode = false) {
    console.log('🚀 Starting LMV Shopify Automation - Avant-garde • Chic • Timeless');
    
    try {
      // Read source products
      const products = await this.readSourceProducts();
      console.log(`📦 Loaded ${products.length} products`);

      // Group by product ID for variants
      this.groupProducts(products);
      console.log(`🔗 Found ${this.productGroups.size} unique products`);

      // Process products (limit to 10 in test mode)
      const toProcess = testMode ? products.slice(0, 10) : products;
      const shopifyProducts = await this.processProducts(toProcess);

      // Write output
      await this.writeShopifyCSV(shopifyProducts);
      
      console.log(`✅ Complete! Processed ${this.processedCount} products, ${this.errorCount} errors`);
      
    } catch (error) {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    }
  }

  private async readSourceProducts(): Promise<SourceProduct[]> {
    return new Promise((resolve, reject) => {
      const products: SourceProduct[] = [];
      
      fs.createReadStream('source_products.csv')
        .pipe(csv())
        .on('data', (data: SourceProduct) => products.push(data))
        .on('end', () => resolve(products))
        .on('error', reject);
    });
  }

  private groupProducts(products: SourceProduct[]) {
    products.forEach(product => {
      const groupId = product['Ürün Grup ID'];
      if (!this.productGroups.has(groupId)) {
        this.productGroups.set(groupId, []);
      }
      this.productGroups.get(groupId)!.push(product);
    });
  }

  private async processProducts(products: SourceProduct[]): Promise<ShopifyProduct[]> {
    const shopifyProducts: ShopifyProduct[] = [];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`⚡ Processing ${i + 1}/${products.length}: ${product['İsim']}`);
      
      try {
        // Enhance content with GPT-5
        const enhanced = await this.enhanceContent(product);
        
        // Convert to Shopify format
        const shopifyProduct = this.mapToShopify(product, enhanced);
        shopifyProducts.push(shopifyProduct);
        
        this.processedCount++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing ${product['İsim']}:`, error);
        this.errorCount++;
        
        // Add with original content as fallback
        const shopifyProduct = this.mapToShopify(product, this.createFallbackContent(product));
        shopifyProducts.push(shopifyProduct);
      }
    }
    
    return shopifyProducts;
  }

  private async enhanceContent(product: SourceProduct): Promise<EnhancedContent> {
    const prompt = this.buildLMVPrompt(product);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen LMV markasının içerik uzmanısın. Avant-garde, chic, cool, wild, alternative, vintage ve timeless bir marka kimliğiyle Türkçe ürün içerikleri oluşturuyorsun. Her ürüne uygun estetik tarzı seçip, marka renklerini (#333333, #355E3B, #E07A5F) ve tipografiyi (Raleway, Lato, Lora) kullanarak etkileyici içerikler yazıyorsun.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from GPT');

    try {
      return JSON.parse(content) as EnhancedContent;
    } catch (error) {
      console.warn('Failed to parse GPT response, using fallback content');
      return this.createFallbackContent(product);
    }
  }

  private createFallbackContent(product: SourceProduct): EnhancedContent {
    const productName = product['İsim'].substring(0, 40) + ' - LMV';
    return {
      title: productName,
      mainDescription: product['Açıklama'].substring(0, 200),
      materialInfo: 'Premium kalite',
      sizeInfo: 'XS, S, M, L, XL',
      styleStory: 'Gardırobunuzun vazgeçilmezi olacak.',
      careInstructions: '30°C yıkama, düşük ısı ütü',
      metaTitle: productName.substring(0, 50),
      metaDescription: `LMV ${product['İsim'].substring(0, 100)}. Hemen keşfet.`,
      tags: 'lmv, moda, giyim, türkiye',
      aestheticStyle: 'Minimalist Modern'
    };
  }

  private buildLMVPrompt(product: SourceProduct): string {
    const randomAesthetic = LMV_AESTHETICS[Math.floor(Math.random() * LMV_AESTHETICS.length)];
    
    // Extract product type from name or categories
    const productType = product['İsim'].split(' ')[0] || 'Ürün';
    
    return `LMV markası için minimalist ve SEO optimizeli içerik oluştur. ÇOK ÖNEMLİ: Başlıklar MİNİMALİST ve KISA olmalı!

ÜRÜN:
${product['İsim']} - ${product['Kategoriler']}

MARKA: LMV (avant-garde, chic, wild, alternative, vintage, timeless)
ESTETİK: ${randomAesthetic}

MİNİMALİST BAŞLIK KURALLARI:
- MAKSİMUM 45 karakter (kesinlikle aşma!)
- Format: [Ürün Tipi] [Ana Özellik] - LMV
- Gereksiz sıfatlar KULLANMA (harika, muhteşem, şık vb.)
- Sadece ürünün NE olduğunu söyle
- Örnekler: "Kaşmir Triko - LMV", "Vintage Elbise - LMV", "Deri Ceket - LMV"

İÇERİK KURALLARI:
- Ana açıklama: 2 cümle MAX
- Malzeme: Tek satır (örn: "%100 Pamuk")
- Beden: Mevcut bedenler (örn: "S, M, L, XL")
- Stil: 1 cümle, ürünü nasıl kullanacağını anlat
- Bakım: Basit tek satır (örn: "30°C yıkama, düşük ısı ütü")

SEO KURALLARI:
- Meta başlık: 50 karakter MAX, anahtar kelime başta
- Meta açıklama: 150 karakter MAX, LMV ve estetik vurgusu
- Etiketler: 5-7 kelime, küçük harf, virgülle ayrık

JSON ÇIKTI:
{
  "title": "MİNİMALİST başlık (MAX 45 karakter!)",
  "mainDescription": "Ürün ne, neden özel. (2 cümle MAX)",
  "materialInfo": "Malzeme kompozisyonu",
  "sizeInfo": "Mevcut bedenler",
  "styleStory": "Nasıl kombinlenir (1 cümle)",
  "careInstructions": "Bakım talimatı (tek satır)",
  "metaTitle": "${productType} - LMV | [anahtar kelime] (50 kar MAX)",
  "metaDescription": "LMV ${productType}. [özellik]. ${randomAesthetic} estetik. Hemen keşfet. (150 kar MAX)",
  "tags": "lmv, ${productType.toLowerCase()}, ${randomAesthetic.toLowerCase()}, türkiye, moda",
  "aestheticStyle": "${randomAesthetic}"
}`;
  }

  private parseContentToHTML(enhanced: EnhancedContent): string {
    let html = this.htmlTemplate;
    
    // Replace all template variables
    html = html.replace(/{{PRODUCT_TITLE}}/g, enhanced.title);
    html = html.replace(/{{AESTHETIC_STYLE}}/g, enhanced.aestheticStyle);
    html = html.replace(/{{MAIN_DESCRIPTION}}/g, enhanced.mainDescription);
    html = html.replace(/{{MATERIAL_INFO}}/g, enhanced.materialInfo);
    html = html.replace(/{{SIZE_INFO}}/g, enhanced.sizeInfo);
    html = html.replace(/{{STYLE_STORY}}/g, enhanced.styleStory);
    html = html.replace(/{{CARE_INSTRUCTIONS}}/g, enhanced.careInstructions);
    
    // Clean up HTML for CSV - remove newlines and consolidate spaces
    html = html.replace(/\n/g, '').replace(/\s+/g, ' ').trim();
    
    return html;
  }

  private mapToShopify(product: SourceProduct, enhanced: EnhancedContent): ShopifyProduct {
    const isFirstVariant = this.isFirstVariantOfGroup(product);
    const handle = this.generateHandle(product['Slug'] || enhanced.title);
    const imageUrls = product['Resim URL'].split(';').filter(url => url.trim());
    const firstImage = imageUrls[0] || '';
    
    // Generate styled HTML body using template
    const bodyHTML = isFirstVariant ? this.parseContentToHTML(enhanced) : '';
    
    return {
      Handle: handle,
      Title: isFirstVariant ? enhanced.title : '',
      'Body (HTML)': bodyHTML,
      Vendor: isFirstVariant ? 'LMV' : '', // Updated to LMV brand
      'Product Category': isFirstVariant ? this.mapCategory(product['Kategoriler']) : '',
      Type: isFirstVariant ? 'Physical' : '',
      Tags: isFirstVariant ? enhanced.tags : '',
      Published: isFirstVariant ? true : false,
      'Option1 Name': product['Varyant Tip 1'] || 'Title',
      'Option1 Value': product['Varyant Değer 1'] || 'Default Title',
      'Option2 Name': product['Varyant Tip 2'] || '',
      'Option2 Value': product['Varyant Değer 2'] || '',
      'Option3 Name': '',
      'Option3 Value': '',
      'Variant SKU': product['SKU'],
      'Variant Grams': '0',
      'Variant Inventory Tracker': '',
      'Variant Inventory Qty': 0,
      'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price': this.formatPrice(product['Satış Fiyatı']),
      'Variant Compare At Price': this.formatPrice(product['İndirimli Fiyatı']),
      'Variant Requires Shipping': true,
      'Variant Taxable': true,
      'Variant Barcode': '',
      'Image Src': isFirstVariant && firstImage ? firstImage : '',
      'Image Position': isFirstVariant && firstImage ? 1 : 0,
      'Image Alt Text': isFirstVariant ? enhanced.title : '',
      'Gift Card': false,
      'SEO Title': isFirstVariant ? enhanced.metaTitle : '',
      'SEO Description': isFirstVariant ? enhanced.metaDescription : '',
      'Google Shopping / Google Product Category': '',
      'Google Shopping / Gender': 'unisex',
      'Google Shopping / Age Group': 'adult',
      'Google Shopping / MPN': product['SKU'],
      'Google Shopping / Condition': 'new',
      'Google Shopping / Custom Product': false,
      'Variant Image': '',
      'Variant Weight Unit': 'kg',
      'Status': 'active'
    };
  }

  private isFirstVariantOfGroup(product: SourceProduct): boolean {
    const group = this.productGroups.get(product['Ürün Grup ID']);
    return group ? group[0]['Varyant ID'] === product['Varyant ID'] : true;
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

  private mapCategory(categories: string): string {
    // Simple category mapping - could be enhanced
    if (categories.includes('Giyim')) return 'Apparel & Accessories > Clothing';
    if (categories.includes('Ayakkabı')) return 'Apparel & Accessories > Shoes';
    return 'Apparel & Accessories';
  }

  private formatPrice(price: string): string {
    if (!price || price === '') return '';
    // Remove currency symbols and convert to number
    const numPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
    return isNaN(numPrice) ? '' : numPrice.toString();
  }

  private async writeShopifyCSV(products: ShopifyProduct[]) {
    const csvWriter = createObjectCsvWriter({
      path: 'output/lmv_shopify_products.csv',
      header: [
        {id: 'Handle', title: 'Handle'},
        {id: 'Title', title: 'Title'},
        {id: 'Body (HTML)', title: 'Body (HTML)'},
        {id: 'Vendor', title: 'Vendor'},
        {id: 'Product Category', title: 'Product Category'},
        {id: 'Type', title: 'Type'},
        {id: 'Tags', title: 'Tags'},
        {id: 'Published', title: 'Published'},
        {id: 'Option1 Name', title: 'Option1 Name'},
        {id: 'Option1 Value', title: 'Option1 Value'},
        {id: 'Option2 Name', title: 'Option2 Name'},
        {id: 'Option2 Value', title: 'Option2 Value'},
        {id: 'Option3 Name', title: 'Option3 Name'},
        {id: 'Option3 Value', title: 'Option3 Value'},
        {id: 'Variant SKU', title: 'Variant SKU'},
        {id: 'Variant Grams', title: 'Variant Grams'},
        {id: 'Variant Inventory Tracker', title: 'Variant Inventory Tracker'},
        {id: 'Variant Inventory Qty', title: 'Variant Inventory Qty'},
        {id: 'Variant Inventory Policy', title: 'Variant Inventory Policy'},
        {id: 'Variant Fulfillment Service', title: 'Variant Fulfillment Service'},
        {id: 'Variant Price', title: 'Variant Price'},
        {id: 'Variant Compare At Price', title: 'Variant Compare At Price'},
        {id: 'Variant Requires Shipping', title: 'Variant Requires Shipping'},
        {id: 'Variant Taxable', title: 'Variant Taxable'},
        {id: 'Variant Barcode', title: 'Variant Barcode'},
        {id: 'Image Src', title: 'Image Src'},
        {id: 'Image Position', title: 'Image Position'},
        {id: 'Image Alt Text', title: 'Image Alt Text'},
        {id: 'Gift Card', title: 'Gift Card'},
        {id: 'SEO Title', title: 'SEO Title'},
        {id: 'SEO Description', title: 'SEO Description'},
        {id: 'Google Shopping / Google Product Category', title: 'Google Shopping / Google Product Category'},
        {id: 'Google Shopping / Gender', title: 'Google Shopping / Gender'},
        {id: 'Google Shopping / Age Group', title: 'Google Shopping / Age Group'},
        {id: 'Google Shopping / MPN', title: 'Google Shopping / MPN'},
        {id: 'Google Shopping / Condition', title: 'Google Shopping / Condition'},
        {id: 'Google Shopping / Custom Product', title: 'Google Shopping / Custom Product'},
        {id: 'Variant Image', title: 'Variant Image'},
        {id: 'Variant Weight Unit', title: 'Variant Weight Unit'},
        {id: 'Status', title: 'Status'}
      ]
    });

    await csvWriter.writeRecords(products);
    console.log(`📄 Generated Shopify CSV with ${products.length} products`);
  }
}

// Run the LMV automation
const automation = new LMVAutomation();
const testMode = process.argv.includes('--test');

automation.run(testMode).catch(error => {
  console.error('💥 LMV Automation failed:', error);
  process.exit(1);
});