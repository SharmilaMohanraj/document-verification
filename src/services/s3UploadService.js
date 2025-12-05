import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getAWSConfig } from '../config/index.js';

/**
 * Service for uploading files to S3
 */
export class S3UploadService {
  constructor() {
    const awsConfig = getAWSConfig();
    this.s3Client = new S3Client(awsConfig);
    this.bucketName = process.env.AWS_S3_BUCKET;
    this.region = awsConfig.region || process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} folder - Optional folder path in S3 (e.g., 'documents', 'images')
   * @param {string} contentType - MIME type of the file
   * @param {boolean} isPublic - Whether file should be publicly accessible
   * @returns {Promise<Object>} Upload result with S3 URL and details
   */
  async uploadToS3(fileBuffer, originalName, folder = 'documents', contentType = 'application/octet-stream', isPublic = false) {
    try {
      // Generate unique filename
      const fileExtension = path.extname(originalName);
      const fileNameWithoutExt = path.basename(originalName, fileExtension);
      const sanitizedFileName = fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
      const uniqueFileName = `${sanitizedFileName}_${uuidv4()}${fileExtension}`;
      
      // Construct S3 key (path)
      const s3Key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      // Upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: isPublic ? 'public-read' : 'private' // Set ACL based on isPublic parameter
      };

      // Upload to S3
      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      // Construct URL based on visibility
      // Handle us-east-1 specially (no region in URL) vs other regions
      let fileUrl;
      if (this.region === 'us-east-1') {
        // us-east-1 uses a different endpoint format (no region in URL)
        fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
      } else {
        // Other regions include the region in the URL
        fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
      }

      logger.info('File uploaded to S3 successfully', { 
        s3Key, 
        fileName: uniqueFileName, 
        isPublic,
        size: fileBuffer.length 
      });

      return {
        success: true,
        url: fileUrl,
        key: s3Key,
        bucket: this.bucketName,
        fileName: uniqueFileName,
        originalName: originalName,
        size: fileBuffer.length,
        contentType: contentType,
        isPublic: isPublic,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      // Debug: Log AWS region used when error occurs
      console.error('AWS Region used:', this.region);
      
      logger.error('S3 upload error', { 
        error: error.message, 
        stack: error.stack,
        region: this.region,
        bucket: this.bucketName
      });
      
      
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFromS3(s3Key) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);

      logger.info('File deleted from S3 successfully', { s3Key });

      return {
        success: true,
        message: 'File deleted successfully',
        key: s3Key
      };
    } catch (error) {
      logger.error('S3 delete error', { s3Key, error: error.message, stack: error.stack });
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Get presigned URL for private file access
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<string>} Presigned URL
   */
  async getPresignedUrl(s3Key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      logger.debug('Presigned URL generated', { s3Key, expiresIn });
      
      return url;
    } catch (error) {
      logger.error('S3 presigned URL error', { s3Key, error: error.message, stack: error.stack });
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }
}

