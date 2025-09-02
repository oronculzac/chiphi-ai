import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LanguageNormalizer } from '../ai-language-normalizer';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    openai: {
      apiKey: 'test-key',
      model: 'gpt-4o-mini'
    }
  }
}));

describe('LanguageNormalizer', () => {
  let normalizer: LanguageNormalizer;
  let mockOpenAI: any;

  beforeEach(() => {
    const MockOpenAI = vi.mocked(require('openai').default);
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    MockOpenAI.mockImplementation(() => mockOpenAI);
    normalizer = new LanguageNormalizer();
    vi.clearAllMocks();
  });

  describe('detectLanguage', () => {
    it('should detect English text correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              language: 'English',
              confidence: 0.98,
              languageCode: 'en'
            })
          }
        }]
      });

      const result = await normalizer.detectLanguage('Thank you for your purchase at Starbucks');

      expect(result).toEqual({
        language: 'English',
        confidence: 0.98,
        languageCode: 'en'
      });
    });

    it('should detect Spanish text correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              language: 'Spanish',
              confidence: 0.95,
              languageCode: 'es'
            })
          }
        }]
      });

      const result = await normalizer.detectLanguage('Gracias por su compra en Starbucks');

      expect(result).toEqual({
        language: 'Spanish',
        confidence: 0.95,
        languageCode: 'es'
      });
    });

    it('should throw error for empty text', async () => {
      await expect(normalizer.detectLanguage('')).rejects.toThrow('Text cannot be empty for language detection');
      await expect(normalizer.detectLanguage('   ')).rejects.toThrow('Text cannot be empty for language detection');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(normalizer.detectLanguage('Some text')).rejects.toThrow('Language detection failed: API Error');
    });

    it('should handle invalid JSON response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON'
          }
        }]
      });

      await expect(normalizer.detectLanguage('Some text')).rejects.toThrow('Language detection failed');
    });
  });

  describe('translateToEnglish', () => {
    it('should return original text for English input', async () => {
      const englishText = 'Thank you for your purchase';
      const result = await normalizer.translateToEnglish(englishText, 'English');

      expect(result).toEqual({
        translatedText: englishText,
        originalText: englishText,
        sourceLanguage: 'English',
        confidence: 1.0
      });

      // Should not call OpenAI for English text
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should return original text for "en" language code', async () => {
      const englishText = 'Thank you for your purchase';
      const result = await normalizer.translateToEnglish(englishText, 'en');

      expect(result).toEqual({
        translatedText: englishText,
        originalText: englishText,
        sourceLanguage: 'English',
        confidence: 1.0
      });

      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should translate Spanish text to English', async () => {
      const spanishText = 'Gracias por su compra';
      const englishText = 'Thank you for your purchase';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              translatedText: englishText,
              originalText: spanishText,
              sourceLanguage: 'Spanish',
              confidence: 0.95
            })
          }
        }]
      });

      const result = await normalizer.translateToEnglish(spanishText, 'Spanish');

      expect(result).toEqual({
        translatedText: englishText,
        originalText: spanishText,
        sourceLanguage: 'Spanish',
        confidence: 0.95
      });
    });

    it('should handle translation failures gracefully', async () => {
      const originalText = 'Some foreign text';
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Translation failed'));

      const result = await normalizer.translateToEnglish(originalText, 'French');

      // Should return original text with confidence 0 on failure
      expect(result).toEqual({
        translatedText: originalText,
        originalText: originalText,
        sourceLanguage: 'French',
        confidence: 0.0
      });
    });

    it('should throw error for empty text', async () => {
      await expect(normalizer.translateToEnglish('', 'Spanish')).rejects.toThrow('Text cannot be empty for translation');
    });
  });

  describe('normalizeText', () => {
    it('should detect and translate non-English text', async () => {
      const originalText = 'Gracias por su compra';
      
      // Mock language detection
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                language: 'Spanish',
                confidence: 0.95,
                languageCode: 'es'
              })
            }
          }]
        })
        // Mock translation
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                translatedText: 'Thank you for your purchase',
                originalText: originalText,
                sourceLanguage: 'Spanish',
                confidence: 0.95
              })
            }
          }]
        });

      const result = await normalizer.normalizeText(originalText);

      expect(result).toEqual({
        translatedText: 'Thank you for your purchase',
        originalText: originalText,
        sourceLanguage: 'Spanish',
        confidence: 0.95
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle English text without translation', async () => {
      const englishText = 'Thank you for your purchase';
      
      // Mock language detection returning English
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              language: 'English',
              confidence: 0.98,
              languageCode: 'en'
            })
          }
        }]
      });

      const result = await normalizer.normalizeText(englishText);

      expect(result).toEqual({
        translatedText: englishText,
        originalText: englishText,
        sourceLanguage: 'English',
        confidence: 1.0
      });

      // Should only call detection, not translation
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });
});