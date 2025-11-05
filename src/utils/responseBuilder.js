/**
 * Builds standardized API responses
 */
export class ResponseBuilder {
  /**
   * Creates a success response for verification
   * @param {Object} verificationResult - The verification result object
   * @returns {Object} Formatted response
   */
  static success(verificationResult) {
    return {
      isDocumentTypeMatched: verificationResult.isDocumentTypeMatched ?? false,
      isNameMatched: verificationResult.isNameMatched ?? false,
      isDOBMatched: verificationResult.isDOBMatched,
      isIdentityCardNumberMatched: verificationResult.isIdentityCardNumberMatched,
      isFaceMatched: verificationResult.isFaceMatched ?? false,
      confidence: verificationResult.confidence ?? 0,
      isVerification: verificationResult.isVerification ?? false,
      message: verificationResult.message || 'Verification complete'
    };
  }

  /**
   * Creates an error response for document type mismatch
   * @param {string} documentType - The document type that failed
   * @returns {Object} Error response
   */
  static documentTypeError(documentType) {
    return {
      isDocumentTypeMatched: false,
      message: documentType === 'aadhar' ? 'aadhar not found' : 'passport not found'
    };
  }

  /**
   * Creates a validation error response
   * @param {string} message - Error message
   * @returns {Object} Error response
   */
  static validationError(message) {
    return {
      error: 'Validation Error',
      message
    };
  }
}

