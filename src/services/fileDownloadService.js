import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';

/**
 * Service for downloading and managing image files
 */
export class FileDownloadService {
  constructor() {
    // Create files directory if it doesn't exist
    this.filesDir = './files';
    this._ensureFilesDirectory();
  }

  /**
   * Ensures the files directory exists
   */
  async _ensureFilesDirectory() {
    try {
      if (!existsSync(this.filesDir)) {
        await mkdir(this.filesDir, { recursive: true });
        logger.info('Created files directory', { path: this.filesDir });
      }
    } catch (error) {
      logger.error('Error creating files directory', { error: error.message });
      throw error;
    }
  }

  /**
   * Downloads an image from URL and saves it locally
   * @param {string} url - Image URL
   * @param {string} filename - Optional custom filename
   * @returns {Promise<string>} Local file path
   */
  async downloadImage(url, filename = null) {
    try {
      logger.info('Downloading image', { url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // Generate filename if not provided
      if (!filename) {
        const urlParts = url.split('/');
        const urlFilename = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
        const extension = urlFilename.includes('.') 
          ? urlFilename.substring(urlFilename.lastIndexOf('.'))
          : '.jpg';
        filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`;
      }

      const filePath = join(this.filesDir, filename);

      // Read image data
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save to file
      await writeFile(filePath, buffer);

      logger.info('Image downloaded successfully', { url, filePath, size: buffer.length });

      return filePath;
    } catch (error) {
      logger.error('Error downloading image', { url, error: error.message });
      throw new Error(`Failed to download image from ${url}: ${error.message}`);
    }
  }

  /**
   * Downloads multiple images from URLs
   * @param {string[]} urls - Array of image URLs
   * @returns {Promise<string[]>} Array of local file paths
   */
  async downloadImages(urls) {
    try {
      logger.info('Downloading multiple images', { count: urls.length });

      const downloadPromises = urls.map((url, index) => 
        this.downloadImage(url, `image_${index}_${Date.now()}.jpg`).catch(error => {
          logger.warn('Failed to download one image', { url, error: error.message });
          return null; // Return null for failed downloads
        })
      );

      const filePaths = await Promise.all(downloadPromises);
      const validPaths = filePaths.filter(path => path !== null);

      logger.info('Image download completed', { 
        requested: urls.length, 
        successful: validPaths.length 
      });

      return validPaths;
    } catch (error) {
      logger.error('Error downloading multiple images', { error: error.message });
      throw error;
    }
  }

  /**
   * Reads image file and returns buffer
   * @param {string} filePath - Local file path
   * @returns {Promise<Buffer>} Image buffer
   */
  async readImageFile(filePath) {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const buffer = await readFile(filePath);
      logger.debug('Image file read', { filePath, size: buffer.length });
      return buffer;
    } catch (error) {
      logger.error('Error reading image file', { filePath, error: error.message });
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
      // Don't throw - cleanup failures shouldn't break the flow
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
      // Don't throw - cleanup failures shouldn't break the flow
    }
  }

  /**
   * Gets the files directory path
   * @returns {string} Files directory path
   */
  getFilesDirectory() {
    return this.filesDir;
  }
}

