/**
 * Password hashing and verification utilities
 * 
 * Uses Web Crypto API for edge runtime compatibility
 * Falls back to simple comparison for migration from plaintext
 */

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Hash a password using PBKDF2
 * @param password Plain text password
 * @returns Hashed password in format: salt:hash (both base64)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  
  const hash = new Uint8Array(derivedBits);
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hash));
  
  return `${saltB64}:${hashB64}`;
}

/**
 * Verify a password against a hash
 * Supports both:
 * - New hashed passwords (format: salt:hash)
 * - Legacy plaintext passwords (for migration)
 * 
 * @param password Plain text password to verify
 * @param storedPassword Stored password (hashed or plaintext)
 * @returns True if password matches
 */
export async function verifyPassword(
  password: string,
  storedPassword: string
): Promise<boolean> {
  // Check if stored password is hashed (contains colon separator)
  if (storedPassword.includes(':')) {
    try {
      const [saltB64, hashB64] = storedPassword.split(':');
      const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
      const storedHash = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));
      
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        KEY_LENGTH * 8
      );
      
      const computedHash = new Uint8Array(derivedBits);
      
      // Constant-time comparison to prevent timing attacks
      if (computedHash.length !== storedHash.length) {
        return false;
      }
      
      let diff = 0;
      for (let i = 0; i < computedHash.length; i++) {
        diff |= computedHash[i] ^ storedHash[i];
      }
      
      return diff === 0;
    } catch {
      // If parsing fails, fall back to plaintext comparison
      return password === storedPassword;
    }
  }
  
  // Legacy plaintext password comparison
  // This allows existing users to log in before their passwords are migrated
  return password === storedPassword;
}

/**
 * Check if a password is already hashed
 */
export function isPasswordHashed(password: string): boolean {
  if (!password.includes(':')) return false;
  const parts = password.split(':');
  if (parts.length !== 2) return false;
  // Check if both parts are valid base64
  try {
    atob(parts[0]);
    atob(parts[1]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Password strength validation
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  // Optional: Add more requirements
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Password must contain at least one uppercase letter');
  // }
  // if (!/[a-z]/.test(password)) {
  //   errors.push('Password must contain at least one lowercase letter');
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors.push('Password must contain at least one number');
  // }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
