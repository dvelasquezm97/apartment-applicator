import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createChildLogger } from '../lib/logger.js';
import type {
  ExtensionEvent,
  ExtensionCommand,
  DashboardUpdate,
} from '../orchestrator/types.js';
import { getApplyLoopStatus } from './apply.js';

const log = createChildLogger('api:ws');

/**
 * Minimal WebSocket type matching the subset of the ws.WebSocket API
 * we actually use. Avoids hard dependency on @fastify/websocket types
 * at compile time (the package must still be installed at runtime).
 */
interface WSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'message', cb: (data: Buffer | string) => void): void;
  on(event: 'close', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
}

// --- Connection storage ---

interface ExtensionConnection {
  socket: WSocket;
  userId: string;
  connectedAt: Date;
}

interface DashboardConnection {
  socket: WSocket;
  userId: string;
  connectedAt: Date;
}

const extensionConnections = new Map<string, ExtensionConnection>();
const dashboardConnections = new Map<string, Set<DashboardConnection>>();

/** Event listeners waiting for specific extension events (used by apply-loop). */
type ExtensionEventListener = (event: ExtensionEvent) => void;
const extensionEventListeners = new Map<string, Set<ExtensionEventListener>>();

// --- Exported helpers ---

/** Send a command to the Chrome extension for a specific user. */
export function sendToExtension(userId: string, command: ExtensionCommand): boolean {
  const conn = extensionConnections.get(userId);
  if (!conn || conn.socket.readyState !== 1) {
    log.warn({ userId, command: command.type }, 'No active extension connection');
    return false;
  }
  conn.socket.send(JSON.stringify(command));
  log.debug({ userId, command: command.type }, 'Sent command to extension');
  return true;
}

/** Broadcast a dashboard update to all dashboard connections for a user. */
export function broadcastToDashboard(userId: string, update: DashboardUpdate): void {
  const connections = dashboardConnections.get(userId);
  if (!connections || connections.size === 0) return;

  const payload = JSON.stringify(update);
  for (const conn of connections) {
    if (conn.socket.readyState === 1) {
      conn.socket.send(payload);
    }
  }
  log.debug({ userId, type: update.type, dashboardCount: connections.size }, 'Broadcast to dashboard');
}

/** Check whether an extension is connected for a user. */
export function isExtensionConnected(userId: string): boolean {
  const conn = extensionConnections.get(userId);
  return conn !== undefined && conn.socket.readyState === 1;
}

/**
 * Wait for a specific extension event type from a user.
 * Returns a promise that resolves with the event, or rejects on timeout.
 */
export function waitForExtensionEvent<T extends ExtensionEvent>(
  userId: string,
  eventType: T['type'],
  timeoutMs: number = 30_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for extension event '${eventType}' (${timeoutMs}ms)`));
    }, timeoutMs);

    const listener: ExtensionEventListener = (event: ExtensionEvent) => {
      if (event.type === eventType) {
        cleanup();
        resolve(event as T);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      const listeners = extensionEventListeners.get(userId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) extensionEventListeners.delete(userId);
      }
    };

    let listeners = extensionEventListeners.get(userId);
    if (!listeners) {
      listeners = new Set();
      extensionEventListeners.set(userId, listeners);
    }
    listeners.add(listener);
  });
}

// --- Internal helpers ---

function notifyExtensionEventListeners(userId: string, event: ExtensionEvent): void {
  const listeners = extensionEventListeners.get(userId);
  if (!listeners) return;
  // Copy the set since listeners may remove themselves during iteration
  for (const listener of [...listeners]) {
    listener(event);
  }
}

function removeExtensionConnection(userId: string): void {
  extensionConnections.delete(userId);
  log.info({ userId }, 'Extension disconnected');

  // Notify dashboard clients
  broadcastToDashboard(userId, {
    type: 'progress',
    status: 'idle',
    applied: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    currentListing: null,
  });

  // Reject any pending event listeners
  const listeners = extensionEventListeners.get(userId);
  if (listeners) {
    for (const listener of [...listeners]) {
      listener({ type: 'error', message: 'Extension disconnected' });
    }
  }
}

function removeDashboardConnection(userId: string, conn: DashboardConnection): void {
  const connections = dashboardConnections.get(userId);
  if (connections) {
    connections.delete(conn);
    if (connections.size === 0) dashboardConnections.delete(userId);
  }
  log.debug({ userId }, 'Dashboard client disconnected');
}

/**
 * Extract userId from query token.
 * Phase 3 will replace this with real JWT verification.
 * For now, accept any token and use it as userId, or fall back to dev userId.
 */
function extractUserId(token: string | undefined): string {
  if (token && token.length > 0) {
    return token;
  }
  return '00000000-0000-0000-0000-000000000001';
}

// --- Fastify plugin ---

export async function registerWebSocketPlugin(server: FastifyInstance): Promise<void> {
  // @fastify/websocket must be installed at runtime: npm i @fastify/websocket
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const websocketPlugin = await import('@fastify/websocket' as string);
  await server.register(websocketPlugin.default ?? websocketPlugin);

  // The websocket option changes the handler signature: (socket, request) instead of (request, reply).
  // We cast to `any` because @fastify/websocket augments Fastify's types at install time.
  (server as any).get('/ws', { websocket: true }, (socket: WSocket, request: FastifyRequest) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const role = url.searchParams.get('role');
    const queryUserId = url.searchParams.get('userId') ?? undefined;
    const token = url.searchParams.get('token') ?? undefined;
    const userId = queryUserId || extractUserId(token);

    if (role === 'extension') {
      handleExtensionConnection(socket, userId);
    } else if (role === 'dashboard') {
      handleDashboardConnection(socket, userId);
    } else {
      log.warn({ role }, 'Unknown WebSocket role, closing connection');
      socket.send(JSON.stringify({ error: 'Invalid role. Use ?role=extension or ?role=dashboard' }));
      socket.close(4000, 'Invalid role');
    }
  });

  log.info('WebSocket plugin registered on /ws');
}

function handleExtensionConnection(socket: WSocket, userId: string): void {
  // Close any existing extension connection for this user
  const existing = extensionConnections.get(userId);
  if (existing && existing.socket.readyState === 1) {
    log.warn({ userId }, 'Replacing existing extension connection');
    existing.socket.close(4001, 'Replaced by new connection');
  }

  const conn: ExtensionConnection = { socket, userId, connectedAt: new Date() };
  extensionConnections.set(userId, conn);
  log.info({ userId }, 'Extension connected');

  socket.on('message', (raw: Buffer | string) => {
    try {
      const data = typeof raw === 'string' ? raw : raw.toString('utf-8');
      const event: ExtensionEvent = JSON.parse(data);

      // Keepalive ping — respond with pong, don't forward to listeners
      if (event.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      log.debug({ userId, type: event.type }, 'Extension event received');
      notifyExtensionEventListeners(userId, event);
    } catch (err) {
      log.error({ userId, error: (err as Error).message }, 'Failed to parse extension message');
    }
  });

  socket.on('close', () => {
    removeExtensionConnection(userId);
  });

  socket.on('error', (err: Error) => {
    log.error({ userId, error: err.message }, 'Extension socket error');
    removeExtensionConnection(userId);
  });
}

function handleDashboardConnection(socket: WSocket, userId: string): void {
  const conn: DashboardConnection = { socket, userId, connectedAt: new Date() };

  let connections = dashboardConnections.get(userId);
  if (!connections) {
    connections = new Set();
    dashboardConnections.set(userId, connections);
  }
  connections.add(conn);

  log.info({ userId, dashboardCount: connections.size }, 'Dashboard client connected');

  // Send real loop status if one is running, otherwise idle
  const loopStatus = getApplyLoopStatus(userId);
  const initialStatus: DashboardUpdate = loopStatus
    ? { type: 'progress', ...loopStatus } as DashboardUpdate
    : {
        type: 'progress',
        status: 'idle',
        applied: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        currentListing: null,
      };
  socket.send(JSON.stringify(initialStatus));

  socket.on('close', () => {
    removeDashboardConnection(userId, conn);
  });

  socket.on('error', (err: Error) => {
    log.error({ userId, error: err.message }, 'Dashboard socket error');
    removeDashboardConnection(userId, conn);
  });
}
