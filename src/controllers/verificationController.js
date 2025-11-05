import { VerificationService } from '../services/verificationService.js';
import { ResponseBuilder } from '../utils/responseBuilder.js';
import { logger } from '../utils/logger.js';

/**
 * Controller for identity verification endpoints
 */
export class VerificationController {
  constructor() {
    this.verificationService = new VerificationService();
  }

  /**
   * Validates request body
   * @param {Object} body - Request body
   * @returns {{isValid: boolean, error?: string}}
   */
  _validateRequest(body) {
    const { name, dob, identityCardNumber, photoUrl, identityUrls, type } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { isValid: false, error: 'name is required and must be a non-empty string' };
    }

    // Validate photoUrl
    if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.trim().length === 0) {
      return { isValid: false, error: 'photoUrl is required and must be a non-empty string' };
    }

    // Validate identityUrls
    if (!Array.isArray(identityUrls) || identityUrls.length === 0) {
      return { isValid: false, error: 'identityUrls is required and must be a non-empty array' };
    }

    if (!identityUrls.every(url => typeof url === 'string' && url.trim().length > 0)) {
      return { isValid: false, error: 'identityUrls must contain only non-empty strings' };
    }

    // Validate type
    const validTypes = ['aadhar', 'passport', 'other'];
    if (!type || !validTypes.includes(type)) {
      return { isValid: false, error: `type is required and must be one of: ${validTypes.join(', ')}` };
    }

    // Validate dob for aadhar and passport
    if ((type === 'aadhar' || type === 'passport') && (!dob || typeof dob !== 'string')) {
      return { isValid: false, error: 'dob is required for aadhar and passport types' };
    }

    // Validate dob format (DD/MM/YYYY)
    if (dob) {
      const dobRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dobRegex.test(dob)) {
        return { isValid: false, error: 'dob must be in DD/MM/YYYY format' };
      }
    }

    // Validate identityCardNumber for aadhar and passport
    if ((type === 'aadhar' || type === 'passport') && (!identityCardNumber || typeof identityCardNumber !== 'string')) {
      return { isValid: false, error: 'identityCardNumber is required for aadhar and passport types' };
    }

    // Validate identityCardNumber is non-empty if provided
    if (identityCardNumber && (typeof identityCardNumber !== 'string' || identityCardNumber.trim().length === 0)) {
      return { isValid: false, error: 'identityCardNumber must be a non-empty string' };
    }

    return { isValid: true };
  }

  /**
   * Handles POST /verify-identity request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async verifyIdentity(req, res) {
    try {
      logger.info('Received verify-identity request', { body: req.body });

      // Validate request
      const validation = this._validateRequest(req.body);
      if (!validation.isValid) {
        logger.warn('Request validation failed', { error: validation.error });
        return res.status(400).json(ResponseBuilder.validationError(validation.error));
      }

      // Perform verification
      const result = await this.verificationService.verifyIdentity(req.body);

      // Check if document type validation failed (should return 400)
      if (result.isDocumentTypeMatched === false && result.message) {
        logger.warn('Document type validation failed', { 
          type: req.body.type, 
          message: result.message 
        });
        return res.status(400).json(ResponseBuilder.documentTypeError(req.body.type));
      }

      // Return success response (even if verification failed)
      logger.info('Verification completed successfully', { 
        isVerification: result.isVerification 
      });
      return res.status(200).json(ResponseBuilder.success(result));
    } catch (error) {
      logger.error('Error in verifyIdentity controller', { 
        error: error.message,
        stack: error.stack 
      });
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred during verification'
      });
    }
  }
}

