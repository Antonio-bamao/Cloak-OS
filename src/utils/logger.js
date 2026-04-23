export function createLogger({
  sink = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`),
  now = () => new Date().toISOString()
} = {}) {
  return {
    info(message, context = {}) {
      write(sink, now, 'info', message, context);
    },
    error(message, context = {}) {
      write(sink, now, 'error', message, context);
    },
    warn(message, context = {}) {
      write(sink, now, 'warn', message, context);
    }
  };
}

function write(sink, now, level, message, context) {
  sink({
    level,
    message,
    timestamp: now(),
    ...context
  });
}
