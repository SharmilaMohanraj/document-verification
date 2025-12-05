import { AWSTextractService } from './textractService.js';
import { AWSRekognitionService } from './rekognitionService.js';
import { FileDownloadService } from './fileDownloadService.js';
import { S3DownloadService } from './s3DownloadService.js';
import { logger } from '../utils/logger.js';

/**
 * Service for identity verification operations
 */
export class VerificationService {
  constructor() {
    this.textractService = new AWSTextractService();
    this.rekognitionService = new AWSRekognitionService();
    this.fileDownloadService = new FileDownloadService();
    this.s3DownloadService = new S3DownloadService();
  }

  /**
   * Checks if URL is an S3 URL
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  _isS3Url(url) {
    return url.includes('s3.amazonaws.com') || url.includes('.s3.');
  }

  /**
   * Downloads file from URL (S3 or HTTP)
   * @param {string} url - File URL
   * @param {string} filename - Optional filename
   * @returns {Promise<string>} Local file path
   */
  async _downloadFile(url, filename = null) {
    if (this._isS3Url(url)) {
      return await this.s3DownloadService.downloadFromS3(url, filename);
    } else {
      return await this.fileDownloadService.downloadImage(url, filename);
    }
  }

  /**
   * Downloads multiple files from URLs (S3 or HTTP)
   * @param {string[]} urls - Array of file URLs
   * @returns {Promise<string[]>} Array of local file paths
   */
  async _downloadFiles(urls) {
    const s3Urls = urls.filter(url => this._isS3Url(url));
    const httpUrls = urls.filter(url => !this._isS3Url(url));

    const downloadPromises = [];

    if (s3Urls.length > 0) {
      downloadPromises.push(this.s3DownloadService.downloadFromS3Multiple(s3Urls));
    }

    if (httpUrls.length > 0) {
      downloadPromises.push(this.fileDownloadService.downloadImages(httpUrls));
    }

    const results = await Promise.all(downloadPromises);
    return results.flat().filter(path => path !== null);
  }

  /**
   * Validates document type based on extracted text
   * @param {string} extractedText - Lowercase extracted text
   * @param {string} documentType - Document type (aadhar, passport, other)
   * @returns {boolean} Whether document type matches
   */
  _validateDocumentType(extractedText, documentType) {
    logger.info('Validating document type', { documentType });

    switch (documentType) {
      case 'aadhaar':
      case 'aadhar': // Support both spellings for backward compatibility
        const isAadhaar = extractedText.includes('unique identification authority');
        logger.info('Aadhaar validation result', { isAadhaar });
        return isAadhaar;

      case 'passport':
        const isPassport = extractedText.includes('republic of india');
        logger.info('Passport validation result', { isPassport });
        return isPassport;

      case 'other':
        logger.info('Document type is "other", skipping validation');
        return true;

      default:
        logger.warn('Unknown document type', { documentType });
        return false;
    }
  }

  /**
   * Checks if name exists in extracted text (case-insensitive)
   * @param {string} extractedText - Lowercase extracted text
   * @param {string} name - Name to search for
   * @returns {boolean} Whether name matches
   */
  _matchName(extractedText, name) {
    const nameLower = name.toLowerCase();
    const isMatched = extractedText.includes(nameLower);
    logger.info('Name matching result', { name, isMatched });
    return isMatched;
  }

  /**
   * Formats date to DD/MM/YYYY string
   * @param {Date|string} dob - Date of birth (Date object or ISO string)
   * @returns {string} Formatted date string (DD/MM/YYYY)
   */
  _formatDOB(dob) {
    let date;
    if (dob instanceof Date) {
      date = dob;
    } else if (typeof dob === 'string') {
      date = new Date(dob);
    } else {
      throw new Error('Invalid DOB format');
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Checks if DOB exists in extracted text
   * @param {string} extractedText - Lowercase extracted text
   * @param {Date|string} dob - Date of birth (Date object or ISO string)
   * @returns {boolean} Whether DOB matches
   */
  _matchDOB(extractedText, dob) {
    // Convert DOB to DD/MM/YYYY format
    const dobString = this._formatDOB(dob);
    
    // Try multiple date formats that might appear in documents
    const dateFormats = [
      dobString, // DD/MM/YYYY
      dobString.replace(/\//g, '-'), // DD-MM-YYYY
      dobString.split('/').reverse().join('-'), // YYYY-MM-DD
      dobString.split('/').reverse().join('/'), // YYYY/MM/DD
      dobString.replace(/\//g, ''), // DDMMYYYY
      dobString.split('/').reverse().join(''), // YYYYMMDD
    ];

    // Check if any format exists in the extracted text
    const isMatched = dateFormats.some(format => 
      extractedText.includes(format.toLowerCase())
    );

    logger.info('DOB matching result', { dob: dobString, isMatched });
    return isMatched;
  }

  /**
   * Validates Aadhaar number format (12 digits, may have spaces)
   * @param {string} aadhaarNumber - Aadhaar number
   * @returns {boolean} Whether format is valid
   */
  _validateAadhaarFormat(aadhaarNumber) {
    // Remove spaces and check if it's 12 digits
    const cleaned = aadhaarNumber.replace(/\s+/g, '');
    return /^\d{12}$/.test(cleaned);
  }

  /**
   * Validates Passport number format (alphanumeric, 8-9 characters)
   * @param {string} passportNumber - Passport number
   * @returns {boolean} Whether format is valid
   */
  _validatePassportFormat(passportNumber) {
    // Remove spaces and check format
    const cleaned = passportNumber.replace(/\s+/g, '').toUpperCase();
    // Indian passport format: typically 8-9 alphanumeric characters
    return /^[A-Z0-9]{8,9}$/.test(cleaned);
  }

  /**
   * Validates identity card number format based on type
   * @param {string} identityCardNumber - Identity card number
   * @param {string} idType - ID type (aadhaar or passport)
   * @returns {boolean} Whether format is valid
   */
  _validateIdentityCardNumberFormat(identityCardNumber, idType) {
    if (idType === 'aadhaar') {
      return this._validateAadhaarFormat(identityCardNumber);
    } else if (idType === 'passport') {
      return this._validatePassportFormat(identityCardNumber);
    }
    return true; // For other types, skip format validation
  }

  /**
   * Checks if identity card number exists in extracted text
   * @param {string} extractedText - Lowercase extracted text
   * @param {string} identityCardNumber - Identity card number to search for
   * @returns {boolean} Whether identity card number matches
   */
  _matchIdentityCardNumber(extractedText, identityCardNumber) {
    // Remove spaces and convert to lowercase for comparison
    const cardNumberLower = identityCardNumber.toLowerCase().replace(/\s+/g, '');
    const extractedTextNormalized = extractedText.replace(/\s+/g, '');
    
    // Check if card number exists (with or without spaces)
    const isMatched = extractedTextNormalized.includes(cardNumberLower) || 
                     extractedText.includes(identityCardNumber.toLowerCase());
    
    logger.info('Identity card number matching result', { identityCardNumber, isMatched });
    return isMatched;
  }

  /**
   * Verifies identity document
   * @param {Object} requestData - Verification request data
   * @returns {Promise<Object>} Verification result
   */
  async verifyIdentity(requestData) {
    const { name, dob, identityCardNumber, photoUrl, identityUrls, type } = requestData;

    logger.info('Starting identity verification', { 
      name, 
      type, 
      identityUrlCount: identityUrls.length 
    });

    let downloadedFiles = [];

    try {
      // Phase 0: Download all images to local files (supports S3 and HTTP URLs)
      logger.info('Phase 0: Downloading images to local files');
      
      const [photoFilePath, identityFilePathsArray] = await Promise.all([
        this._downloadFile(photoUrl, 'photo.jpg'),
        this._downloadFiles(identityUrls)
      ]);

      const identityFilePaths = identityFilePathsArray.filter(path => path !== null);
      downloadedFiles = [photoFilePath, ...identityFilePaths];
      logger.info('Images downloaded successfully', { 
        photoFile: photoFilePath,
        identityFiles: identityFilePaths.length 
      });

      // Phase 1: Text Extraction
      logger.info('Phase 1: Text Extraction');
      const extractedText = await this.textractService.extractText(identityFilePaths);

      // Phase 2: Document Type Validation
      logger.info('Phase 2: Document Type Validation');
      const isDocumentTypeMatched = this._validateDocumentType(extractedText, type);

      if (!isDocumentTypeMatched) {
        logger.warn('Document type validation failed', { type });
        // Cleanup before returning
        if (downloadedFiles.length > 0) {
          await this.s3DownloadService.deleteFiles(downloadedFiles);
        }
        return {
          isDocumentTypeMatched: false,
          message: (type === 'aadhaar' || type === 'aadhar') ? 'aadhaar not found' : 'passport not found'
        };
      }

      // Phase 3: Personal Info Matching
      logger.info('Phase 3: Personal Info Matching');
      const isNameMatched = this._matchName(extractedText, name);
      let isDOBMatched = undefined;
      let isIdentityCardNumberMatched = undefined;
      let isIdentityCardNumberFormatValid = undefined;

      if (type === 'aadhaar' || type === 'aadhar' || type === 'passport') {
        // Validate ID number format
        if (!identityCardNumber) {
          logger.warn('Identity card number is required for aadhar/passport but not provided');
          isIdentityCardNumberFormatValid = false;
          isIdentityCardNumberMatched = false;
        } else {
          // First validate format
          isIdentityCardNumberFormatValid = this._validateIdentityCardNumberFormat(identityCardNumber, type);
          if (!isIdentityCardNumberFormatValid) {
            logger.warn('Identity card number format is invalid', { type, identityCardNumber });
            isIdentityCardNumberMatched = false;
          } else {
            // Then check if it matches in document
            isIdentityCardNumberMatched = this._matchIdentityCardNumber(extractedText, identityCardNumber);
          }
        }

        if (!dob) {
          logger.warn('DOB is required for aadhar/passport but not provided');
          isDOBMatched = false;
        } else {
          isDOBMatched = this._matchDOB(extractedText, dob);
        }
      }

      // Phase 4: Face Verification
      logger.info('Phase 4: Face Verification');
      const faceResult = await this.rekognitionService.compareFacesWithIdentity(
        photoFilePath,
        identityFilePaths
      );

      // Determine final verification status
      const isVerification = this._determineVerificationStatus(
        isDocumentTypeMatched,
        isNameMatched,
        isDOBMatched,
        isIdentityCardNumberMatched,
        faceResult.isFaceMatched,
        type
      );

      // Build message
      const message = this._buildMessage(
        isNameMatched,
        isDOBMatched,
        isIdentityCardNumberMatched,
        faceResult.isFaceMatched,
        type
      );

      const result = {
        isDocumentTypeMatched,
        isNameMatched,
        isDOBMatched,
        isIdentityCardNumberMatched,
        isIdentityCardNumberFormatValid,
        isFaceMatched: faceResult.isFaceMatched,
        confidence: faceResult.confidence,
        isVerification,
        message
      };

      logger.info('Identity verification completed', { 
        isVerification, 
        isNameMatched, 
        isDOBMatched, 
        isIdentityCardNumberMatched,
        isFaceMatched: faceResult.isFaceMatched 
      });

      return result;
    } catch (error) {
      logger.error('Error in identity verification', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    } finally {
      // Cleanup: Delete downloaded files
      if (downloadedFiles.length > 0) {
        logger.info('Cleaning up downloaded files', { count: downloadedFiles.length });
        await this.s3DownloadService.deleteFiles(downloadedFiles);
      }
    }
  }

  /**
   * Determines final verification status
   * @param {boolean} isDocumentTypeMatched
   * @param {boolean} isNameMatched
   * @param {boolean|undefined} isDOBMatched
   * @param {boolean|undefined} isIdentityCardNumberMatched
   * @param {boolean} isFaceMatched
   * @param {string} type
   * @returns {boolean}
   */
  _determineVerificationStatus(
    isDocumentTypeMatched,
    isNameMatched,
    isDOBMatched,
    isIdentityCardNumberMatched,
    isFaceMatched,
    type
  ) {
    if (!isDocumentTypeMatched || !isNameMatched || !isFaceMatched) {
      return false;
    }

    // For aadhar and passport, DOB and identity card number must match
    if (type === 'aadhar' || type === 'passport') {
      return isDOBMatched === true && isIdentityCardNumberMatched === true;
    }

    // For other types, only document type, name, and face need to match
    return true;
  }

  /**
   * Builds appropriate message based on verification results
   * @param {boolean} isNameMatched
   * @param {boolean|undefined} isDOBMatched
   * @param {boolean|undefined} isIdentityCardNumberMatched
   * @param {boolean} isFaceMatched
   * @param {string} type
   * @returns {string}
   */
  _buildMessage(isNameMatched, isDOBMatched, isIdentityCardNumberMatched, isFaceMatched, type) {
    const issues = [];

    if (!isNameMatched) {
      issues.push('name');
    }

    if (type === 'aadhar' || type === 'passport') {
      if (isDOBMatched === false) {
        issues.push('DOB');
      }
      if (isIdentityCardNumberMatched === false) {
        issues.push('identity card number');
      }
    }

    if (!isFaceMatched) {
      issues.push('face');
    }

    if (issues.length === 0) {
      return 'Verification complete';
    }

    const issueText = issues.join(', ');
    return `${issueText} did not match, but verification continued`;
  }
}

