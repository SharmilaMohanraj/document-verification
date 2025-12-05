import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../utils/logger.js';
import { getAWSConfig } from '../config/index.js';

/**
 * Service for downloading files from S3
 */
export class S3DownloadService {
  constructor() {
    this.s3Client = new S3Client(getAWSConfig());
    // Use /tmp for serverless compatibility, ./files for local
    this.filesDir = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? tmpdir() : './files';
  }

  /**
   * Extracts bucket and key from S3 URL
   * @param {string} s3Url - S3 URL (https://bucket.s3.region.amazonaws.com/key or https://s3.region.amazonaws.com/bucket/key)
   * @returns {Object} { bucket, key }
   */
  _parseS3Url(s3Url) {
    try {
      const url = new URL(s3Url);
      
      // Handle different S3 URL formats
      // Format 1: https://bucket.s3.region.amazonaws.com/key
      // Format 2: https://s3.region.amazonaws.com/bucket/key
      // Format 3: https://s3.amazonaws.com/bucket/key
      
      let bucket, key;
      
      if (url.hostname.includes('.s3.') || url.hostname.includes('s3.amazonaws.com')) {
        const pathParts = url.pathname.split('/').filter(p => p);
        
        if (url.hostname.startsWith('s3.') || url.hostname.includes('s3.amazonaws.com')) {
          // Format: s3.region.amazonaws.com/bucket/key
          bucket = pathParts[0];
          key = pathParts.slice(1).join('/');
        } else {
          // Format: bucket.s3.region.amazonaws.com/key
          bucket = url.hostname.split('.')[0];
          key = pathParts.join('/');
        }
      } else {
        throw new Error('Invalid S3 URL format');
      }
      
      return { bucket, key };
    } catch (error) {
      throw new Error(`Failed to parse S3 URL: ${error.message}`);
    }
  }

  /**
   * Downloads a file from S3 and saves it locally
   * @param {string} s3Url - S3 URL
   * @param {string} filename - Optional custom filename
   * @returns {Promise<string>} Local file path
   */
  async downloadFromS3(s3Url, filename = null) {
    try {
      logger.info('Downloading file from S3', { s3Url });

      const { bucket, key } = this._parseS3Url(s3Url);

      // Get object from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Generate filename if not provided
      if (!filename) {
        const urlParts = key.split('/');
        const urlFilename = urlParts[urlParts.length - 1];
        const extension = urlFilename.includes('.') 
          ? urlFilename.substring(urlFilename.lastIndexOf('.'))
          : '.jpg';
        filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`;
      }

      const filePath = join(this.filesDir, filename);

      // Save to file
      await writeFile(filePath, buffer);

      logger.info('File downloaded from S3 successfully', { s3Url, filePath, size: buffer.length });

      return filePath;
    } catch (error) {
      logger.error('Error downloading file from S3', { s3Url, error: error.message });
      throw new Error(`Failed to download file from S3: ${error.message}`);
    }
  }

  /**
   * Downloads multiple files from S3
   * @param {string[]} s3Urls - Array of S3 URLs
   * @returns {Promise<string[]>} Array of local file paths
   */
  async downloadFromS3Multiple(s3Urls) {
    try {
      logger.info('Downloading multiple files from S3', { count: s3Urls.length });

      const downloadPromises = s3Urls.map((url, index) => 
        this.downloadFromS3(url, `s3_file_${index}_${Date.now()}.jpg`).catch(error => {
          logger.warn('Failed to download one file from S3', { url, error: error.message });
          return null; // Return null for failed downloads
        })
      );

      const filePaths = await Promise.all(downloadPromises);
      const validPaths = filePaths.filter(path => path !== null);

      logger.info('S3 file download completed', { 
        requested: s3Urls.length, 
        successful: validPaths.length 
      });

      return validPaths;
    } catch (error) {
      logger.error('Error downloading multiple files from S3', { error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a file
   * @param {string} filePath - File path to delete
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        logger.debug('File deleted', { filePath });
      }
    } catch (error) {
      logger.warn('Error deleting file', { filePath, error: error.message });
    }
  }

  /**
   * Deletes multiple files
   * @param {string[]} filePaths - Array of file paths to delete
   * @returns {Promise<void>}
   */
  async deleteFiles(filePaths) {
    try {
      logger.info('Cleaning up temporary files', { count: filePaths.length });

      const deletePromises = filePaths.map(filePath => this.deleteFile(filePath));
      await Promise.all(deletePromises);

      logger.info('File cleanup completed', { count: filePaths.length });
    } catch (error) {
      logger.warn('Error during file cleanup', { error: error.message });
    }
  }
}

