# Identity Verification Service

A production-grade Node.js + Express backend service for identity document verification using AWS Textract and Rekognition.

## Features

- ✅ Single API endpoint: `POST /verify-identity`
- ✅ AWS Textract integration for document text extraction
- ✅ AWS Rekognition integration for face comparison
- ✅ Support for Aadhaar, Passport, and Other document types
- ✅ Structured logging with Winston
- ✅ Modular, scalable architecture
- ✅ Comprehensive error handling
- ✅ Request validation

## Project Structure

```
src/
├── controllers/          # Request handlers
│   └── verificationController.js
├── routes/              # Express routes
│   └── verificationRoutes.js
├── services/            # Business logic
│   ├── textractService.js
│   ├── rekognitionService.js
│   └── verificationService.js
├── utils/               # Utility functions
│   ├── logger.js
│   └── responseBuilder.js
├── types/               # Type definitions (JSDoc)
│   └── requestTypes.js
└── server.js            # Express app setup
```

## Prerequisites

- Node.js 18+ (with ES modules support)
- AWS Account with access to:
  - AWS Textract
  - AWS Rekognition
- AWS Credentials configured (via environment variables or AWS credentials file)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

Create a `.env` file (optional - can also use AWS credentials file):

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
PORT=3000
LOG_LEVEL=info
```

## Usage

### Start the server:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### API Endpoint

**POST** `/verify-identity`

**Request Body:**

```json
{
  "name": "John Doe",
  "dob": "15/06/1995",
  "identityCardNumber": "1234 5678 9012",
  "photoUrl": "https://aws-public-url/photo.jpg",
  "identityUrls": [
    "https://aws-public-url/id1.jpg",
    "https://aws-public-url/id2.jpg"
  ],
  "type": "aadhar"
}
```

**Success Response (200):**

```json
{
  "isDocumentTypeMatched": true,
  "isNameMatched": true,
  "isDOBMatched": true,
  "isIdentityCardNumberMatched": true,
  "isFaceMatched": true,
  "confidence": 97.8,
  "isVerification": true,
  "message": "Verification complete"
}
```

**Partial Match Response (200):**

```json
{
  "isDocumentTypeMatched": true,
  "isNameMatched": true,
  "isDOBMatched": false,
  "isIdentityCardNumberMatched": true,
  "isFaceMatched": true,
  "confidence": 94.2,
  "isVerification": false,
  "message": "DOB did not match, but verification continued"
}
```

**Error Response (400) - Document Type Mismatch:**

```json
{
  "isDocumentTypeMatched": false,
  "message": "aadhar not found"
}
```

**Error Response (400) - Validation Error:**

```json
{
  "error": "Validation Error",
  "message": "dob is required for aadhar and passport types"
}
```

Or:

```json
{
  "error": "Validation Error",
  "message": "identityCardNumber is required for aadhar and passport types"
}
```

## Validation Rules

- `name`: Required, non-empty string
- `dob`: Required for `aadhar` and `passport` types, format: `DD/MM/YYYY`
- `identityCardNumber`: Required for `aadhar` and `passport` types, non-empty string
- `photoUrl`: Required, public AWS S3 URL or HTTP URL
- `identityUrls`: Required, array of at least 1 URL
- `type`: Required, must be one of: `aadhar`, `passport`, `other`

## Processing Flow

1. **File Download**: Downloads all images (photoUrl and identityUrls) to a local `files/` directory
2. **Text Extraction**: Extracts text from all identity document images using AWS Textract
3. **Document Type Validation**: Validates document type based on extracted text
4. **Personal Info Matching**: Matches name, DOB, and identity card number (if applicable) from extracted text
5. **Face Verification**: Compares user's photo with face in identity documents using AWS Rekognition
6. **Cleanup**: Automatically deletes downloaded files after processing completes

## Document Type Validation

- **Aadhaar**: Checks for "unique identification authority" in extracted text
- **Passport**: Checks for "republic of india" in extracted text
- **Other**: Skips document type validation

## Verification Rules

`isVerification` is `true` only if:
- `isDocumentTypeMatched` is `true`
- `isNameMatched` is `true`
- `isDOBMatched` is `true` (for aadhar/passport)
- `isIdentityCardNumberMatched` is `true` (for aadhar/passport)
- `isFaceMatched` is `true`

For `other` document type, only `isDocumentTypeMatched`, `isNameMatched`, and `isFaceMatched` need to be `true`.

## Logging

Logs are written to:
- Console (colored output)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

Log levels: `error`, `warn`, `info`, `debug`

## Health Check

**GET** `/health`

Returns server status and timestamp.

## Error Handling

- Validation errors return HTTP 400
- Document type mismatches return HTTP 400
- Internal errors return HTTP 500
- All errors are logged with structured logging

## AWS Configuration

The service uses AWS SDK v3 and supports:
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- AWS credentials file (`~/.aws/credentials`)
- IAM role (when running on EC2/ECS/Lambda)

## License

ISC

