export function getFriendlyErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred.';

  // specific string messages
  const message = typeof error === 'string' ? error : error.message || '';
  
  // Network / Connection
  if (message.includes('Failed to fetch') || message.includes('Network request failed') || message.includes('Connection refused')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Auth specific
  if (message.includes('CredentialsSignin') || message.includes('Invalid credentials')) {
    return 'The email or password you entered is incorrect.';
  }
  if (message.includes('User not found')) {
    return 'We couldn\'t find an account with that email.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please verify your email address before signing in.';
  }
  if (message.includes('Account already exists')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  // Http Status roughly mapped if they appear in message
  if (message.includes('404')) {
    return 'We couldn\'t find what you were looking for (404).'; // Keep code slightly visible if requested? keeping it simple.
  }
  if (message.includes('401') || message.includes('403')) {
    return 'You don\'t have permission to perform this action.';
  }
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'Something went wrong on our end. Please try again later.';
  }

  // JSON / Parsing
  if (message.includes('JSON')) {
    return 'We received unexpected data from the server.';
  }

  // Fallback for generic errors if they are too short or technical
  if (message.length < 5) return 'An unknown error occurred.';

  // If it's a clean message, return it, otherwise try to clean it
  return message;
}
