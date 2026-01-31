/**
 * @cloudpilot/shared - Shared utilities and types
 */

// Result type
export {
  type Result,
  type Ok,
  type Err,
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  tryCatch,
  tryCatchAsync,
  combine,
  combineObject,
  match,
} from './utils/result.js';

// Functional utilities
export {
  pipe,
  pipeAsync,
  compose,
  identity,
  constant,
  memoize,
  memoizeWithTTL,
  debounce,
  throttle,
  groupBy,
  keyBy,
  partition,
  chunk,
  uniqBy,
} from './utils/functional.js';

// Validation
export {
  type Validator,
  type ValidationError,
  string,
  nonEmptyString,
  number,
  integer,
  boolean,
  email,
  uuid,
  url,
  isoDate,
  minLength,
  maxLength,
  length,
  range,
  pattern,
  oneOf,
  optional,
  nullable,
  array,
  object,
  and,
  or,
} from './utils/validation.js';

// Types
export type { User, Session, ApiResponse } from './types/index.js';

// Logging
export {
  type LogEntry,
  type LogLevel,
  type LogSource,
  type LogWriter,
  type LoggerConfig,
  LOG_LEVELS,
  LOG_COLORS,
  RESET_COLOR,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_ROTATED_FILES_KEEP,
  DEFAULT_BATCH_SIZE,
  DEFAULT_BATCH_INTERVAL_MS,
  ConsoleWriter,
  FetchWriter,
  MemoryWriter,
  Logger,
  createLogger,
} from './logging/index.js';
