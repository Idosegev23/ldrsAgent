/**
 * Startup initialization for the backend systems
 * This runs once when the Next.js server starts
 */

let initialized = false;

export async function initializeBackend() {
  if (initialized) {
    return;
  }

  try {
    console.log('Initializing backend systems...');
    
    // In serverless mode, initialization is not needed
    // Agents are statically defined
    console.log('Using static agent registry (serverless mode)');
    
    initialized = true;
    console.log('Backend systems initialized successfully');
  } catch (error) {
    console.error('Failed to initialize backend:', error);
    throw error;
  }
}

// Auto-initialize on module load (server-side only)
if (typeof window === 'undefined') {
  initializeBackend().catch(console.error);
}
