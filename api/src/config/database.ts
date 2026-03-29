import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma client instance
 */
declare global {
	var __prisma: PrismaClient | undefined;
}

/**
 * Create Prisma client with proper configuration
 */
const createPrismaClient = (): PrismaClient => {
	return new PrismaClient({
		log: process.env.NODE_ENV === 'development'
			? ['query', 'info', 'warn', 'error']
			: ['error'],
		errorFormat: 'pretty',
	});
};

/**
 * Singleton Prisma client
 * In development, use global variable to prevent multiple instances
 * In production, create new instance
 */
export const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV === 'development') {
	globalThis.__prisma = prisma;
}

/**
 * Database connection utilities
 */
export const database = {
	/**
	 * Test database connection
	 */
	async connect(): Promise<void> {
		try {
			await prisma.$connect();
			console.log('✅ Database connected successfully');
		} catch (error) {
			console.error('❌ Database connection failed:', error);
			throw error;
		}
	},

	/**
	 * Disconnect from database
	 */
	async disconnect(): Promise<void> {
		try {
			await prisma.$disconnect();
			console.log('✅ Database disconnected successfully');
		} catch (error) {
			console.error('❌ Database disconnection failed:', error);
			throw error;
		}
	},

	/**
	 * Check database health
	 */
	async healthCheck(): Promise<{ status: string; timestamp: string }> {
		try {
			await prisma.$queryRaw`SELECT 1`;
			return {
				status: 'healthy',
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				timestamp: new Date().toISOString()
			};
		}
	},

	/**
	 * Execute database transaction
	 */
	async transaction<T>(
		fn: (prisma: any) => Promise<T>,
		options?: {
			maxWait?: number;
			timeout?: number;
		}
	): Promise<T> {
		return prisma.$transaction(fn, {
			maxWait: options?.maxWait || 5000, // 5 seconds
			timeout: options?.timeout || 10000, // 10 seconds
		});
	},

	/**
	 * Get database metrics
	 */
	async getMetrics(): Promise<any> {
		try {
			// Metrics are not available in all Prisma versions
			// Return basic connection info instead
			return {
				status: 'connected',
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			console.warn('Database metrics not available:', error);
			return null;
		}
	}
};

/**
 * Graceful shutdown handler
 */
process.on('beforeExit', async () => {
	await database.disconnect();
});

process.on('SIGINT', async () => {
	await database.disconnect();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await database.disconnect();
	process.exit(0);
});