/**
 * Roaming Animation Manager
 * Handles continuous model movement and animation within defined areas
 */

import type { ModelData } from '../types';
import { 
  getRandomPositionInArea, 
  calculateDistance, 
  calculateTravelTime, 
  getRandomHeading,
  shouldStartRoaming,
  type RoamingAreaBounds 
} from './roamingUtils';

export interface RoamingModel {
  id: string;
  modelData: ModelData;
  currentPosition: { latitude: number; longitude: number; height: number };
  targetPosition: { latitude: number; longitude: number; height: number };
  startPosition: { latitude: number; longitude: number; height: number }; // Initial position when movement started
  currentHeading: number;
  targetHeading: number;
  startHeading: number; // Initial heading when movement started
  speed: number; // m/s
  isMoving: boolean;
  startTime: number;
  travelTime: number;
  animationId?: number;
}

export class RoamingAnimationManager {
  private roamingModels: Map<string, RoamingModel> = new Map();
  private animationFrameId: number | null = null;
  private isRunning = false;
  private lastUpdateTime = 0;
  private updateInterval = 100; // Update every 100ms for smooth animation

  constructor() {
    this.startAnimationLoop();
  }

  /**
   * Add a model to the roaming system
   */
  addModel(modelData: ModelData): void {
    
    if (!shouldStartRoaming(modelData) || !modelData.roaming?.area) {
      return;
    }

    const roamingModel: RoamingModel = {
      id: modelData.id,
      modelData,
      currentPosition: {
        latitude: modelData.coordinates.latitude,
        longitude: modelData.coordinates.longitude,
        height: modelData.transform.height
      },
      targetPosition: {
        latitude: modelData.coordinates.latitude,
        longitude: modelData.coordinates.longitude,
        height: modelData.transform.height
      },
      startPosition: {
        latitude: modelData.coordinates.latitude,
        longitude: modelData.coordinates.longitude,
        height: modelData.transform.height
      },
      currentHeading: modelData.transform.heading,
      targetHeading: modelData.transform.heading,
      startHeading: modelData.transform.heading,
      speed: modelData.roaming.speed,
      isMoving: false,
      startTime: 0,
      travelTime: 0
    };

    // Generate initial target
    this.generateNewTarget(roamingModel);
    this.roamingModels.set(modelData.id, roamingModel);
    
  }

  /**
   * Remove a model from the roaming system
   */
  removeModel(modelId: string): void {
    const roamingModel = this.roamingModels.get(modelId);
    if (roamingModel?.animationId) {
      cancelAnimationFrame(roamingModel.animationId);
    }
    this.roamingModels.delete(modelId);
  }

  /**
   * Update model roaming configuration
   */
  updateModel(modelData: ModelData): void {
    if (!shouldStartRoaming(modelData)) {
      this.removeModel(modelData.id);
      return;
    }

    const existingModel = this.roamingModels.get(modelData.id);
    if (existingModel) {
      // Update configuration
      existingModel.modelData = modelData;
      existingModel.speed = modelData.roaming!.speed;
      
      // If area changed, generate new target
      if (JSON.stringify(existingModel.modelData.roaming?.area) !== JSON.stringify(modelData.roaming?.area)) {
        this.generateNewTarget(existingModel);
      }
    } else {
      // Add new model
      this.addModel(modelData);
    }
  }

  /**
   * Generate a new target position for a roaming model
   */
  private generateNewTarget(roamingModel: RoamingModel): void {
    if (!roamingModel.modelData.roaming?.area) return;

    const newPosition = getRandomPositionInArea(roamingModel.modelData.roaming.area);
    const newHeading = getRandomHeading();
    
    // Update start position to current position before setting new target
    roamingModel.startPosition = { ...roamingModel.currentPosition };
    roamingModel.startHeading = roamingModel.currentHeading;
    
    roamingModel.targetPosition = {
      latitude: newPosition.latitude,
      longitude: newPosition.longitude,
      height: roamingModel.currentPosition.height // Keep current height
    };
    
    roamingModel.targetHeading = newHeading;
    roamingModel.isMoving = true;
    roamingModel.startTime = performance.now();
    
    // Calculate travel time
    roamingModel.travelTime = calculateTravelTime(
      roamingModel.startPosition.latitude,
      roamingModel.startPosition.longitude,
      roamingModel.targetPosition.latitude,
      roamingModel.targetPosition.longitude,
      roamingModel.speed
    ) * 1000; // Convert to milliseconds
    
  }

  /**
   * Update model position based on current time
   */
  private updateModelPosition(roamingModel: RoamingModel, currentTime: number): void {
    if (!roamingModel.isMoving) return;

    const elapsed = currentTime - roamingModel.startTime;
    const progress = Math.min(elapsed / roamingModel.travelTime, 1);

    if (progress >= 1) {
      // Reached target, generate new one
      roamingModel.currentPosition = { ...roamingModel.targetPosition };
      roamingModel.currentHeading = roamingModel.targetHeading;
      this.generateNewTarget(roamingModel);
      return;
    }

    // Interpolate position from START position to TARGET position
    roamingModel.currentPosition.latitude = this.lerp(
      roamingModel.startPosition.latitude,
      roamingModel.targetPosition.latitude,
      progress
    );
    
    roamingModel.currentPosition.longitude = this.lerp(
      roamingModel.startPosition.longitude,
      roamingModel.targetPosition.longitude,
      progress
    );

    // Interpolate heading from START heading to TARGET heading
    roamingModel.currentHeading = this.lerpAngle(
      roamingModel.startHeading,
      roamingModel.targetHeading,
      progress
    );
  }

  /**
   * Linear interpolation
   */
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  /**
   * Linear interpolation for angles (handles 360° wraparound)
   */
  private lerpAngle(start: number, end: number, factor: number): number {
    let diff = end - start;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return start + diff * factor;
  }

  /**
   * Get current position of a roaming model
   */
  getModelPosition(modelId: string): { latitude: number; longitude: number; height: number; heading: number } | null {
    const roamingModel = this.roamingModels.get(modelId);
    if (!roamingModel) return null;

    return {
      latitude: roamingModel.currentPosition.latitude,
      longitude: roamingModel.currentPosition.longitude,
      height: roamingModel.currentPosition.height,
      heading: roamingModel.currentHeading
    };
  }

  /**
   * Get all roaming models
   */
  getAllRoamingModels(): RoamingModel[] {
    return Array.from(this.roamingModels.values());
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastUpdateTime = performance.now();
    this.animate();
  }

  /**
   * Stop the animation loop
   */
  stopAnimationLoop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main animation loop
   */
  private animate = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;

    // Only update if enough time has passed
    if (deltaTime >= this.updateInterval) {
      this.updateAllModels(currentTime);
      this.lastUpdateTime = currentTime;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Update all roaming models
   */
  private updateAllModels(currentTime: number): void {
    // Only log occasionally to reduce console spam
    if (this.roamingModels.size > 0 && Math.random() < 0.01) { // 1% chance to log
    }
    
    for (const roamingModel of this.roamingModels.values()) {
      this.updateModelPosition(roamingModel, currentTime);
    }
  }

  /**
   * Pause all roaming animations
   */
  pauseAll(): void {
    this.stopAnimationLoop();
  }

  /**
   * Resume all roaming animations
   */
  resumeAll(): void {
    this.startAnimationLoop();
  }

  /**
   * Clear all roaming models
   */
  clearAll(): void {
    this.roamingModels.clear();
  }

  /**
   * Get roaming statistics
   */
  getStats(): { activeModels: number; isRunning: boolean } {
    return {
      activeModels: this.roamingModels.size,
      isRunning: this.isRunning
    };
  }
}

// Global instance
export const roamingAnimationManager = new RoamingAnimationManager();
