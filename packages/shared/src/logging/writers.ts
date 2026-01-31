/**
 * Log writers - re-exports for backward compatibility
 *
 * Writers have been split into separate files in the writers/ directory.
 * This file maintains backward compatibility by re-exporting all writers.
 */

export { ConsoleWriter } from './writers/console.js';
export { FileWriter } from './writers/file.js';
export { FetchWriter } from './writers/fetch.js';
export { MemoryWriter } from './writers/memory.js';
