import { PrismaClient } from '@prisma/client';
import { persistentStore } from './persistent-store';

let nativePrisma: PrismaClient | null = null;
let isNativeBroken = false;

try {
  nativePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn'] : ['error'],
  });
} catch (e) {
  isNativeBroken = true;
  console.warn('[Database] PrismaClient init failed, using persistent fallback store:', e);
}

/**
 * Creates a smart proxy that attempts native Prisma operations first,
 * and seamlessly falls back to persistentStore if Prisma fails or cannot connect to PostgreSQL.
 */
function createResilientModelProxy(modelName: string) {
  return new Proxy({}, {
    get(_target, prop: string) {
      return async (...args: any[]) => {
        // If nativePrisma exists and is not broken, attempt native call
        if (!isNativeBroken && nativePrisma && typeof (nativePrisma as any)[modelName]?.[prop] === 'function') {
          try {
            return await (nativePrisma as any)[modelName][prop](...args);
          } catch (err: any) {
            // Check for Prisma engine, connection, or initialization errors
            const isEngineError =
              err?.name === 'PrismaClientInitializationError' ||
              err?.message?.includes('Query Engine') ||
              err?.message?.includes('Can\'t reach database server') ||
              err?.message?.includes('query_engine');

            if (isEngineError) {
              isNativeBroken = true;
              // Fallback directly to persistentStore
              const fallbackModel = (persistentStore as any)[modelName];
              if (fallbackModel && typeof fallbackModel[prop] === 'function') {
                return await fallbackModel[prop](...args);
              }
            }
            throw err;
          }
        }

        // If nativePrisma is null or method not present, use persistentStore
        const fallbackModel = (persistentStore as any)[modelName];
        if (fallbackModel && typeof fallbackModel[prop] === 'function') {
          return await fallbackModel[prop](...args);
        }
        throw new Error(`Method ${modelName}.${prop} is not implemented on persistentStore`);
      };
    }
  });
}

const handler: ProxyHandler<any> = {
  get(_target, prop: string) {
    if (prop === '$transaction') {
      return async (arg: any) => {
        if (nativePrisma) {
          try {
            return await nativePrisma.$transaction(arg);
          } catch (err: any) {
            const isEngineError =
              err?.name === 'PrismaClientInitializationError' ||
              err?.message?.includes('Query Engine') ||
              err?.message?.includes('Can\'t reach database server');
            if (isEngineError) {
              return persistentStore.$transaction(arg);
            }
            throw err;
          }
        }
        return persistentStore.$transaction(arg);
      };
    }

    if (prop === '$disconnect') {
      return async () => {
        if (nativePrisma) {
          try {
            await nativePrisma.$disconnect();
          } catch (_) {}
        }
        return persistentStore.$disconnect();
      };
    }

    // Return resilient model proxy
    return createResilientModelProxy(prop);
  }
};

export const prisma = new Proxy({}, handler) as unknown as PrismaClient;
export { persistentStore };
