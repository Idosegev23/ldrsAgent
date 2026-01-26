/**
 * Logger
 * Simple structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  jobId?: string;
  userId?: string;
  agentId?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function formatMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  child(baseContext: LogContext): ILogger;
}

export const logger: ILogger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: LogContext) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, context));
    }
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context));
    }
  },

  error(message: string, error?: Error, context?: LogContext) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, context));
      if (error) {
        console.error(error.stack);
      }
    }
  },

  // Create a child logger with preset context
  child(baseContext: LogContext): ILogger {
    const childLogger: ILogger = {
      debug: (msg: string, ctx?: LogContext) =>
        logger.debug(msg, { ...baseContext, ...ctx }),
      info: (msg: string, ctx?: LogContext) =>
        logger.info(msg, { ...baseContext, ...ctx }),
      warn: (msg: string, ctx?: LogContext) =>
        logger.warn(msg, { ...baseContext, ...ctx }),
      error: (msg: string, err?: Error, ctx?: LogContext) =>
        logger.error(msg, err, { ...baseContext, ...ctx }),
      child: (nestedContext: LogContext) =>
        logger.child({ ...baseContext, ...nestedContext }),
    };
    return childLogger;
  },
};

