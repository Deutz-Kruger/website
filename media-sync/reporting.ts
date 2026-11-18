export interface SyncLogger {
  info(message: string): void;
  warn(message: string): void;
}

export const defaultLogger: SyncLogger = {
  info: console.log,
  warn: console.warn,
};
