import { AWSTextractService } from './textractService.js';
import { AWSRekognitionService } from './rekognitionService.js';
import { FileDownloadService } from './fileDownloadService.js';
import { logger } from '../utils/logger.js';

/**
 * Service for identity verification operations
 */
export class VerificationService {
  constructor() {
    this.textractService = new AWSTextractService();
    this.rekognitionService = new AWSRekognitionService();
    this.fileDownloadService = new FileDownloadService();
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
      case 'aadhar':
        const isAadhar = extractedText.includes('unique identification authority');
        logger.info('Aadhar validation result', { isAadhar });
        return isAadhar;

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
   * Checks if DOB exists in extracted text
   * @param {string} extractedText - Lowercase extracted text
   * @param {string} dob - Date of birth in DD/MM/YYYY format
   * @returns {boolean} Whether DOB matches
   */
  _matchDOB(extractedText, dob) {
    // Try multiple date formats that might appear in documents
    // Input format is DD/MM/YYYY
    const dateFormats = [
      dob, // DD/MM/YYYY
      dob.replace(/\//g, '-'), // DD-MM-YYYY
      dob.split('/').reverse().join('-'), // YYYY-MM-DD
      dob.split('/').reverse().join('/'), // YYYY/MM/DD
      dob.replace(/\//g, ''), // DDMMYYYY
      dob.split('/').reverse().join(''), // YYYYMMDD
    ];

    // Check if any format exists in the extracted text
    const isMatched = dateFormats.some(format => 
      extractedText.includes(format.toLowerCase())
    );

    logger.info('DOB matching result', { dob, isMatched });
    return isMatched;
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
      // Phase 0: Download all images to local files
      logger.info('Phase 0: Downloading images to local files');
      
      const [photoFilePath, identityFilePathsArray] = await Promise.all([
        this.fileDownloadService.downloadImage(photoUrl, 'photo.jpg'),
        this.fileDownloadService.downloadImages(identityUrls)
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
          await this.fileDownloadService.deleteFiles(downloadedFiles);
        }
        return {
          isDocumentTypeMatched: false,
          message: type === 'aadhar' ? 'aadhar not found' : 'passport not found'
        };
      }

      // Phase 3: Personal Info Matching
      logger.info('Phase 3: Personal Info Matching');
      const isNameMatched = this._matchName(extractedText, name);
      let isDOBMatched = undefined;
      let isIdentityCardNumberMatched = undefined;

      if (type === 'aadhar' || type === 'passport') {
        if (!dob) {
          logger.warn('DOB is required for aadhar/passport but not provided');
          isDOBMatched = false;
        } else {
          isDOBMatched = this._matchDOB(extractedText, dob);
        }

        if (!identityCardNumber) {
          logger.warn('Identity card number is required for aadhar/passport but not provided');
          isIdentityCardNumberMatched = false;
        } else {
          isIdentityCardNumberMatched = this._matchIdentityCardNumber(extractedText, identityCardNumber);
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
        await this.fileDownloadService.deleteFiles(downloadedFiles);
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

