// ES module exports for document verification utility
// This module can be imported using dynamic import() in CommonJS projects

/**
 * Verify identity document
 * @param {Object} options - Verification options
 * @param {string} options.name - Full name
 * @param {Date|string} options.dob - Date of birth (Date object or ISO string)
 * @param {string} options.identityCardNumber - Aadhaar or Passport number
 * @param {string} options.photoUrl - Photo S3 URL
 * @param {string|string[]} options.identityUrls - Aadhaar/Passport document S3 URL(s)
 * @param {string} options.type - Document type ('aadhaar' or 'passport')
 * @returns {Promise<Object>} Verification result
 */
async function verifyIdentity(options) {
  // Dynamic import for ES modules
  const { VerificationService } = await import('./src/services/verificationService.js');
  
  const {
    name,
    dob,
    identityCardNumber,
    photoUrl,
    identityUrls,
    type
  } = options;

  // Ensure identityUrls is an array
  const identityUrlsArray = Array.isArray(identityUrls) ? identityUrls : [identityUrls];

  const verificationService = new VerificationService();
  
  const result = await verificationService.verifyIdentity({
    name,
    dob,
    identityCardNumber,
    photoUrl,
    identityUrls: identityUrlsArray,
    type
  });

  return result;
}

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} folder - Optional folder path in S3 (default: 'documents')
 * @param {string} contentType - MIME type of the file (default: 'application/octet-stream')
 * @param {boolean} isPublic - Whether file should be publicly accessible (default: false)
 * @returns {Promise<Object>} Upload result with S3 URL and details
 */
async function uploadToS3(fileBuffer, originalName, folder = 'documents', contentType = 'application/octet-stream', isPublic = false) {
  const { S3UploadService } = await import('./src/services/s3UploadService.js');
  const uploadService = new S3UploadService();
  return await uploadService.uploadToS3(fileBuffer, originalName, folder, contentType, isPublic);
}

/**
 * Delete file from S3
 * @param {string} s3Key - S3 object key
 * @returns {Promise<Object>} Deletion result
 */
async function deleteFromS3(s3Key) {
  const { S3UploadService } = await import('./src/services/s3UploadService.js');
  const uploadService = new S3UploadService();
  return await uploadService.deleteFromS3(s3Key);
}

/**
 * Get presigned URL for private file access
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
async function getPresignedUrl(s3Key, expiresIn = 3600) {
  const { S3UploadService } = await import('./src/services/s3UploadService.js');
  const uploadService = new S3UploadService();
  return await uploadService.getPresignedUrl(s3Key, expiresIn);
}

export {
  verifyIdentity,
  uploadToS3,
  deleteFromS3,
  getPresignedUrl
};

