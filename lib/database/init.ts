// Database initialization for server-side components
// This file ensures database monitoring is initialized when imported

import { initializeDatabaseMonitoring } from './startup';

// Initialize monitoring on server-side import
if (typeof window === 'undefined') {
  // Only run on server side
  let initialized = false;
  
  if (!initialized) {
    initializeDatabaseMonitoring();
    initialized = true;
  }
}

// Export initialization function for manual control
export { initializeDatabaseMonitoring, shutdownDatabaseMonitoring, verifyDatabaseConnection } from './startup';