import { nanoid } from 'nanoid';
export class CloudflareLogger {
    correlationId;
    requestId;
    defaultMetadata;
    cfInfo;
    workerInfo;
    pagesInfo;
    constructor(config = {}) {
        this.correlationId = config.correlationId;
        this.requestId = config.requestId;
        this.defaultMetadata = config.defaultMetadata || {};
        this.cfInfo = config.cfInfo;
        this.workerInfo = config.workerInfo;
        this.pagesInfo = config.pagesInfo;
    }
    debug(message, metadata) {
        this.log('debug', message, metadata);
    }
    info(message, metadata) {
        this.log('info', message, metadata);
    }
    warn(message, metadata) {
        this.log('warn', message, metadata);
    }
    error(message, metadata) {
        this.log('error', message, metadata);
    }
    fatal(message, metadata) {
        this.log('fatal', message, metadata);
    }
    pagesRequest(request, metadata) {
        const url = new URL(request.url);
        this.info(`Pages Function: ${request.method} ${url.pathname}`, {
            request: {
                method: request.method,
                url: request.url,
                path: url.pathname,
                userAgent: request.headers.get('user-agent') || undefined,
                ip: request.headers.get('cf-connecting-ip') ||
                    request.headers.get('x-forwarded-for') || undefined,
                headers: this.sanitizeHeaders(request.headers),
            },
            pages: this.pagesInfo,
            ...metadata,
        });
    }
    pagesResponse(response, duration, metadata) {
        const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';
        this.log(level, `Pages Function Response: ${response.status}`, {
            response: {
                status: response.status,
                headers: this.sanitizeHeaders(response.headers),
            },
            timing: {
                duration,
                slow: duration > 1000,
                verySlow: duration > 5000,
            },
            pages: this.pagesInfo,
            ...metadata,
        });
    }
    pagesError(error, request, metadata) {
        this.error(`Pages Function Error: ${error.message}`, {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            request: request ? {
                method: request.method,
                path: new URL(request.url).pathname,
            } : undefined,
            pages: this.pagesInfo,
            ...metadata,
        });
    }
    workerInvocation(name, invocationId, metadata) {
        this.info(`Worker Invocation: ${name}`, {
            worker: {
                ...this.workerInfo,
                name,
                invocationId,
            },
            ...metadata,
        });
    }
    workerPerformance(operation, duration, cpuTime, metadata) {
        const level = duration > 10000 ? 'warn' : 'debug';
        this.log(level, `Worker Performance: ${operation}`, {
            timing: {
                duration,
                cpuTime,
                slow: duration > 5000,
                verySlow: duration > 10000,
            },
            worker: this.workerInfo,
            ...metadata,
        });
    }
    d1Query(database, operation, sql, params, result, duration, metadata) {
        const sanitizedSql = this.sanitizeSql(sql);
        const level = duration > 1000 ? 'warn' : 'debug';
        this.log(level, `D1 Query: ${operation.toUpperCase()}`, {
            d1: {
                database,
                operation,
                sql: sanitizedSql,
                params: params.length,
                rowsAffected: result?.changes || 0,
                rowsReturned: Array.isArray(result?.results) ? result.results.length : 0,
                duration,
                success: !result?.error,
                error: result?.error?.message,
            },
            timing: {
                duration,
                slow: duration > 100,
                verySlow: duration > 1000,
            },
            ...metadata,
        });
    }
    d1BatchOperation(database, queries, duration, results, metadata) {
        const totalChanges = results.reduce((sum, r) => sum + (r?.changes || 0), 0);
        const totalRows = results.reduce((sum, r) => sum + (Array.isArray(r?.results) ? r.results.length : 0), 0);
        const errors = results.filter(r => r?.error).length;
        const level = errors > 0 ? 'error' : duration > 2000 ? 'warn' : 'info';
        this.log(level, `D1 Batch Operation: ${queries} queries`, {
            d1: {
                database,
                operation: 'batch',
                params: queries,
                rowsAffected: totalChanges,
                rowsReturned: totalRows,
                duration,
                success: errors === 0,
                error: errors > 0 ? `${errors} queries failed` : undefined,
            },
            timing: {
                duration,
                slow: duration > 1000,
                verySlow: duration > 2000,
            },
            batch: {
                queries,
                errors,
                successRate: ((queries - errors) / queries * 100).toFixed(1),
            },
            ...metadata,
        });
    }
    d1Error(database, operation, error, sql, metadata) {
        this.error(`D1 Error: ${operation}`, {
            d1: {
                database,
                operation: operation,
                sql: sql ? this.sanitizeSql(sql) : undefined,
                duration: 0,
                success: false,
                error: error.message,
            },
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            ...metadata,
        });
    }
    cfAnalytics(event, value, metadata) {
        this.info(`CF Analytics: ${event}`, {
            analytics: {
                event,
                value,
                timestamp: Date.now(),
            },
            cf: this.cfInfo,
            ...metadata,
        });
    }
    trackPagesFunction(name, fn) {
        return this.trackOperation(`pages-function-${name}`, fn);
    }
    trackWorkerOperation(name, fn) {
        return this.trackOperation(`worker-operation-${name}`, fn);
    }
    trackD1Operation(name, fn) {
        return this.trackOperation(`d1-operation-${name}`, fn);
    }
    async trackOperation(name, fn) {
        const start = Date.now();
        const startCpu = Date.now();
        this.debug(`Starting operation: ${name}`);
        try {
            const result = await fn();
            const duration = Date.now() - start;
            const cpuTime = Date.now() - startCpu;
            this.debug(`Completed operation: ${name}`, {
                timing: { duration, cpuTime },
                success: true,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.error(`Failed operation: ${name}`, {
                timing: { duration },
                error: {
                    name: error instanceof Error ? error.name : 'UnknownError',
                    message: error instanceof Error ? error.message : String(error),
                },
                success: false,
            });
            throw error;
        }
    }
    log(level, message, metadata) {
        const entry = {
            id: nanoid(),
            timestamp: new Date().toISOString(),
            level,
            source: this.inferSource(),
            message,
            correlationId: this.correlationId,
            requestId: this.requestId,
            metadata: { ...this.defaultMetadata, ...metadata },
            cf: this.cfInfo,
            worker: this.workerInfo,
            pages: this.pagesInfo,
        };
        const logFn = level === 'error' || level === 'fatal' ? console.error :
            level === 'warn' ? console.warn : console.log;
        logFn(`[CF-${entry.source.toUpperCase()}] ${JSON.stringify(entry)}`);
    }
    inferSource() {
        if (this.pagesInfo)
            return 'pages';
        if (this.workerInfo)
            return 'worker';
        return 'cloudflare';
    }
    sanitizeHeaders(headers) {
        const result = {};
        const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie'];
        headers.forEach((value, key) => {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                result[key] = '[REDACTED]';
            }
            else {
                result[key] = value.length > 100 ? `${value.substring(0, 100)}...` : value;
            }
        });
        return result;
    }
    sanitizeSql(sql) {
        let sanitized = sql
            .replace(/('[^']*'|"[^"]*")/g, "'[REDACTED]'")
            .replace(/\s+/g, ' ')
            .trim();
        return sanitized.length > 200 ? `${sanitized.substring(0, 200)}...` : sanitized;
    }
    static forPagesFunction(env, request, functionName) {
        const correlationId = nanoid();
        const requestId = nanoid();
        return new CloudflareLogger({
            correlationId,
            requestId,
            cfInfo: this.extractCfInfo(request),
            pagesInfo: {
                environment: env.NODE_ENV === 'production' ? 'production' : 'preview',
                functionName,
            },
        });
    }
    static forWorker(env, request) {
        return new CloudflareLogger({
            correlationId: nanoid(),
            requestId: request ? nanoid() : undefined,
            cfInfo: request ? this.extractCfInfo(request) : undefined,
            workerInfo: {
                name: env.WORKER_NAME || 'cloudpilot-api',
                version: env.WORKER_VERSION,
                invocationId: nanoid(),
            },
        });
    }
    static forD1(database, correlationId) {
        return new CloudflareLogger({
            correlationId: correlationId || nanoid(),
            defaultMetadata: { database },
        });
    }
    static extractCfInfo(request) {
        const cf = request.cf;
        return cf ? {
            colo: cf.colo,
            country: cf.country,
            city: cf.city,
            region: cf.region,
            timezone: cf.timezone,
            postalCode: cf.postalCode,
            metroCode: cf.metroCode,
            asn: cf.asn,
            asOrganization: cf.asOrganization,
        } : undefined;
    }
}
export function createPagesLogger(env, request, functionName) {
    return CloudflareLogger.forPagesFunction(env, request, functionName);
}
export function createWorkerLogger(env, request) {
    return CloudflareLogger.forWorker(env, request);
}
export function createD1Logger(database, correlationId) {
    return CloudflareLogger.forD1(database, correlationId);
}
