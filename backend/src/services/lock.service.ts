import { redisService } from './redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface LockResult {
    acquired: boolean;
    lockId?: string;
}

class LockService {
    private readonly LOCK_TTL_SECONDS = parseInt(process.env.LOCK_TTL_SECONDS || '600', 10);

    // Acquire a distributed lock
    async acquireLock(resource: string, userId: string): Promise<LockResult> {
        const lockKey = this.getLockKey(resource);
        const lockId = uuidv4(); // Unique lock identifier
        const lockValue = JSON.stringify({ userId, lockId, acquiredAt: Date.now() });

        try {
            // Use SET with NX (only set if key doesn't exist) and EX (expiration)
            const result = await redisService.getClient().set(
                lockKey,
                lockValue,
                'EX',
                this.LOCK_TTL_SECONDS,
                'NX'
            );

            if (result === 'OK') {
                console.log(`🔒 Lock acquired for ${resource} by user ${userId} (lockId: ${lockId})`);
                return { acquired: true, lockId };
            }

            console.log(`🔒 Lock already held for ${resource}`);
            return { acquired: false };
        } catch (error) {
            console.error(`Error acquiring lock for ${resource}:`, error);
            return { acquired: false };
        }
    }

    // Release a distributed lock (only if lockId matches)
    async releaseLock(resource: string, lockId: string): Promise<boolean> {
        const lockKey = this.getLockKey(resource);

        try {
            // Lua script to ensure atomic check-and-delete
            const luaScript = `
        local lockValue = redis.call('get', KEYS[1])
        if lockValue then
          local lockData = cjson.decode(lockValue)
          if lockData.lockId == ARGV[1] then
            return redis.call('del', KEYS[1])
          end
        end
        return 0
      `;

            const result = await redisService.getClient().eval(luaScript, 1, lockKey, lockId);

            if (result === 1) {
                console.log(`🔓 Lock released for ${resource} (lockId: ${lockId})`);
                return true;
            }

            console.log(`🔓 Lock not released for ${resource} - lockId mismatch or expired`);
            return false;
        } catch (error) {
            console.error(`Error releasing lock for ${resource}:`, error);
            return false;
        }
    }

    // Check if a lock is currently held
    async isLocked(resource: string): Promise<boolean> {
        const lockKey = this.getLockKey(resource);
        return await redisService.exists(lockKey);
    }

    // Get lock information
    async getLockInfo(resource: string): Promise<{ userId: string; lockId: string; acquiredAt: number } | null> {
        const lockKey = this.getLockKey(resource);
        const lockValue = await redisService.get(lockKey);

        if (lockValue) {
            try {
                return JSON.parse(lockValue);
            } catch {
                return null;
            }
        }

        return null;
    }

    // Generate lock key for a resource
    private getLockKey(resource: string): string {
        return `lock:${resource}`;
    }

    // Get TTL for lock
    getLockTTL(): number {
        return this.LOCK_TTL_SECONDS;
    }
}

export const lockService = new LockService();
