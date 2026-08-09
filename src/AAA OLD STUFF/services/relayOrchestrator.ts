import { REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent, type NostrService } from './nostrService';

export type RelaySyncStatus = 'synced' | 'partial' | 'failed';
export type RelayPublishOutcome = 'verified_synced' | 'verified_partial' | 'verify_pending' | 'failed';

export interface RelayMeta {
  connectedAtStart: number;
  eoseReceived: number;
  retriesUsed: number;
  timedOut: boolean;
}

export interface RelaySnapshotResult {
  status: RelaySyncStatus;
  events: NostrEvent[];
  meta: RelayMeta;
}

export interface RelayStreamHandle {
  id: string;
  update: (filter: Record<string, unknown>) => void;
  close: () => void;
}

interface WaitReadyOptions {
  expectedRelays?: number;
  settleQuietMs?: number;
  minRelaysAfterSettle?: number;
  timeoutMs?: number;
  pollMs?: number;
}

interface SnapshotOptions {
  filter: Record<string, unknown>;
  subIdPrefix: string;
  expectedRelays?: number;
  settleQuietMs?: number;
  minRelaysAfterSettle?: number;
  timeoutMs?: number;
  retries?: number;
  retryBackoffMs?: number;
  onEvent?: (event: NostrEvent) => void;
  onMetrics?: (meta: RelayMeta & { status: RelaySyncStatus }) => void;
}

interface PublishWithVerifyOptions {
  dTag: string;
  extraTags: string[][];
  content: string;
  verifyFilter: Record<string, unknown>;
  expectedRelays?: number;
  settleQuietMs?: number;
  minRelaysAfterSettle?: number;
  timeoutMs?: number;
  retries?: number;
  retryBackoffMs?: number;
  onMetrics?: (meta: RelayMeta & { status: RelaySyncStatus; verified: boolean; outcome: RelayPublishOutcome }) => void;
}

interface ReplaceableFilterOptions {
  authors?: string[];
  dTags?: string[];
  tTags?: string[];
  gTags?: string[];
  cTags?: string[];
  pTags?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

export const RELAY_POLICY = {
  expectedRelays: 7,
  settleQuietMs: 3000,
  minRelaysAfterSettle: 1,
  readyTimeoutMs: 20000,
  snapshotTimeoutMs: 20000,
  retries: 2,
  retryBackoffMs: 500,
  verifyLookbackSecs: 10,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitReady(
  nostr: NostrService,
  options: WaitReadyOptions = {},
): Promise<{ ok: boolean; connected: number; relayUrls: string[] }> {
  const expectedRelays = options.expectedRelays ?? RELAY_POLICY.expectedRelays;
  const settleQuietMs = options.settleQuietMs ?? RELAY_POLICY.settleQuietMs;
  const minRelaysAfterSettle = options.minRelaysAfterSettle ?? RELAY_POLICY.minRelaysAfterSettle;
  const timeoutMs = options.timeoutMs ?? RELAY_POLICY.readyTimeoutMs;
  const pollMs = options.pollMs ?? 100;
  const startedAt = Date.now();

  let lastCount = nostr.getConnectedRelayCount();
  let lastIncreaseAt = lastCount > 0 ? Date.now() : 0;

  while (Date.now() - startedAt < timeoutMs) {
    const connected = nostr.getConnectedRelayCount();
    if (connected > lastCount) lastIncreaseAt = Date.now();
    lastCount = connected;

    if (connected >= expectedRelays) {
      const relayUrls = nostr.getConnectedRelayUrls();
      return { ok: relayUrls.length >= minRelaysAfterSettle, connected: relayUrls.length, relayUrls };
    }

    if (lastIncreaseAt > 0 && Date.now() - lastIncreaseAt >= settleQuietMs) {
      const relayUrls = nostr.getConnectedRelayUrls();
      return { ok: relayUrls.length >= minRelaysAfterSettle, connected: relayUrls.length, relayUrls };
    }

    await sleep(pollMs);
  }

  const relayUrls = nostr.getConnectedRelayUrls();
  return { ok: relayUrls.length >= minRelaysAfterSettle, connected: relayUrls.length, relayUrls };
}

async function runSingleSnapshot(
  nostr: NostrService,
  filter: Record<string, unknown>,
  subIdPrefix: string,
  connectedRelayUrls: string[],
  timeoutMs: number,
  onEvent?: (event: NostrEvent) => void,
): Promise<RelaySnapshotResult> {
  const events: NostrEvent[] = [];
  const expected = new Set(connectedRelayUrls);
  const seenEose = new Set<string>();
  const subId = `${subIdPrefix}-${Date.now()}`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      nostr.unsubscribe(subId);

      if (expected.size === 0) {
        resolve({
          status: 'failed',
          events,
          meta: { connectedAtStart: 0, eoseReceived: 0, retriesUsed: 0, timedOut },
        });
        return;
      }

      const allEose = seenEose.size >= expected.size;
      const hasSomeEose = seenEose.size > 0;
      const status: RelaySyncStatus = allEose ? 'synced' : hasSomeEose ? 'partial' : 'failed';
      resolve({
        status,
        events,
        meta: {
          connectedAtStart: expected.size,
          eoseReceived: seenEose.size,
          retriesUsed: 0,
          timedOut,
        },
      });
    };

    const timeout = setTimeout(() => finish(true), timeoutMs);

    nostr.subscribe(
      subId,
      filter,
      (event: NostrEvent) => {
        events.push(event);
        onEvent?.(event);
      },
      () => {},
      (relayUrl: string) => {
        if (expected.has(relayUrl)) seenEose.add(relayUrl);
        if (seenEose.size >= expected.size) {
          clearTimeout(timeout);
          finish(false);
        }
      },
    );
  });
}

export async function runReliableSnapshot(
  nostr: NostrService,
  options: SnapshotOptions,
): Promise<RelaySnapshotResult> {
  const timeoutMs = options.timeoutMs ?? RELAY_POLICY.snapshotTimeoutMs;
  const retries = options.retries ?? RELAY_POLICY.retries;
  const retryBackoffMs = options.retryBackoffMs ?? RELAY_POLICY.retryBackoffMs;

  let last: RelaySnapshotResult | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ready = await waitReady(nostr, {
      expectedRelays: options.expectedRelays,
      settleQuietMs: options.settleQuietMs,
      minRelaysAfterSettle: options.minRelaysAfterSettle,
    });

    if (!ready.ok || ready.relayUrls.length === 0) {
      last = {
        status: 'failed',
        events: [],
        meta: {
          connectedAtStart: ready.connected,
          eoseReceived: 0,
          retriesUsed: attempt,
          timedOut: true,
        },
      };
    } else {
      const result = await runSingleSnapshot(
        nostr,
        options.filter,
        options.subIdPrefix,
        ready.relayUrls,
        timeoutMs,
        options.onEvent,
      );
      result.meta.retriesUsed = attempt;
      last = result;
      options.onMetrics?.({ ...result.meta, status: result.status });
      if (result.status !== 'failed') return result;
    }

    if (attempt < retries) await sleep(retryBackoffMs * (attempt + 1));
  }

  const fallback = last ?? {
    status: 'failed' as const,
    events: [],
    meta: { connectedAtStart: 0, eoseReceived: 0, retriesUsed: retries, timedOut: true },
  };
  options.onMetrics?.({ ...fallback.meta, status: fallback.status });
  return fallback;
}

export async function publishWithVerify(
  nostr: NostrService,
  options: PublishWithVerifyOptions,
): Promise<{ status: RelaySyncStatus; meta: RelayMeta; eventId: string; verified: boolean; outcome: RelayPublishOutcome }> {
  const eventId = nostr.publishReplaceable(options.dTag, options.extraTags, options.content);
  let verified = false;
  const snapshot = await runReliableSnapshot(nostr, {
    filter: options.verifyFilter,
    subIdPrefix: `verify-${options.dTag}`,
    expectedRelays: options.expectedRelays,
    settleQuietMs: options.settleQuietMs,
    minRelaysAfterSettle: options.minRelaysAfterSettle,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    retryBackoffMs: options.retryBackoffMs,
    onEvent: (event) => {
      if (event.id === eventId) verified = true;
    },
  });

  const status: RelaySyncStatus = verified
    ? snapshot.status
    : snapshot.status === 'synced'
      ? 'partial'
      : 'failed';

  const outcome: RelayPublishOutcome = verified
    ? (status === 'synced' ? 'verified_synced' : 'verified_partial')
    : (status === 'failed' ? 'failed' : 'verify_pending');

  options.onMetrics?.({ ...snapshot.meta, status, verified, outcome });
  return { status, meta: snapshot.meta, eventId, verified, outcome };
}

export function buildReplaceableFilter(opts: ReplaceableFilterOptions): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    kinds: [REPLACEABLE_KIND],
    '#L': [RELAY_LABEL],
  };
  if (opts.authors?.length) filter.authors = opts.authors;
  if (opts.dTags?.length) filter['#d'] = opts.dTags;
  if (opts.tTags?.length) filter['#t'] = opts.tTags;
  if (opts.gTags?.length) filter['#g'] = opts.gTags;
  if (opts.cTags?.length) filter['#c'] = opts.cTags;
  if (opts.pTags?.length) filter['#p'] = opts.pTags;
  if (opts.since != null) filter.since = opts.since;
  if (opts.until != null) filter.until = opts.until;
  if (opts.limit != null) filter.limit = opts.limit;
  return filter;
}

export async function publishVerifiedReplaceable(
  nostr: NostrService,
  options: {
    dTag: string;
    extraTags: string[][];
    content: string;
    verifyTTags?: string[];
    verifySince?: number;
    expectedRelays?: number;
    settleQuietMs?: number;
    minRelaysAfterSettle?: number;
    timeoutMs?: number;
    retries?: number;
    onMetrics?: (meta: RelayMeta & { status: RelaySyncStatus; verified: boolean; outcome: RelayPublishOutcome }) => void;
  },
): Promise<{ status: RelaySyncStatus; meta: RelayMeta; eventId: string; verified: boolean; outcome: RelayPublishOutcome }> {
  const since = options.verifySince ?? (Math.floor(Date.now() / 1000) - RELAY_POLICY.verifyLookbackSecs);
  return publishWithVerify(nostr, {
    dTag: options.dTag,
    extraTags: options.extraTags,
    content: options.content,
    verifyFilter: buildReplaceableFilter({
      authors: [nostr.pubkey],
      dTags: [options.dTag],
      tTags: options.verifyTTags,
      since,
    }),
    expectedRelays: options.expectedRelays,
    settleQuietMs: options.settleQuietMs,
    minRelaysAfterSettle: options.minRelaysAfterSettle,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    onMetrics: options.onMetrics,
  });
}
