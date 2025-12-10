/**
 * Security utility functions for client-side validation
 */

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return ''
  
  const div = document.createElement('div')
  div.textContent = input
  return div.innerHTML
}

/**
 * Validate numeric IDs (track_id, playlist_id, comment_id, etc.)
 * @param {any} id - The ID to validate
 * @returns {boolean} True if valid positive integer
 */
export const validateId = (id) => {
  return Number.isInteger(id) && id > 0
}

/**
 * Validate and sanitize comment text
 * @param {string} text - Comment text
 * @returns {Object} { isValid, text, error }
 */
export const validateCommentText = (text) => {
  const result = {
    isValid: true,
    text: '',
    error: null
  }

  if (!text || typeof text !== 'string') {
    result.isValid = false
    result.error = 'Comment cannot be empty'
    return result
  }

  const trimmed = text.trim()
  
  if (trimmed.length === 0) {
    result.isValid = false
    result.error = 'Comment cannot be empty'
    return result
  }

  if (trimmed.length > 5000) {
    result.isValid = false
    result.error = 'Comment is too long (max 5000 characters)'
    return result
  }

  result.text = trimmed
  return result
}

/**
 * Validates file uploads for security
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateFileUpload = (file, options = {}) => {
  const {
    maxSizeMB = 10,
    allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    allowedExtensions = ['.mp3', '.wav', '.ogg']
  } = options

  const result = {
    isValid: true,
    error: null
  }

  // Check if file exists
  if (!file) {
    result.isValid = false
    result.error = 'No file selected'
    return result
  }

  // Validate file type
  if (!(file instanceof File)) {
    result.isValid = false
    result.error = 'Invalid file object'
    return result
  }

  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    result.isValid = false
    result.error = `File too large. Maximum size is ${maxSizeMB}MB.`;
    return result;
  }
  
  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    result.isValid = false;
    result.error = 'Invalid file type. Please upload an allowed audio format.';
    return result;
  }
  
  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  if (!hasValidExtension) {
    result.isValid = false;
    result.error = 'Invalid file extension. Please upload an allowed audio format.';
    return result;
  }
  
  return result;
};

/**
 * Sanitize error messages for user display
 * @param {Error} error - The original error
 * @returns {string} A user-friendly error message
 */
export const sanitizeErrorMessage = (error) => {
  const errorMap = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many unsuccessful login attempts. Please try again later.',
    'storage/unauthorized': 'You don\'t have permission to access this resource.',
    'storage/quota-exceeded': 'Storage quota exceeded.',
    'default': 'An error occurred. Please try again later.'
  }

  const errorCode = error?.code || 'default'
  return errorMap[errorCode] || errorMap['default']
}

/**
 * Rate limit function calls using sessionStorage
 * @param {string} key - Unique key for the rate limit
 * @param {number} limitMs - Time limit in milliseconds
 * @returns {Object} { canProceed, remainingMs }
 */
export const checkRateLimit = (key, limitMs = 5000) => {
  try {
    const lastTimestamp = sessionStorage.getItem(`rateLimit_${key}`)
    const now = Date.now()
    
    if (!lastTimestamp) {
      sessionStorage.setItem(`rateLimit_${key}`, String(now))
      return { canProceed: true, remainingMs: 0 }
    }
    
    const timeSinceLast = now - Number(lastTimestamp)
    if (timeSinceLast >= limitMs) {
      sessionStorage.setItem(`rateLimit_${key}`, String(now))
      return { canProceed: true, remainingMs: 0 }
    }
    
    return { canProceed: false, remainingMs: limitMs - timeSinceLast }
  } catch (err) {
    console.warn('Rate limit check failed:', err)
    return { canProceed: true, remainingMs: 0 }
  }
}

/**
 * Rate limit function calls
 * @param {Function} func - The function to rate limit
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} Rate-limited function
 */
export const throttle = (func, limit) => {
  let inThrottle
  let lastResult

  return function(...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
    return lastResult
  }
}

/**
 * Debounce function calls
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay) => {
  let timeoutId
  
  return function(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}
