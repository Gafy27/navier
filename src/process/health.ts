import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { ReadinessProbe } from '../db/index.ts';

export interface HealthServer {
  readonly listen: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/** PD8: the worker's tool list, served to the holder of `token` only. */
export interface HealthTools {
  readonly token: string;
  readonly entries: () => unknown;
}

export interface HealthSource {
  readonly host: string;
  readonly port: number;
  readonly probeTimeoutMs: number;
  readonly isReady: () => boolean;
  readonly probes: () => readonly ReadinessProbe[];
  readonly tools?: HealthTools | undefined;
}

/** True only when `header` is exactly `Bearer <token>`. A length mismatch is a no. */
function bearerMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Asks one probe under its own timeout. A throw, a no, or silence answers no. */
async function ask(probe: ReadinessProbe, timeoutMs: number): Promise<boolean> {
  const signal = AbortSignal.timeout(timeoutMs);
  const aborted = new Promise<false>((resolve) => {
    signal.addEventListener(
      'abort',
      () => {
        resolve(false);
      },
      { once: true },
    );
  });
  try {
    return await Promise.race([probe.check(signal), aborted]);
  } catch {
    return false;
  }
}

/** Serves `/healthz` and `/readyz`. Bodies hold booleans only. */
export function createHealthServer(source: HealthSource): HealthServer {
  const server = createServer((req, res) => {
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD');
      send(405, {});
      return;
    }
    const path = (req.url ?? '').split('?')[0];
    if (path === '/healthz') {
      send(200, {});
    } else if (path === '/readyz') {
      const ready = source.isReady();
      const probes = ready ? source.probes() : [];
      void Promise.all(probes.map((p) => ask(p, source.probeTimeoutMs))).then(
        (answers) => {
          const byName = Object.fromEntries(
            probes.map((p, i) => [p.name, answers[i] === true]),
          );
          const up = answers.every(Boolean);
          send(ready && up ? 200 : 503, { ready: ready && up, probes: byName });
        },
      );
    } else if (path === '/tools' && source.tools !== undefined) {
      const { token, entries } = source.tools;
      if (bearerMatches(req.headers.authorization, token)) {
        send(200, entries());
      } else {
        send(401, {});
      }
    } else {
      send(404, {});
    }
  });

  return {
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(source.port, source.host, () => {
          server.off('error', reject);
          resolve();
        });
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}
