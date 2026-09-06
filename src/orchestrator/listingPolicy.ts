/**
 * listingPolicy.ts — Orchestrator-owned domain knowledge: which operating
 * mode (LIVE or LISTING) each model uses, and — for LISTING models — their
 * publication-lead-time / expiration policy (see orchestrator-prompt.md
 * §3.1). This is exactly the "Zuordnungstabelle" the orchestrator spec
 * requires: nothing here is known by the UI (hexmenu/domains.ts) or by
 * the generic Nostr infrastructure (nostr.ts) — it lives only here.
 *
 * Kept in its own file (rather than inline in Orchestrator.svelte) for the
 * same one-responsibility-per-file reason domains.ts is its own file:
 * this is data/config, not control flow.
 */

export type OperatingMode = 'LIVE' | 'LISTING';

export interface LiveModelPolicy {
  mode: 'LIVE';
}

export interface ListingModelPolicy {
  mode: 'LISTING';
  /**
   * Maximum publication lead time in days (see orchestrator-prompt.md
   * §3.1). For models with a `referenceField`, this bounds how far in
   * advance of the reference timestamp a listing may be published. For
   * models without one, this is also the fallback listing lifetime
   * (publish time + this many days).
   */
  maxLeadDays: number;
  /**
   * Name of the field in the payload's parsed detail content (see
   * hexmenu/domains.ts DetailsConfig) that carries this model's natural
   * future reference timestamp (departure, event, project date/time),
   * if it has one. When present and populated, expiration = that
   * timestamp itself (never reference time minus lead time — lead time
   * is only a publish-time gate, see §3.1). When the model has no such
   * field, or the field is present in the schema but the value is
   * absent for this particular listing, expiration falls back to
   * publish time + maxLeadDays.
   */
  referenceField?: string;
}

export type ModelPolicy = LiveModelPolicy | ListingModelPolicy;

/**
 * One entry per model id from hexmenu/domains.ts. Reconstructed from
 * orchestrator-prompt.md §3.1's reference table, mapped onto the actual
 * model ids currently defined in domains.ts.
 *
 * Two known gaps worth flagging (not silently resolved here):
 *  - `food_rescue` has no `date` field in its current domains.ts
 *    DetailsConfig, even though its spec row calls for "actual
 *    expiry date, if present" — it always falls back to publish+1day
 *    until such a field is added.
 *  - `social_time`'s spec row gives a 7–14 day range rather than a
 *    single number; 14 (the permissive/safe end, also the absolute
 *    ceiling) is used here — adjust if a narrower default is wanted.
 */
export const MODEL_POLICIES: Record<string, ModelPolicy> = {
  // move
  vehicle_exchange: { mode: 'LISTING', maxLeadDays: 14 },
  p2p_vehicle_rental: { mode: 'LISTING', maxLeadDays: 14 },
  route_sharing: { mode: 'LISTING', maxLeadDays: 3, referenceField: 'date' },
  ridehailing: { mode: 'LIVE' },

  // goods
  goods_sharing: { mode: 'LISTING', maxLeadDays: 14 },

  // food
  food_production: { mode: 'LISTING', maxLeadDays: 3 },
  meal_sharing: { mode: 'LISTING', maxLeadDays: 3 },
  food_exchange: { mode: 'LISTING', maxLeadDays: 3 },
  food_rescue: { mode: 'LISTING', maxLeadDays: 1 },

  // skills
  freelance_work: { mode: 'LISTING', maxLeadDays: 14 },
  production: { mode: 'LISTING', maxLeadDays: 14 },
  skill_pooling: { mode: 'LISTING', maxLeadDays: 14 },
  helpout: { mode: 'LISTING', maxLeadDays: 14 },

  // stay
  stay_exchange: { mode: 'LISTING', maxLeadDays: 14 },
  stay_pooling: { mode: 'LISTING', maxLeadDays: 14 },

  // social
  social_activity_sharing: { mode: 'LISTING', maxLeadDays: 7, referenceField: 'date' },

  // social_time
  social_time: { mode: 'LISTING', maxLeadDays: 14, referenceField: 'date' },
};

/** Absolute ceiling on listing validity, regardless of model (orchestrator-prompt.md §3.1). */
export const ABSOLUTE_MAX_VALIDITY_DAYS = 14;

export function getModelPolicy(model: string): ModelPolicy | undefined {
  return MODEL_POLICIES[model];
}
