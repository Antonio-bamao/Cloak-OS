import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

export function createLoggerFromConfig(config) {
  if (config.logging?.filePath) {
    return createLogger({
      sink: createRotatingFileSink(config.logging)
    });
  }

  return createLogger();
}

export function createRotatingFileSink({
  filePath,
  maxBytes,
  maxFiles
}) {
  const directory = path.dirname(filePath);
  const archiveLimit = Math.max(0, maxFiles - 1);

  mkdirSync(directory, { recursive: true });

  return (entry) => {
    const line = `${JSON.stringify(entry)}\n`;
    rotateIfNeeded(filePath, Buffer.byteLength(line), {
      archiveLimit,
      maxBytes
    });
    writeFileSync(filePath, line, { flag: 'a' });
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

function rotateIfNeeded(filePath, nextBytes, { archiveLimit, maxBytes }) {
  if (!existsSync(filePath)) {
    return;
  }

  const currentBytes = statSync(filePath).size;

  if (currentBytes === 0 || currentBytes + nextBytes <= maxBytes) {
    return;
  }

  if (archiveLimit === 0) {
    rmSync(filePath, { force: true });
    return;
  }

  rmSync(`${filePath}.${archiveLimit}`, { force: true });

  for (let index = archiveLimit - 1; index >= 1; index -= 1) {
    const source = `${filePath}.${index}`;
    if (existsSync(source)) {
      renameSync(source, `${filePath}.${index + 1}`);
    }
  }

  renameSync(filePath, `${filePath}.1`);
}
