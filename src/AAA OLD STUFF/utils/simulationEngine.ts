/**
 * Simulation Engine
 *
 * Generalizes RoamingAnimationManager into a unified behavior system.
 * Handles roam, path, orbit, follow, and herd behaviors for any model.
 * Produces position/heading updates consumed by the Cesium render loop.
 */

import type {
  ModelData,
  Behavior,
  RoamBehavior,
  PathBehavior,
  OrbitBehavior,
  FollowBehavior,
  HerdBehavior,
  HerdMember,
  AreaBounds,
  LatLon,
} from '../types';
import { calculateDistance, getRandomPositionInArea, getRandomHeading } from './roamingUtils';

// ─── Output Types ────────────────────────────────────────────

export interface SimPosition {
  latitude: number;
  longitude: number;
  height: number;
  heading: number;
}

export interface HerdMemberPosition {
  memberId: string;
  localX: number;
  localY: number;
  localHeading: number;
}

export interface SimUpdate {
  modelId: string;
  position: SimPosition;
  herdMembers?: HerdMemberPosition[];
}

// ─── Internal State ──────────────────────────────────────────

interface SimEntity {
  id: string;
  modelData: ModelData;
  behavior: Behavior;
  state: BehaviorState;
}

type BehaviorState =
  | RoamState
  | PathState
  | OrbitState
  | FollowState
  | HerdState;

interface RoamState {
  type: 'roam';
  startPos: LatLon;
  targetPos: LatLon;
  startHeading: number;
  targetHeading: number;
  height: number;
  startTime: number;
  travelTime: number;
  currentPos: LatLon;
  currentHeading: number;
}

interface PathState {
  type: 'path';
  currentSegment: number;
  progressAlongSegment: number;
  segmentLength: number;
  height: number;
  currentPos: LatLon;
  currentHeading: number;
}

interface OrbitState {
  type: 'orbit';
  angle: number;
  height: number;
  currentPos: LatLon;
  currentHeading: number;
}

interface FollowState {
  type: 'follow';
  height: number;
  currentPos: LatLon;
  currentHeading: number;
}

interface HerdState {
  type: 'herd';
  canvasState: RoamState | PathState;
  height: number;
  currentPos: LatLon;
  currentHeading: number;
}

// ─── Engine ──────────────────────────────────────────────────

export class SimulationEngine {
  private entities: Map<string, SimEntity> = new Map();
  private _running = false;
  private _speed = 1.0;
  private _lastTime = 0;

  get running(): boolean { return this._running; }
  get speed(): number { return this._speed; }
  get entityCount(): number { return this.entities.size; }

  setSpeed(s: number): void { this._speed = Math.max(0, s); }

  start(): void {
    this._running = true;
    this._lastTime = performance.now();
  }

  pause(): void { this._running = false; }

  reset(): void {
    for (const entity of this.entities.values()) {
      entity.state = this.initState(entity.modelData, entity.behavior);
    }
    this._lastTime = performance.now();
  }

  addModel(modelData: ModelData): void {
    const behavior = resolveBehavior(modelData);
    if (!behavior) return;

    this.entities.set(modelData.id, {
      id: modelData.id,
      modelData,
      behavior,
      state: this.initState(modelData, behavior),
    });
  }

  updateModel(modelData: ModelData): void {
    const behavior = resolveBehavior(modelData);
    if (!behavior) {
      this.entities.delete(modelData.id);
      return;
    }

    const existing = this.entities.get(modelData.id);
    if (existing && existing.behavior.type === behavior.type) {
      existing.modelData = modelData;
      existing.behavior = behavior;
    } else {
      this.entities.set(modelData.id, {
        id: modelData.id,
        modelData,
        behavior,
        state: this.initState(modelData, behavior),
      });
    }
  }

  removeModel(modelId: string): void {
    this.entities.delete(modelId);
  }

  clearAll(): void {
    this.entities.clear();
  }

  /**
   * Advance all entities by one frame. Returns position updates
   * to be applied to Cesium entities by the caller.
   */
  tick(currentTime: number = performance.now()): SimUpdate[] {
    if (!this._running) return [];

    const rawDt = (currentTime - this._lastTime) / 1000;
    const dt = rawDt * this._speed;
    this._lastTime = currentTime;

    if (dt <= 0 || dt > 2) return [];

    const updates: SimUpdate[] = [];

    for (const entity of this.entities.values()) {
      const update = this.advanceEntity(entity, dt, currentTime);
      if (update) updates.push(update);
    }

    return updates;
  }

  getPosition(modelId: string): SimPosition | null {
    const e = this.entities.get(modelId);
    if (!e) return null;
    const s = e.state;
    return {
      latitude: s.currentPos.latitude,
      longitude: s.currentPos.longitude,
      height: s.height,
      heading: s.currentHeading,
    };
  }

  getEntity(modelId: string): SimEntity | undefined {
    return this.entities.get(modelId);
  }

  getAllEntities(): SimEntity[] {
    return Array.from(this.entities.values());
  }

  // ─── State Initialization ─────────────────────────────────

  private initState(model: ModelData, behavior: Behavior): BehaviorState {
    const pos: LatLon = { latitude: model.coordinates.latitude, longitude: model.coordinates.longitude };
    const h = model.transform.height;
    const heading = model.transform.heading;

    switch (behavior.type) {
      case 'roam':
        return this.initRoamState(pos, h, heading, behavior);
      case 'path':
        return this.initPathState(pos, h, behavior);
      case 'orbit':
        return { type: 'orbit', angle: 0, height: h, currentPos: { ...pos }, currentHeading: heading };
      case 'follow':
        return { type: 'follow', height: h, currentPos: { ...pos }, currentHeading: heading };
      case 'herd': {
        const canvasState = behavior.canvas.type === 'roam'
          ? this.initRoamState(pos, h, heading, behavior.canvas)
          : this.initPathState(pos, h, behavior.canvas);
        return { type: 'herd', canvasState, height: h, currentPos: { ...pos }, currentHeading: heading };
      }
    }
  }

  private initRoamState(pos: LatLon, height: number, heading: number, behavior: RoamBehavior): RoamState {
    const target = getRandomPositionInArea(behavior.area);
    const targetHeading = getRandomHeading();
    const dist = calculateDistance(pos.latitude, pos.longitude, target.latitude, target.longitude);
    const travelTime = dist / behavior.speed;

    return {
      type: 'roam',
      startPos: { ...pos },
      targetPos: target,
      startHeading: heading,
      targetHeading,
      height,
      startTime: performance.now(),
      travelTime: travelTime * 1000,
      currentPos: { ...pos },
      currentHeading: heading,
    };
  }

  private initPathState(pos: LatLon, height: number, behavior: PathBehavior): PathState {
    const wp = behavior.waypoints;
    const segLen = wp.length >= 2
      ? calculateDistance(wp[0].latitude, wp[0].longitude, wp[1].latitude, wp[1].longitude)
      : 0;
    const heading = wp.length >= 2
      ? bearingBetween(wp[0], wp[1])
      : 0;

    return {
      type: 'path',
      currentSegment: 0,
      progressAlongSegment: 0,
      segmentLength: segLen,
      height,
      currentPos: wp.length > 0 ? { ...wp[0] } : { ...pos },
      currentHeading: heading,
    };
  }

  // ─── Per-frame Advancement ─────────────────────────────────

  private advanceEntity(entity: SimEntity, dt: number, now: number): SimUpdate | null {
    switch (entity.state.type) {
      case 'roam':
        return this.advanceRoam(entity, entity.state, entity.behavior as RoamBehavior, now);
      case 'path':
        return this.advancePath(entity, entity.state, entity.behavior as PathBehavior, dt);
      case 'orbit':
        return this.advanceOrbit(entity, entity.state, entity.behavior as OrbitBehavior, dt);
      case 'follow':
        return this.advanceFollow(entity, entity.state, entity.behavior as FollowBehavior, dt);
      case 'herd':
        return this.advanceHerd(entity, entity.state, entity.behavior as HerdBehavior, dt, now);
    }
  }

  private advanceRoam(entity: SimEntity, state: RoamState, beh: RoamBehavior, now: number): SimUpdate {
    const elapsed = now - state.startTime;
    let progress = Math.min(elapsed / state.travelTime, 1);

    if (progress >= 1) {
      state.currentPos = { ...state.targetPos };
      state.currentHeading = state.targetHeading;
      const newTarget = getRandomPositionInArea(beh.area);
      const newHeading = getRandomHeading();
      const dist = calculateDistance(
        state.currentPos.latitude, state.currentPos.longitude,
        newTarget.latitude, newTarget.longitude,
      );
      state.startPos = { ...state.currentPos };
      state.targetPos = newTarget;
      state.startHeading = state.currentHeading;
      state.targetHeading = newHeading;
      state.startTime = now;
      state.travelTime = (dist / beh.speed) * 1000;
      progress = 0;
    }

    state.currentPos.latitude = lerp(state.startPos.latitude, state.targetPos.latitude, progress);
    state.currentPos.longitude = lerp(state.startPos.longitude, state.targetPos.longitude, progress);
    state.currentHeading = lerpAngle(state.startHeading, state.targetHeading, progress);

    return { modelId: entity.id, position: { ...state.currentPos, height: state.height, heading: state.currentHeading } };
  }

  private advancePath(entity: SimEntity, state: PathState, beh: PathBehavior, dt: number): SimUpdate | null {
    const wp = beh.waypoints;
    if (wp.length < 2) return null;

    if (state.segmentLength > 0) {
      state.progressAlongSegment += (beh.speed * dt) / state.segmentLength;
    }

    while (state.progressAlongSegment >= 1) {
      state.progressAlongSegment -= 1;
      state.currentSegment++;

      if (state.currentSegment >= wp.length - 1) {
        if (beh.loop) {
          state.currentSegment = 0;
        } else {
          state.currentSegment = wp.length - 2;
          state.progressAlongSegment = 1;
          break;
        }
      }

      const a = wp[state.currentSegment];
      const b = wp[state.currentSegment + 1];
      state.segmentLength = calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    }

    const a = wp[state.currentSegment];
    const b = wp[(state.currentSegment + 1) % wp.length];
    const t = state.progressAlongSegment;

    state.currentPos.latitude = lerp(a.latitude, b.latitude, t);
    state.currentPos.longitude = lerp(a.longitude, b.longitude, t);
    state.currentHeading = bearingBetween(a, b);

    return { modelId: entity.id, position: { ...state.currentPos, height: state.height, heading: state.currentHeading } };
  }

  private advanceOrbit(entity: SimEntity, state: OrbitState, beh: OrbitBehavior, dt: number): SimUpdate | null {
    const target = this.entities.get(beh.targetModelId);
    if (!target) return null;

    const angularSpeed = beh.speed / beh.radius;
    state.angle += angularSpeed * dt;
    if (state.angle > Math.PI * 2) state.angle -= Math.PI * 2;

    const center = target.state.currentPos;
    const offsetLat = (beh.radius * Math.cos(state.angle)) / 111320;
    const offsetLon = (beh.radius * Math.sin(state.angle)) / (111320 * Math.cos(center.latitude * Math.PI / 180));

    state.currentPos.latitude = center.latitude + offsetLat;
    state.currentPos.longitude = center.longitude + offsetLon;
    state.currentHeading = ((state.angle * 180 / Math.PI) + 90) % 360;

    return { modelId: entity.id, position: { ...state.currentPos, height: state.height, heading: state.currentHeading } };
  }

  private advanceFollow(entity: SimEntity, state: FollowState, beh: FollowBehavior, dt: number): SimUpdate | null {
    const target = this.entities.get(beh.targetModelId);
    if (!target) return null;

    const tPos = target.state.currentPos;
    const goalLat = tPos.latitude + beh.offset.y / 111320;
    const goalLon = tPos.longitude + beh.offset.x / (111320 * Math.cos(tPos.latitude * Math.PI / 180));

    const dist = calculateDistance(state.currentPos.latitude, state.currentPos.longitude, goalLat, goalLon);
    if (dist < 0.1) {
      state.currentPos = { latitude: goalLat, longitude: goalLon };
    } else {
      const step = Math.min(1, (beh.speed * dt) / dist);
      state.currentPos.latitude = lerp(state.currentPos.latitude, goalLat, step);
      state.currentPos.longitude = lerp(state.currentPos.longitude, goalLon, step);
    }

    state.currentHeading = bearingBetween(state.currentPos, tPos);

    return { modelId: entity.id, position: { ...state.currentPos, height: state.height, heading: state.currentHeading } };
  }

  private advanceHerd(entity: SimEntity, state: HerdState, beh: HerdBehavior, dt: number, now: number): SimUpdate {
    if (state.canvasState.type === 'roam') {
      this.advanceRoam(entity, state.canvasState, beh.canvas as RoamBehavior, now);
    } else {
      this.advancePath(entity, state.canvasState, beh.canvas as PathBehavior, dt);
    }

    state.currentPos = { ...state.canvasState.currentPos };
    state.currentHeading = state.canvasState.currentHeading;

    const members: HerdMemberPosition[] = beh.members.map(member => {
      const local = advanceLocalMotion(member, now);
      return {
        memberId: member.id,
        localX: local.x,
        localY: local.y,
        localHeading: Math.atan2(local.dx, local.dy) * 180 / Math.PI,
      };
    });

    return {
      modelId: entity.id,
      position: { ...state.currentPos, height: state.height, heading: state.currentHeading },
      herdMembers: members,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function resolveBehavior(model: ModelData): Behavior | null {
  return model.behavior ?? null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

function bearingBetween(from: LatLon, to: LatLon): number {
  const dLon = (to.longitude - from.longitude) * Math.PI / 180;
  const lat1 = from.latitude * Math.PI / 180;
  const lat2 = to.latitude * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function advanceLocalMotion(
  member: HerdMember,
  now: number,
): { x: number; y: number; dx: number; dy: number } {
  const motion = member.localMotion;
  if (motion.type === 'fixed') {
    return { x: member.localOffset.x, y: member.localOffset.y, dx: 0, dy: 1 };
  }

  const t = (now / 1000) * motion.speed + member.phaseOffset;

  switch (motion.type) {
    case 'circle': {
      const r = motion.radius;
      return {
        x: member.localOffset.x + r * Math.cos(t),
        y: member.localOffset.y + r * Math.sin(t),
        dx: -r * Math.sin(t),
        dy: r * Math.cos(t),
      };
    }
    case 'figure8': {
      const w = motion.width;
      return {
        x: member.localOffset.x + w * Math.sin(t),
        y: member.localOffset.y + w * Math.sin(t) * Math.cos(t),
        dx: w * Math.cos(t),
        dy: w * (Math.cos(t) * Math.cos(t) - Math.sin(t) * Math.sin(t)),
      };
    }
    case 'wander': {
      const r = motion.radius;
      return {
        x: member.localOffset.x + r * Math.sin(t * 0.7) * Math.cos(t * 0.3),
        y: member.localOffset.y + r * Math.cos(t * 0.5) * Math.sin(t * 0.4),
        dx: r * 0.7 * Math.cos(t * 0.7) * Math.cos(t * 0.3),
        dy: r * -0.5 * Math.sin(t * 0.5) * Math.sin(t * 0.4),
      };
    }
  }
}

export const simulationEngine = new SimulationEngine();
