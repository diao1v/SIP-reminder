import { DatabaseService } from './database';

/**
 * Shared DatabaseService singleton
 *
 * Prevents multiple instances from being created across routes,
 * avoiding duplicate Convex API dynamic imports and race conditions.
 */
let dbService: DatabaseService | null = null;

/**
 * Get or create the shared DatabaseService instance
 */
export function getDbService(convexUrl: string): DatabaseService {
  if (!dbService) {
    dbService = new DatabaseService(convexUrl);
  }
  return dbService;
}

/**
 * Reset singleton (for testing only)
 * @internal
 */
export function resetDbService(): void {
  dbService = null;
}
