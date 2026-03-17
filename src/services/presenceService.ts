import { getSharedNostr } from './nostrPool';
import { REPLACEABLE_KIND, RELAY_LABEL, type NostrEvent, type NostrService } from './nostrService';
import { onlineNowCount, seen24hCount } from '../stores/presenceStore';

const D_PRESENCE = 'presence';
const D_SEEN_24H = 'seen24h';

const ONLINE_WINDOW_SECS = 120;
const ONLINE_PING_INTERVAL_SECS = 60;
const ONLINE_PRUNE_INTERVAL_SECS = 15;

const SEEN_24H_WINDOW_SECS = 24 * 60 * 60;
const SEEN_24H_PUBLISH_INTERVAL_SECS = 6 * 60 * 60;
const SEEN_24H_SNAPSHOT_INTERVAL_SECS = 10 * 60;
const SNAPSHOT_EOSE_TIMEOUT_MS = 6000;

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
  nostr.publishReplaceable(
    dTag,
    [['expiration', String(nowSecs() + ttlSecs)]],
    '',
  );
}

function startOnlineNow(nostr: NostrService): { stop: () => void } {
  const subId = 'presence-online';
  const lastByPubkey = new Map<string, number>(); // pubkey -> expiration

  const filter = {
    kinds: [REPLACEABLE_KIND],
    '#L': [RELAY_LABEL],
    '#d': [D_PRESENCE],
    since: nowSecs() - ONLINE_WINDOW_SECS,
  };

  nostr.subscribe(subId, filter, (event: NostrEvent) => {
    if (!event.pubkey) return;
    const exp = getExpiration(event);
    // If no expiration tag, ignore (this metric depends on TTL)
    if (!exp) return;
    lastByPubkey.set(event.pubkey, exp);
    onlineNowCount.set(lastByPubkey.size);
  });

  const pruneTimer = setInterval(() => {
    const now = nowSecs();
    let changed = false;
    for (const [pk, exp] of lastByPubkey.entries()) {
      if (exp <= now) {
        lastByPubkey.delete(pk);
        changed = true;
      }
    }
    if (changed) onlineNowCount.set(lastByPubkey.size);
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
      nostr.unsubscribe(subId);
      onlineNowCount.set(0);
    },
  };
}

async function runSeen24hSnapshot(nostr: NostrService): Promise<void> {
  const subId = `presence-seen24h-${Date.now()}`;
  const unique = new Set<string>();
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    nostr.unsubscribe(subId);
    seen24hCount.set(unique.size);
  };

  const filter = {
    kinds: [REPLACEABLE_KIND],
    '#L': [RELAY_LABEL],
    '#d': [D_SEEN_24H],
    since: nowSecs() - SEEN_24H_WINDOW_SECS,
  };

  nostr.subscribe(
    subId,
    filter,
    (event: NostrEvent) => {
      if (event.pubkey) unique.add(event.pubkey);
    },
    finish,
  );

  setTimeout(finish, SNAPSHOT_EOSE_TIMEOUT_MS);
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

