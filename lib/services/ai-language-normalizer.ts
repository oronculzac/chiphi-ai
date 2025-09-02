import { config } from '@/lib/config';
import { z } from 'zod';
import OpenAI from 'openai';

// Language detection response schema
const LanguageDetectionSchema = z.object({
  language: z.string(),
  confidence: z.number().min(0).max(1),
  languageCode: z.string().length(2)
});

// Translation response schema
const TranslationSchema = z.object({
  translatedText: z.string(),
  originalText: z.string(),
  sourceLanguage: z.string(),
  confidence: z.number().min(0).max(1)
});

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  languageCode: string;
}

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  sourceLanguage: string;
  confidence: number;
}

export class LanguageNormalizer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  /**
   * Detect the language of the given text using OpenAI API
   * Requirements: 2.1 - WHEN a receipt contains non-English text THEN the system SHALL detect the source language
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty for language detection');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are a language detection expert. Analyze the given text and determine its primary language.
            
            Return your response as JSON with this exact structure:
            {
              "language": "English name of the language",
              "confidence": 0.95,
              "languageCode": "two-letter ISO code"
            }
            
            Be very confident in your assessment. If the text appears to be English, return "en" as the language code.
            If mixed languages, choose the dominant one.`
          },
          {
            role: 'user',
            content: `Detect the language of this text:\n\n${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI language detection');
      }

      // Parse and validate the JSON response
      const parsed = JSON.parse(content);
      const result = LanguageDetectionSchema.parse(parsed);

      return {
        language: result.language,
        confidence: result.confidence,
        languageCode: result.languageCode
      };
    } catch (error) {
      console.error('Language detection failed:', error);
      throw new Error(`Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate non-English text to English using OpenAI API
   * Requirements: 2.2 - WHEN non-English content is detected THEN the system SHALL translate it to English before extraction
   * Requirements: 2.3 - WHEN translation is complete THEN the system SHALL preserve both original and translated versions
   */
  async translateToEnglish(text: string, sourceLanguage: string): Promise<TranslationResult> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty for translation');
    }

    // If already English, return as-is
    if (sourceLanguage.toLowerCase() === 'en' || sourceLanguage.toLowerCase() === 'english') {
      return {
        translatedText: text,
        originalText: text,
        sourceLanguage: 'English',
        confidence: 1.0
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator specializing in receipt and financial document translation.
            
            Translate the given text from ${sourceLanguage} to English. Maintain the original structure and formatting as much as possible.
            Pay special attention to:
            - Currency amounts and numbers
            - Merchant names (keep original if it's a proper noun)
            - Dates and times
            - Product names and descriptions
            
            Return your response as JSON with this exact structure:
            {
              "translatedText": "The translated text in English",
              "originalText": "The original text as provided",
              "sourceLanguage": "${sourceLanguage}",
              "confidence": 0.95
            }
            
            Provide a confidence score based on how certain you are about the translation quality.`
          },
          {
            role: 'user',
            content: `Translate this ${sourceLanguage} text to English:\n\n${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI translation');
      }

      // Parse and validate the JSON response
      const parsed = JSON.parse(content);
      const result = TranslationSchema.parse(parsed);

      return {
        translatedText: result.translatedText,
        originalText: result.originalText,
        sourceLanguage: result.sourceLanguage,
        confidence: result.confidence
      };
    } catch (error) {
      console.error('Translation failed:', error);
      // Requirements: 2.5 - IF translation fails THEN the system SHALL proceed with original text and flag the issue
      return {
        translatedText: text,
        originalText: text,
        sourceLanguage: sourceLanguage,
        confidence: 0.0
      };
    }
  }

  /**
   * Normalize text by detecting language and translating if needed
   * This is the main entry point for the language normalization pipeline
   */
  async normalizeText(text: string): Promise<TranslationResult> {
    // First detect the language
    const detection = await this.detectLanguage(text);
    
    // Then translate if needed
    const translation = await this.translateToEnglish(text, detection.language);
    
    return translation;
  }
}

// Export singleton instance
export const languageNormalizer = new LanguageNormalizer();