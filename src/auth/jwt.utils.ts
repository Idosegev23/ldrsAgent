/**
 * JWT Utilities
 * Sign, verify, and manage JSON Web Tokens
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'JWTUtils' });

// JWT Secret from environment or generate one
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

/**
 * Sign a JWT token
 */
export function signToken(payload: JWTPayload): string {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      issuer: 'leadrs-agents',
      audience: 'leadrs-api',
    });
  } catch (error) {
    log.error('Failed to sign token', error as Error);
    throw new Error('Token generation failed');
  }
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(payload: Omit<JWTPayload, 'sessionId'> & { sessionId: string }): string {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'leadrs-agents',
      audience: 'leadrs-api',
    });
  } catch (error) {
    log.error('Failed to sign refresh token', error as Error);
    throw new Error('Refresh token generation failed');
  }
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'leadrs-agents',
      audience: 'leadrs-api',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      log.debug('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      log.debug('Invalid token');
    } else {
      log.error('Token verification failed', error as Error);
    }
    return null;
  }
}

/**
 * Hash a token for database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a random token
 */
export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate token expiry date
 */
export function getTokenExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
}

/**
 * Calculate refresh token expiry date
 */
export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
}
