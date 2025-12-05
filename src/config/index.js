// Note: dotenv.config() should be called by the parent application (mlbindia-backend)
// Environment variables are read from process.env

/**
 * Application configuration
 * Loads values from environment variables with defaults
 */
export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // AWS configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info'
};

/**
 * Validates that required AWS credentials are present
 * @returns {boolean} True if credentials are configured
 */
export function hasAWSCredentials() {
  return !!(config.aws.accessKeyId && config.aws.secretAccessKey);
}

/**
 * Gets AWS client configuration
 * Only includes credentials if they are provided via environment variables
 * @returns {Object} AWS client configuration
 */
export function getAWSConfig() {
  const awsConfig = {
    region: config.aws.region
  };

  // Only include credentials if provided via environment variables
  // Otherwise, let AWS SDK use its default credential provider chain
  if (hasAWSCredentials()) {
    awsConfig.credentials = {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey
    };
  }

  return awsConfig;
}

export default config;

