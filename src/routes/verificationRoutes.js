import express from 'express';
import { VerificationController } from '../controllers/verificationController.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const verificationController = new VerificationController();

/**
 * POST /verify-identity
 * Verifies identity document against provided information
 */
router.post('/verify-identity', async (req, res) => {
  await verificationController.verifyIdentity(req, res);
});

export default router;

