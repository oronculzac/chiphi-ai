import { describe, it, expect } from 'vitest';

describe('AI Services Integration', () => {
  it('should have the correct service structure', () => {
    // Test that the services can be imported without errors
    expect(() => {
      require('../ai-language-normalizer');
      require('../ai-data-extractor');
      require('../ai-processing-pipeline');
    }).not.toThrow();
  });

  it('should export the expected classes and interfaces', () => {
    const { LanguageNormalizer, languageNormalizer } = require('../ai-language-normalizer');
    const { DataExtractor, dataExtractor } = require('../ai-data-extractor');
    const { AIProcessingPipeline, aiProcessingPipeline } = require('../ai-processing-pipeline');

    expect(LanguageNormalizer).toBeDefined();
    expect(languageNormalizer).toBeDefined();
    expect(DataExtractor).toBeDefined();
    expect(dataExtractor).toBeDefined();
    expect(AIProcessingPipeline).toBeDefined();
    expect(aiProcessingPipeline).toBeDefined();
  });

  it('should have the correct method signatures', () => {
    const { LanguageNormalizer } = require('../ai-language-normalizer');
    const { DataExtractor } = require('../ai-data-extractor');
    const { AIProcessingPipeline } = require('../ai-processing-pipeline');

    const normalizer = new LanguageNormalizer();
    const extractor = new DataExtractor();
    const pipeline = new AIProcessingPipeline();

    // Check that methods exist
    expect(typeof normalizer.detectLanguage).toBe('function');
    expect(typeof normalizer.translateToEnglish).toBe('function');
    expect(typeof normalizer.normalizeText).toBe('function');

    expect(typeof extractor.extractReceiptData).toBe('function');
    expect(typeof extractor.extractReceiptDataWithRetry).toBe('function');

    expect(typeof pipeline.processReceiptText).toBe('function');
    expect(typeof pipeline.processReceiptTextRobust).toBe('function');
    expect(typeof pipeline.validateProcessingResult).toBe('function');
    expect(typeof pipeline.getProcessingStats).toBe('function');
  });

  it('should validate input parameters correctly', async () => {
    const { LanguageNormalizer } = require('../ai-language-normalizer');
    const { DataExtractor } = require('../ai-data-extractor');
    const { AIProcessingPipeline } = require('../ai-processing-pipeline');

    const normalizer = new LanguageNormalizer();
    const extractor = new DataExtractor();
    const pipeline = new AIProcessingPipeline();

    // Test empty string validation
    await expect(normalizer.detectLanguage('')).rejects.toThrow('Text cannot be empty for language detection');
    await expect(normalizer.translateToEnglish('', 'Spanish')).rejects.toThrow('Text cannot be empty for translation');
    await expect(extractor.extractReceiptData('')).rejects.toThrow('Text cannot be empty for data extraction');
    await expect(pipeline.processReceiptText('')).rejects.toThrow('Receipt text cannot be empty');

    // Test whitespace-only strings
    await expect(normalizer.detectLanguage('   ')).rejects.toThrow('Text cannot be empty for language detection');
    await expect(normalizer.translateToEnglish('   ', 'Spanish')).rejects.toThrow('Text cannot be empty for translation');
    await expect(extractor.extractReceiptData('   ')).rejects.toThrow('Text cannot be empty for data extraction');
    await expect(pipeline.processReceiptText('   ')).rejects.toThrow('Receipt text cannot be empty');
  });
});