export interface ErrorContext {
  component: string;
  operation: string;
  additionalInfo?: string;
}

export function logError(error: unknown, context: ErrorContext): void {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${context.component}.${context.operation}]`, msg);
}

export const CommonErrorContexts = {
  dataManager: {
    addModel: (name: string): ErrorContext => ({ component: 'DataManager', operation: 'addModel', additionalInfo: name }),
    updateModel: (id: string): ErrorContext => ({ component: 'DataManager', operation: 'updateModel', additionalInfo: id }),
    removeModel: (id: string): ErrorContext => ({ component: 'DataManager', operation: 'removeModel', additionalInfo: id }),
  },
} as const;
