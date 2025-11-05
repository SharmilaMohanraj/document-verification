import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger.js';
import { getAWSConfig } from '../config/index.js';

/**
 * Service for AWS Textract operations
 */
export class AWSTextractService {
  constructor() {
    this.client = new TextractClient(getAWSConfig());
  }

  /**
   * Extracts text from a local image file
   * @param {string} filePath - Local file path
   * @returns {Promise<string>} Extracted text (lowercase)
   */
  async extractTextFromFile(filePath) {
    try {
      logger.info('Extracting text from image file', { filePath });

      // Read image file
      const imageBytes = await readFile(filePath);

      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: imageBytes
        }
      });

      const response = await this.client.send(command);

      // Combine all detected text blocks
      const extractedText = response.Blocks
        .filter(block => block.BlockType === 'LINE')
        .map(block => block.Text)
        .join(' ')
        .toLowerCase();

      logger.info('Text extraction completed', { 
        filePath, 
        textLength: extractedText.length 
      });

      return extractedText;
    } catch (error) {
      logger.error('Error extracting text from image file', { 
        filePath, 
        error: error.message,
        stack: error.stack 
      });
      throw new Error(`Failed to extract text from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Extracts text from multiple local image files
   * @param {string[]} filePaths - Array of local file paths
   * @returns {Promise<string>} Combined extracted text (lowercase)
   */
  async extractText(filePaths) {
    try {
      logger.info('Starting text extraction from multiple image files', { count: filePaths.length });

      const extractionPromises = filePaths.map(async (filePath) => {
        try {
          return await this.extractTextFromFile(filePath);
        } catch (error) {
          logger.warn('Failed to extract text from one image file', { filePath, error: error.message });
          return ''; // Return empty string if extraction fails
        }
      });

      const extractedTexts = await Promise.all(extractionPromises);
      const combinedText = extractedTexts.join(' ').toLowerCase();

      logger.info('Text extraction from all images completed', { 
        totalLength: combinedText.length 
      });

      return combinedText;
    } catch (error) {
      logger.error('Error in text extraction', { error: error.message });
      throw error;
    }
  }
}

