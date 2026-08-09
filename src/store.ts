/**
 * store.ts — Generic runtime state infrastructure.
 *
 * This module is a small, framework-agnostic reactive container for a
 * single value of arbitrary type `T`. It has no knowledge of any
 * particular application: no domain models, no persistence, no network
 * concerns, and no UI framework dependency.
 *
 * Architectural boundary
 * -----------------------
 * This file MUST stay independent of:
 *   - persistence (e.g. idb.ts / IndexedDB)
 *   - network/protocol layers (e.g. nostr.ts)
 *   - any UI framework (Svelte, React, etc.)
 *   - domain-specific state shapes or business logic
 *
 * Higher-level orchestration code (e.g. an app's root component) is
 * responsible for deciding what `T` represents, when to persist it,
 * and when to update it in response to external events. This module
 * only provides the mechanism for holding a value and notifying
 * interested parties when it changes.
 *
 * Design notes
 * ------------
 * - `set`/`update` replace the stored reference rather than mutating
 *   or inspecting it. No deep cloning, freezing, diffing, or
 *   serialization is performed — the caller owns the shape of `T`.
 * - Notification is synchronous: subscribers are called immediately
 *   after a successful change, in the order they subscribed.
 * - A subscriber is called once immediately upon subscribing, with
 *   the current value, similar to common store conventions. This
 *   keeps consumers from needing a separate `get()` call just to
 *   read the initial state.
 * - `set()` is a no-op (no notification) when the new value is
 *   `Object.is`-equal to the current value, avoiding redundant
 *   notifications for identical primitives/references without
 *   attempting any deeper equality check.
 * - Errors thrown by one subscriber are isolated so they cannot
 *   prevent other subscribers from being notified, and cannot leave
 *   the store's internal bookkeeping in a broken state.
 * - Unsubscribing (including unsubscribing from within a
 *   notification callback) is safe at any time.
 */

/** A function invoked with the current value whenever the store changes. */
export type Subscriber<T> = (value: T) => void;

/** Call to stop receiving notifications from a store. Safe to call multiple times. */
export type Unsubscribe = () => void;

/**
 * Minimal generic store interface. Higher-level code can depend on this
 * shape instead of the concrete `createStore` implementation, making it
 * easy to substitute a different implementation later without changing
 * consumers.
 */
export interface Store<T> {
  /** Returns the current value synchronously. */
  get(): T;

  /** Replaces the current value. No-op if `value` is `Object.is`-equal to the current value. */
  set(value: T): void;

  /** Computes and stores a new value from the previous one, e.g. `update(n => n + 1)`. */
  update(updater: (current: T) => T): void;

  /**
   * Subscribes to value changes. The subscriber is invoked immediately
   * with the current value, and again on every subsequent change.
   * Returns a function that removes the subscription.
   */
  subscribe(subscriber: Subscriber<T>): Unsubscribe;

  /** Resets the value back to the initial value the store was created with. */
  reset(): void;
}

/**
 * Creates a new generic, strongly typed reactive store.
 *
 * @param initialValue The value the store starts with, and the value
 *   restored by `reset()`.
 */
export function createStore<T>(initialValue: T): Store<T> {
  let currentValue: T = initialValue;

  // Ordered set of active subscribers. A Set preserves insertion order
  // in JavaScript, which gives us deterministic notification order
  // while still allowing O(1) add/remove for cleanup.
  const subscribers = new Set<Subscriber<T>>();

  function notify(): void {
    // Snapshot subscribers before iterating so that subscribers added
    // or removed *during* notification (e.g. a subscriber that
    // unsubscribes itself, or another one) don't corrupt iteration or
    // cause skipped/duplicate calls within this notification round.
    const toNotify = Array.from(subscribers);

    for (const subscriber of toNotify) {
      // A subscriber may have unsubscribed itself during this same
      // notification round (e.g. from an earlier callback); skip it.
      if (!subscribers.has(subscriber)) continue;

      try {
        subscriber(currentValue);
      } catch (error) {
        // Isolate subscriber errors: one misbehaving subscriber must
        // not stop others from being notified, and must not corrupt
        // the store's internal state. Surface the error asynchronously
        // so it isn't silently swallowed.
        reportSubscriberError(error);
      }
    }
  }

  function get(): T {
    return currentValue;
  }

  function set(value: T): void {
    // Avoid redundant notifications for identical values. `Object.is`
    // is used (rather than `===`) so that e.g. NaN is treated as equal
    // to NaN, matching intuitive "did the value actually change?"
    // semantics without attempting any deep/structural comparison.
    if (Object.is(currentValue, value)) return;

    currentValue = value;
    notify();
  }

  function update(updater: (current: T) => T): void {
    set(updater(currentValue));
  }

  function subscribe(subscriber: Subscriber<T>): Unsubscribe {
    subscribers.add(subscriber);

    // Emit the current value immediately so subscribers don't need a
    // separate get() call to obtain the initial state.
    try {
      subscriber(currentValue);
    } catch (error) {
      reportSubscriberError(error);
    }

    let active = true;
    return () => {
      if (!active) return; // Safe to call more than once.
      active = false;
      subscribers.delete(subscriber);
    };
  }

  function reset(): void {
    set(initialValue);
  }

  return { get, set, update, subscribe, reset };
}

/**
 * Reports an error thrown by a subscriber without letting it propagate
 * into the store's own call stack. Deferred via a microtask/macrotask
 * so it surfaces (e.g. as an unhandled exception in dev tools / Node)
 * instead of being silently discarded, while still not disrupting the
 * synchronous notification loop.
 */
function reportSubscriberError(error: unknown): void {
  setTimeout(() => {
    throw error;
  }, 0);
}