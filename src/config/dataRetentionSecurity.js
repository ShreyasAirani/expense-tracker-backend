// Data Retention Security Configuration

export const SECURITY_CONFIG = {
  // Rate limiting configuration
  RATE_LIMITS: {
    GENERAL_OPERATIONS: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 operations per window
    },
    CLEANUP_OPERATIONS: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 2, // 2 cleanup operations per hour
    },
    ADMIN_OPERATIONS: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 1, // 1 global cleanup per day
    }
  },

  // Account security requirements
  ACCOUNT_REQUIREMENTS: {
    MIN_ACCOUNT_AGE_DAYS: 7, // Account must be 7 days old
    REQUIRED_VERIFICATION: true, // Email verification required
    ALLOWED_STATUSES: ['active', 'verified'], // Only active accounts
    BLOCKED_STATUSES: ['suspended', 'banned', 'pending']
  },

  // Data retention limits
  RETENTION_LIMITS: {
    MIN_MONTHS: 1, // Minimum 1 month retention
    MAX_MONTHS: 12, // Maximum 12 months retention
    DEFAULT_MONTHS: 3, // Default 3 months
    COMPLIANCE_MIN: 1 // Legal compliance minimum
  },

  // Audit and logging
  AUDIT_CONFIG: {
    LOG_ALL_OPERATIONS: true,
    LOG_FAILED_ATTEMPTS: true,
    LOG_ADMIN_OPERATIONS: true,
    RETENTION_PERIOD_DAYS: 365, // Keep audit logs for 1 year
    SENSITIVE_FIELDS: ['password', 'token', 'secret'] // Fields to exclude from logs
  },

  // Security headers
  SECURITY_HEADERS: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },

  // Confirmation requirements
  CONFIRMATION: {
    REQUIRED_FOR_CLEANUP: true,
    CONFIRMATION_TEXT: 'DELETE_MY_DATA',
    ADMIN_CONFIRMATION_TEXT: 'GLOBAL_CLEANUP_CONFIRMED',
    TIMEOUT_MINUTES: 5 // Confirmation expires after 5 minutes
  },

  // Encryption and data protection
  DATA_PROTECTION: {
    ENCRYPT_AUDIT_LOGS: false, // Set to true in production
    HASH_USER_IDS_IN_LOGS: false, // Set to true for privacy
    ANONYMIZE_AFTER_DAYS: 90, // Anonymize logs after 90 days
    SECURE_DELETE: true // Use secure deletion methods
  },

  // Compliance settings
  COMPLIANCE: {
    GDPR_ENABLED: true,
    CCPA_ENABLED: true,
    DATA_SUBJECT_RIGHTS: true,
    RIGHT_TO_BE_FORGOTTEN: true,
    DATA_PORTABILITY: true
  },

  // Monitoring and alerting
  MONITORING: {
    ALERT_ON_BULK_DELETIONS: true,
    BULK_DELETION_THRESHOLD: 1000, // Alert if >1000 records deleted
    ALERT_ON_ADMIN_OPERATIONS: true,
    ALERT_ON_FAILED_ATTEMPTS: true,
    MAX_FAILED_ATTEMPTS: 5 // Lock after 5 failed attempts
  }
};

// Security validation functions
export const validateRetentionPeriod = (months) => {
  const { MIN_MONTHS, MAX_MONTHS } = SECURITY_CONFIG.RETENTION_LIMITS;
  
  if (!Number.isInteger(months)) {
    throw new Error('Retention period must be an integer');
  }
  
  if (months < MIN_MONTHS) {
    throw new Error(`Minimum retention period is ${MIN_MONTHS} month(s)`);
  }
  
  if (months > MAX_MONTHS) {
    throw new Error(`Maximum retention period is ${MAX_MONTHS} month(s)`);
  }
  
  return true;
};

export const validateAccountEligibility = (user) => {
  const { MIN_ACCOUNT_AGE_DAYS, ALLOWED_STATUSES, BLOCKED_STATUSES } = SECURITY_CONFIG.ACCOUNT_REQUIREMENTS;
  
  // Check account status
  if (BLOCKED_STATUSES.includes(user.status)) {
    throw new Error(`Account status '${user.status}' is not allowed for data retention operations`);
  }
  
  if (!ALLOWED_STATUSES.includes(user.status)) {
    throw new Error(`Account must be verified to perform data retention operations`);
  }
  
  // Check account age
  const accountAge = Date.now() - new Date(user.createdAt).getTime();
  const minAge = MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  
  if (accountAge < minAge) {
    const daysOld = Math.floor(accountAge / (24 * 60 * 60 * 1000));
    throw new Error(`Account must be at least ${MIN_ACCOUNT_AGE_DAYS} days old. Current age: ${daysOld} days`);
  }
  
  return true;
};

export const sanitizeAuditLog = (logData) => {
  const { SENSITIVE_FIELDS } = SECURITY_CONFIG.AUDIT_CONFIG;
  const sanitized = { ...logData };
  
  // Remove sensitive fields
  SENSITIVE_FIELDS.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // Remove nested sensitive data
  if (sanitized.requestData) {
    SENSITIVE_FIELDS.forEach(field => {
      if (sanitized.requestData[field]) {
        sanitized.requestData[field] = '[REDACTED]';
      }
    });
  }
  
  return sanitized;
};

export const generateSecurityToken = () => {
  // Generate a secure token for confirmation operations
  const crypto = await import('crypto');
  return crypto.randomBytes(32).toString('hex');
};

export const validateConfirmation = (provided, required = SECURITY_CONFIG.CONFIRMATION.CONFIRMATION_TEXT) => {
  if (provided !== required) {
    throw new Error(`Invalid confirmation. Expected: "${required}"`);
  }
  return true;
};

// Security event types for monitoring
export const SECURITY_EVENTS = {
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  BULK_DELETION: 'bulk_deletion',
  ADMIN_OPERATION: 'admin_operation',
  FAILED_CONFIRMATION: 'failed_confirmation',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  DATA_BREACH_ATTEMPT: 'data_breach_attempt'
};

// Security monitoring function
export const logSecurityEvent = (eventType, details) => {
  const securityLog = {
    type: 'SECURITY_EVENT',
    eventType,
    timestamp: new Date().toISOString(),
    details: sanitizeAuditLog(details),
    severity: getSeverityLevel(eventType)
  };
  
  console.log(`🚨 SECURITY EVENT [${eventType}]:`, JSON.stringify(securityLog, null, 2));
  
  // In production, send to security monitoring service
  // securityMonitor.alert(securityLog);
  
  return securityLog;
};

const getSeverityLevel = (eventType) => {
  const severityMap = {
    [SECURITY_EVENTS.UNAUTHORIZED_ACCESS]: 'HIGH',
    [SECURITY_EVENTS.BULK_DELETION]: 'MEDIUM',
    [SECURITY_EVENTS.ADMIN_OPERATION]: 'LOW',
    [SECURITY_EVENTS.FAILED_CONFIRMATION]: 'MEDIUM',
    [SECURITY_EVENTS.RATE_LIMIT_EXCEEDED]: 'LOW',
    [SECURITY_EVENTS.SUSPICIOUS_ACTIVITY]: 'HIGH',
    [SECURITY_EVENTS.DATA_BREACH_ATTEMPT]: 'CRITICAL'
  };
  
  return severityMap[eventType] || 'MEDIUM';
};

export default {
  SECURITY_CONFIG,
  validateRetentionPeriod,
  validateAccountEligibility,
  sanitizeAuditLog,
  generateSecurityToken,
  validateConfirmation,
  SECURITY_EVENTS,
  logSecurityEvent
};
