/**
 * Centralized Error Handling Utilities
 * Consolidates duplicate error handling patterns across components
 */

export interface ErrorContext {
  component: string;
  operation: string;
  additionalInfo?: string;
}

/**
 * Standardized error logging with context
 */
export function logError(error: unknown, context: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const contextString = `${context.component}.${context.operation}`;
  const additionalInfo = context.additionalInfo ? ` (${context.additionalInfo})` : '';
  
  console.error(`[${contextString}]${additionalInfo}:`, errorMessage);
}

/**
 * Handle async operations with standardized error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  fallback?: T
): Promise<T | undefined> {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    logError(error, context);
    return fallback;
  }
}

/**
 * Handle sync operations with standardized error handling
 */
export function handleSyncOperation<T>(
  operation: () => T,
  context: ErrorContext,
  fallback?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    logError(error, context);
    return fallback;
  }
}

/**
 * Create error context for common operations
 */
export function createErrorContext(component: string, operation: string, additionalInfo?: string): ErrorContext {
  return { component, operation, additionalInfo };
}

/**
 * Common error contexts for frequently used operations
 */
export const CommonErrorContexts = {
  dataManager: {
    addModel: (modelName: string) => createErrorContext('DataManager', 'addModel', modelName),
    updateModel: (modelId: string) => createErrorContext('DataManager', 'updateModel', modelId),
    removeModel: (modelId: string) => createErrorContext('DataManager', 'removeModel', modelId),
    loadModels: () => createErrorContext('DataManager', 'loadModels'),
  },
  idb: {
    savePin: (pinId: string) => createErrorContext('IndexedDB', 'savePin', pinId),
    loadPins: () => createErrorContext('IndexedDB', 'loadPins'),
    deleteOldRecords: () => createErrorContext('IndexedDB', 'deleteOldRecords'),
  },
  cesium: {
    addModelToScene: (modelId: string) => createErrorContext('Cesium', 'addModelToScene', modelId),
    removeModelFromScene: (modelId: string) => createErrorContext('Cesium', 'removeModelFromScene', modelId),
    flyTo: (destination: string) => createErrorContext('Cesium', 'flyTo', destination),
  },
  form: {
    validateModel: () => createErrorContext('Form', 'validateModel'),
    submitModel: (modelName: string) => createErrorContext('Form', 'submitModel', modelName),
  }
} as const;