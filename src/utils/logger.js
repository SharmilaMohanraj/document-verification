import winston from 'winston';
import { mkdirSync } from 'fs';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom format for structured logging
 */
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    // Filter out internal winston properties
    const filteredMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key]) => 
        !['splat', 'Symbol(level)', 'Symbol(message)'].includes(key)
      )
    );
    if (Object.keys(filteredMetadata).length > 0) {
      msg += ` ${JSON.stringify(filteredMetadata)}`;
    }
  }
  
  return msg;
});

/**
 * Logger instance with structured logging
 */
export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Create logs directory if it doesn't exist
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

export default logger;
