export interface LogContext {
  component: string;
  operation: string;
  additionalInfo?: string;
}

function fmt(msg: string, ctx?: LogContext): string {
  if (!ctx) return msg;
  return `[${ctx.component}.${ctx.operation}] ${msg}`;
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => console.debug(fmt(msg, ctx)),
  info:  (msg: string, ctx?: LogContext) => console.log(fmt(msg, ctx)),
  warn:  (msg: string, ctx?: LogContext) => console.warn(fmt(msg, ctx)),
  error: (msg: string, ctx?: LogContext) => console.error(fmt(msg, ctx)),
};
