/**
 * Centralized Logging Utilities
 * Consolidates duplicate console logging patterns across components
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  component: string;
  operation: string;
  additionalInfo?: string;
}

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    if (context) {
      const contextString = `${context.component}.${context.operation}`;
      const additionalInfo = context.additionalInfo ? ` (${context.additionalInfo})` : '';
      return `[${timestamp}] [${levelName}] [${contextString}]${additionalInfo}: ${message}`;
    }
    
    return `[${timestamp}] [${levelName}]: ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, context));
    }
  }

  // Convenience methods for common operations
  modelAdded(modelName: string): void {
    this.info(`Model added: ${modelName}`, { component: 'ModelManager', operation: 'addModel' });
  }

  modelUpdated(modelName: string): void {
    this.info(`Model updated: ${modelName}`, { component: 'ModelManager', operation: 'updateModel' });
  }

  modelRemoved(modelId: string): void {
    this.info(`Model removed: ${modelId}`, { component: 'ModelManager', operation: 'removeModel' });
  }

  recordSent(recordTitle: string): void {
    this.info(`Record sent: ${recordTitle}`, { component: 'RecordManager', operation: 'sendRecord' });
  }

  recordReceived(recordTitle: string, peerId: string): void {
    this.info(`Record received from peer ${peerId}: ${recordTitle}`, { 
      component: 'RecordManager', 
      operation: 'receiveRecord',
      additionalInfo: peerId
    });
  }

  peerJoined(peerId: string): void {
    this.info(`Peer ${peerId} joined`, { component: 'Trystero', operation: 'peerJoin' });
  }

  peerLeft(peerId: string): void {
    this.info(`Peer ${peerId} left`, { component: 'Trystero', operation: 'peerLeave' });
  }

  dataStored(store: string, itemId: string): void {
    this.info(`Data stored in ${store}: ${itemId}`, { 
      component: 'IndexedDB', 
      operation: 'storeData',
      additionalInfo: store
    });
  }

  dataLoaded(store: string, count: number): void {
    this.info(`Loaded ${count} items from ${store}`, { 
      component: 'IndexedDB', 
      operation: 'loadData',
      additionalInfo: store
    });
  }

  operationError(operation: string, error: unknown, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.error(`Error in ${operation}: ${errorMessage}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions for common patterns
export const logModelOperation = (operation: 'add' | 'update' | 'remove', modelName: string) => {
  switch (operation) {
    case 'add':
      logger.modelAdded(modelName);
      break;
    case 'update':
      logger.modelUpdated(modelName);
      break;
    case 'remove':
      logger.modelRemoved(modelName);
      break;
  }
};

export const logRecordOperation = (operation: 'sent' | 'received', recordTitle: string, peerId?: string) => {
  switch (operation) {
    case 'sent':
      logger.recordSent(recordTitle);
      break;
    case 'received':
      if (peerId) {
        logger.recordReceived(recordTitle, peerId);
      }
      break;
  }
};

export const logDataOperation = (operation: 'stored' | 'loaded', store: string, itemId?: string, count?: number) => {
  switch (operation) {
    case 'stored':
      if (itemId) {
        logger.dataStored(store, itemId);
      }
      break;
    case 'loaded':
      if (count !== undefined) {
        logger.dataLoaded(store, count);
      }
      break;
  }
};
