import { getSharedNostr } from './nostrPool';
import { type NostrEvent, type NostrService } from './nostrService';
import { onlineGeohash5Cells, onlineNowCount, seen24hCount } from '../stores/presenceStore';
import { get } from 'svelte/store';
import { encode as geohashEncode } from '../utils/geohash';
import { currentGeohash, userLiveLocation } from '../store';
import { GEOHASH_PRECISION_LISTING } from '../gig/constants';
import { buildReplaceableFilter, runReliableSnapshot, type RelayStreamHandle } from './relayOrchestrator';
import { logger } from '../utils/logger';

const D_PRESENCE = 'presence';
const D_SEEN_24H = 'seen24h';

const ONLINE_WINDOW_SECS = 120;
const ONLINE_PING_INTERVAL_SECS = 60;
const ONLINE_PRUNE_INTERVAL_SECS = 15;

const SEEN_24H_WINDOW_SECS = 24 * 60 * 60;
const SEEN_24H_PUBLISH_INTERVAL_SECS = 6 * 60 * 60;
const SEEN_24H_SNAPSHOT_INTERVAL_SECS = 10 * 60;

type PresenceHandles = {
  stop: () => void;
};

let active: PresenceHandles | null = null;

function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

function getExpiration(event: NostrEvent): number | null {
  const tag = event.tags?.find((t) => t[0] === 'expiration');
  if (!tag?.[1]) return null;
  const n = parseInt(tag[1], 10);
  return Number.isFinite(n) ? n : null;
}

function publishPresence(nostr: NostrService, dTag: string, ttlSecs: number): void {
  let geohash5: string | null = null;
  const loc = get(userLiveLocation);
  if (loc) {
    geohash5 = geohashEncode(loc.latitude, loc.longitude, 5);
  } else {
    const g = get(currentGeohash);
    if (g && g.length >= 5) geohash5 = g.slice(0, 5);
  }

  const extraTags: string[][] = [['expiration', String(nowSecs() + ttlSecs)]];
  if (geohash5) extraTags.push(['g', geohash5]);
  nostr.publishReplaceable(dTag, extraTags, '');
}

function startOnlineNow(nostr: NostrService): { stop: () => void } {
  let stream: RelayStreamHandle | null = null;
  const lastByPubkey = new Map<string, { exp: number; g5: string | null }>(); // pubkey -> { expiration, geohash5 }

  const publishCellSet = () => {
    const cells = new Set<string>();
    for (const v of lastByPubkey.values()) {
      if (v.g5) cells.add(v.g5);
    }
    onlineGeohash5Cells.set(cells);
  };

  const filter = buildReplaceableFilter({
    dTags: [D_PRESENCE],
    since: nowSecs() - ONLINE_WINDOW_SECS,
  });

  const streamId = 'presence-online';
  nostr.subscribe(
    streamId,
    filter,
    (event: NostrEvent) => {
      if (!event.pubkey) return;
      const exp = getExpiration(event);
      // If no expiration tag, ignore (this metric depends on TTL)
      if (!exp) return;
      const gTag = event.tags?.find((t) => t[0] === 'g')?.[1] ?? null;
      const g5 = gTag && gTag.length >= 5 ? gTag.slice(0, 5) : null;
      lastByPubkey.set(event.pubkey, { exp, g5 });
      onlineNowCount.set(lastByPubkey.size);
      publishCellSet();
    },
  );
  stream = {
    id: streamId,
    update: (nextFilter: Record<string, unknown>) => nostr.updateSubscription(streamId, nextFilter),
    close: () => nostr.unsubscribe(streamId),
  };

  const pruneTimer = setInterval(() => {
    const now = nowSecs();
    let changed = false;
    for (const [pk, exp] of lastByPubkey.entries()) {
      if (exp.exp <= now) {
        lastByPubkey.delete(pk);
        changed = true;
      }
    }
    if (changed) {
      onlineNowCount.set(lastByPubkey.size);
      publishCellSet();
    }
  }, ONLINE_PRUNE_INTERVAL_SECS * 1000);

  const pingTimer = setInterval(() => {
    publishPresence(nostr, D_PRESENCE, ONLINE_WINDOW_SECS);
  }, ONLINE_PING_INTERVAL_SECS * 1000);

  // Publish immediately so a fresh client shows up without waiting.
  publishPresence(nostr, D_PRESENCE, ONLINE_WINDOW_SECS);

  return {
    stop: () => {
      clearInterval(pruneTimer);
      clearInterval(pingTimer);
      stream?.close();
      onlineNowCount.set(0);
      onlineGeohash5Cells.set(new Set());
    },
  };
}

async function runSeen24hSnapshot(nostr: NostrService): Promise<void> {
  const unique = new Set<string>();

  const filter = buildReplaceableFilter({
    dTags: [D_SEEN_24H],
    since: nowSecs() - SEEN_24H_WINDOW_SECS,
  });

  await runReliableSnapshot(nostr, {
    filter,
    subIdPrefix: 'presence-seen24h',
    minRelaysAfterSettle: 1,
    retries: 1,
    onMetrics: (meta) => {
      logger.info(
        `relay-metrics snapshot presence-seen24h status=${meta.status} connected=${meta.connectedAtStart} eose=${meta.eoseReceived} retries=${meta.retriesUsed} timedOut=${meta.timedOut}`,
        { component: 'presenceService', operation: 'runSeen24hSnapshot' },
      );
    },
    onEvent: (event: NostrEvent) => {
      if (event.pubkey) unique.add(event.pubkey);
    },
  });
  seen24hCount.set(unique.size);
}

function startSeen24h(nostr: NostrService): { stop: () => void } {
  // Lightweight “I was here in last 24h” beacon
  publishPresence(nostr, D_SEEN_24H, SEEN_24H_WINDOW_SECS);

  const publishTimer = setInterval(() => {
    publishPresence(nostr, D_SEEN_24H, SEEN_24H_WINDOW_SECS);
  }, SEEN_24H_PUBLISH_INTERVAL_SECS * 1000);

  // Reliable count without holding a 24h map: periodic EOSE snapshots.
  runSeen24hSnapshot(nostr).catch(() => {});
  const snapshotTimer = setInterval(() => {
    runSeen24hSnapshot(nostr).catch(() => {});
  }, SEEN_24H_SNAPSHOT_INTERVAL_SECS * 1000);

  return {
    stop: () => {
      clearInterval(publishTimer);
      clearInterval(snapshotTimer);
      seen24hCount.set(0);
    },
  };
}

export async function startPresence(): Promise<void> {
  if (active) return;
  const nostr = await getSharedNostr();
  const online = startOnlineNow(nostr);
  const seen = startSeen24h(nostr);

  active = {
    stop: () => {
      online.stop();
      seen.stop();
    },
  };
}

export function stopPresence(): void {
  active?.stop();
  active = null;
}

