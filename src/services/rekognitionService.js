import { RekognitionClient, CompareFacesCommand, DetectFacesCommand } from '@aws-sdk/client-rekognition';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger.js';
import { getAWSConfig } from '../config/index.js';

/**
 * Service for AWS Rekognition operations
 */
export class AWSRekognitionService {
  constructor() {
    this.client = new RekognitionClient(getAWSConfig());
  }

  /**
   * Detects faces in a local image file
   * @param {string} filePath - Local file path
   * @returns {Promise<Object>} Face detection result
   */
  async detectFaces(filePath) {
    try {
      logger.info('Detecting faces in image file', { filePath });

      // Read image file
      const imageBytes = await readFile(filePath);

      const command = new DetectFacesCommand({
        Image: {
          Bytes: imageBytes
        }
      });

      const response = await this.client.send(command);

      logger.info('Face detection completed', { 
        filePath, 
        faceCount: response.FaceDetails?.length || 0 
      });

      return response;
    } catch (error) {
      logger.error('Error detecting faces', { 
        filePath, 
        error: error.message,
        stack: error.stack 
      });
      throw new Error(`Failed to detect faces in ${filePath}: ${error.message}`);
    }
  }

  /**
   * Compares faces between two local image files
   * @param {string} sourceFilePath - User's photo file path
   * @param {string} targetFilePath - Identity document image file path
   * @returns {Promise<{isFaceMatched: boolean, confidence: number}>} Comparison result
   */
  async compareFaces(sourceFilePath, targetFilePath) {
    try {
      logger.info('Comparing faces', { sourceFilePath, targetFilePath });

      // Read both image files
      const [sourceBytes, targetBytes] = await Promise.all([
        readFile(sourceFilePath),
        readFile(targetFilePath)
      ]);

      const command = new CompareFacesCommand({
        SourceImage: {
          Bytes: sourceBytes
        },
        TargetImage: {
          Bytes: targetBytes
        },
        SimilarityThreshold: 80 // Minimum similarity threshold (0-100)
      });

      const response = await this.client.send(command);

      // Check if we have face matches
      const faceMatches = response.FaceMatches || [];
      const isFaceMatched = faceMatches.length > 0;
      const confidence = isFaceMatched ? faceMatches[0].Similarity : 0;

      logger.info('Face comparison completed', { 
        isFaceMatched, 
        confidence,
        matchCount: faceMatches.length 
      });

      return {
        isFaceMatched,
        confidence
      };
    } catch (error) {
      logger.error('Error comparing faces', { 
        sourceFilePath, 
        targetFilePath, 
        error: error.message,
        stack: error.stack 
      });
      throw new Error(`Failed to compare faces: ${error.message}`);
    }
  }

  /**
   * Finds the first face in an image and compares it with source image
   * @param {string} sourceFilePath - User's photo file path
   * @param {string[]} identityFilePaths - Array of identity document image file paths
   * @returns {Promise<{isFaceMatched: boolean, confidence: number}>} Comparison result
   */
  async compareFacesWithIdentity(sourceFilePath, identityFilePaths) {
    try {
      logger.info('Comparing faces with identity documents', { 
        sourceFilePath, 
        identityCount: identityFilePaths.length 
      });

      // Try each identity image until we find one with a face
      for (const identityFilePath of identityFilePaths) {
        try {
          // First, check if there are faces in the identity document
          const detectResult = await this.detectFaces(identityFilePath);
          
          if (detectResult.FaceDetails && detectResult.FaceDetails.length > 0) {
            // Found a face, now compare
            const compareResult = await this.compareFaces(sourceFilePath, identityFilePath);
            
            if (compareResult.isFaceMatched) {
              logger.info('Face match found in identity document', { 
                identityFilePath, 
                confidence: compareResult.confidence 
              });
              return compareResult;
            }
          }
        } catch (error) {
          logger.warn('Error processing identity image for face comparison', { 
            identityFilePath, 
            error: error.message 
          });
          // Continue to next image
          continue;
        }
      }

      // No face match found in any identity document
      logger.warn('No face match found in any identity document');
      return {
        isFaceMatched: false,
        confidence: 0
      };
    } catch (error) {
      logger.error('Error in face comparison with identity documents', { 
        error: error.message 
      });
      throw error;
    }
  }
}

