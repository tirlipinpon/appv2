import { Injectable, inject, Optional } from '@angular/core';
import { ENVIRONMENT } from '../../tokens/environment.token';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Service de logging centralisé
 * Principe SRP : Gère uniquement le logging
 * Remplace tous les console.log du projet
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private readonly environment = inject(ENVIRONMENT, { optional: true });
  private logLevel: LogLevel = LogLevel.DEBUG;
  private enabledInProduction = false;

  constructor() {
    // Déterminer le niveau de log selon l'environnement
    if (this.environment) {
      this.logLevel = this.enabledInProduction ? LogLevel.INFO : LogLevel.NONE;
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      if (error) {
        console.error(`[ERROR] ${message}`, error, ...args);
      } else {
        console.error(`[ERROR] ${message}`, ...args);
      }
    }
  }

  group(title: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.group(title);
    }
  }

  groupEnd(): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}
