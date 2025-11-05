/**
 * @typedef {Object} VerifyIdentityRequest
 * @property {string} name - User's full name
 * @property {string} [dob] - Date of birth in DD/MM/YYYY format (required for aadhar/passport)
 * @property {string} [identityCardNumber] - Identity card number (required for aadhar/passport)
 * @property {string} photoUrl - Public AWS S3 URL of user's photo
 * @property {string[]} identityUrls - Array of public AWS S3 URLs of identity documents (min 1)
 * @property {"aadhar"|"passport"|"other"} type - Type of identity document
 */

/**
 * @typedef {Object} VerifyIdentityResponse
 * @property {boolean} isDocumentTypeMatched
 * @property {boolean} isNameMatched
 * @property {boolean} [isDOBMatched]
 * @property {boolean} [isIdentityCardNumberMatched]
 * @property {boolean} isFaceMatched
 * @property {number} confidence
 * @property {boolean} isVerification
 * @property {string} message
 */

/**
 * @typedef {Object} TextractResult
 * @property {string} extractedText - Combined text from all documents
 */

/**
 * @typedef {Object} RekognitionResult
 * @property {boolean} isFaceMatched
 * @property {number} confidence
 */

