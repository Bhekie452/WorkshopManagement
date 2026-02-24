import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum LogLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

interface LogEntry {
    level: LogLevel;
    message: string;
    details?: any;
    timestamp: any;
    userAgent: string;
    url: string;
}

const LOGS_COLLECTION = 'system_logs';

export class Logger {
    static async log(level: LogLevel, message: string, details?: any) {
        const entry: LogEntry = {
            level,
            message,
            details: details ? JSON.parse(JSON.stringify(details, Object.getOwnPropertyNames(details))) : null,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Always log to console
        const consoleMethod = level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : console.log;
        consoleMethod(`[${level.toUpperCase()}] ${message}`, details || '');

        // In production, log critical errors to Firestore
        // We check for window.location.hostname to avoid logging from localhost unless forced
        const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

        if (isProduction || level === LogLevel.ERROR) {
            try {
                await addDoc(collection(db, LOGS_COLLECTION), entry);
            } catch (err) {
                console.error('Failed to send log to Firestore:', err);
            }
        }
    }

    static info(message: string, details?: any) {
        this.log(LogLevel.INFO, message, details);
    }

    static warn(message: string, details?: any) {
        this.log(LogLevel.WARN, message, details);
    }

    static error(message: string, error?: any) {
        this.log(LogLevel.ERROR, message, error);
    }
}
