# Document Verification Utility

Identity verification utility using AWS Textract and Rekognition for document verification and S3 file operations.

## Features

- Identity document verification (Aadhaar/Passport)
- Personal information matching
- Face comparison using AWS Rekognition
- S3 file upload and download
- Presigned URL generation
- ID number format validation

## Installation

### From GitHub

```bash
npm install git+https://github.com/YOUR_USERNAME/document-verification.git
```

### From Local File

```bash
npm install file:../document-verification
```

## Prerequisites

- Node.js 18+ (with ES modules support)
- AWS Account with access to:
  - AWS Textract
  - AWS Rekognition
  - AWS S3
- AWS Credentials configured (via environment variables or AWS credentials file)

## Environment Variables

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=your-bucket-name
LOG_LEVEL=info
```

## Usage

### Identity Verification

```javascript
const { verifyIdentity } = require('document-verification-utility');

const result = await verifyIdentity({
  name: 'John Doe',
  dob: '1990-01-01', // Date object or ISO string
  identityCardNumber: '1234 5678 9012',
  photoUrl: 'https://s3.../photo.jpg', // S3 URL or HTTP URL
  identityUrls: ['https://s3.../aadhaar.jpg'], // Array of S3/HTTP URLs
  type: 'aadhaar' // or 'passport'
});

// Result structure:
// {
//   isDocumentTypeMatched: true,
//   isNameMatched: true,
//   isDOBMatched: true,
//   isIdentityCardNumberMatched: true,
//   isIdentityCardNumberFormatValid: true,
//   isFaceMatched: true,
//   confidence: 97.8,
//   isVerification: true,
//   message: "Verification complete"
// }
```

### S3 Upload

```javascript
const { uploadToS3, getPresignedUrl } = require('document-verification-utility');

// Upload file
const result = await uploadToS3(
  fileBuffer,           // Buffer
  'document.pdf',       // Original filename
  'documents',          // S3 folder (optional, default: 'documents')
  'application/pdf',    // Content type (optional, default: 'application/octet-stream')
  false                 // isPublic (optional, default: false)
);

// Result structure:
// {
//   success: true,
//   url: 'https://bucket.s3.region.amazonaws.com/documents/file_xxx.pdf',
//   key: 'documents/file_xxx.pdf',
//   bucket: 'your-bucket',
//   fileName: 'file_xxx.pdf',
//   originalName: 'document.pdf',
//   size: 1024000,
//   contentType: 'application/pdf',
//   isPublic: false,
//   uploadedAt: '2024-01-01T00:00:00.000Z'
// }

// Get presigned URL for private files
const presignedUrl = await getPresignedUrl(result.key, 3600); // Expires in 1 hour
```

### S3 Delete

```javascript
const { deleteFromS3 } = require('document-verification-utility');

const result = await deleteFromS3('documents/file_xxx.pdf');
```

## Verification Rules

`isVerification` is `true` only if:
- `isDocumentTypeMatched` is `true`
- `isNameMatched` is `true`
- `isDOBMatched` is `true` (for aadhaar/passport)
- `isIdentityCardNumberFormatValid` is `true` (for aadhaar/passport)
- `isIdentityCardNumberMatched` is `true` (for aadhaar/passport)
- `isFaceMatched` is `true`

## ID Number Format Validation

- **Aadhaar**: Must be exactly 12 digits (spaces allowed)
- **Passport**: Must be 8-9 alphanumeric characters

## Document Type Validation

- **Aadhaar**: Checks for "unique identification authority" in extracted text
- **Passport**: Checks for "republic of india" in extracted text

## Processing Flow

1. **File Download**: Downloads all images (photoUrl and identityUrls) from S3 or HTTP
2. **Text Extraction**: Extracts text from all identity document images using AWS Textract
3. **Document Type Validation**: Validates document type based on extracted text
4. **ID Format Validation**: Validates ID number format
5. **Personal Info Matching**: Matches name, DOB, and identity card number from extracted text
6. **Face Verification**: Compares user's photo with face in identity documents using AWS Rekognition
7. **Cleanup**: Automatically deletes downloaded files after processing completes

## Project Structure

```
document-verification/
├── index.js                    # CommonJS wrapper exports
├── package.json
├── README.md
└── src/
    ├── config/
    │   └── index.js           # AWS configuration
    ├── services/
    │   ├── fileDownloadService.js    # HTTP file download
    │   ├── s3DownloadService.js      # S3 file download
    │   ├── s3UploadService.js        # S3 file upload
    │   ├── textractService.js        # AWS Textract integration
    │   ├── rekognitionService.js     # AWS Rekognition integration
    │   └── verificationService.js    # Main verification logic
    └── utils/
        └── logger.js          # Winston logger
```

## AWS Configuration

The utility uses AWS SDK v3 and supports:
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- AWS credentials file (`~/.aws/credentials`)
- IAM role (when running on EC2/ECS/Lambda)

## License

ISC

