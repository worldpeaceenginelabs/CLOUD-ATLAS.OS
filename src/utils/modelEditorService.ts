/**
 * Model Editor Service
 * Centralizes all 3D model editor state and business logic.
 * Used by Editor.svelte, ModalManager.svelte, and App.svelte.
 */

import { get, writable, type Writable } from 'svelte/store';
import {
  coordinates,
  editingModelId,
  temporaryModelId
} from '../store';
import { modalService } from './modalService';
import {
  addModel,
  updateModel,
  createFinalModelData,
  validateModelForm,
  addTemporaryModel,
  removeTemporaryModel,
  persistTemporaryModel
} from './modelUtils';
import { logger } from './logger';

// ─── Form State Stores ───────────────────────────────────────────────

export const formSelectedSource: Writable<'url' | 'file'> = writable('url');
export const formGltfFile: Writable<File | null> = writable(null);
export const formGltfUrl: Writable<string> = writable('');
export const formModelName: Writable<string> = writable('');
export const formModelDescription: Writable<string> = writable('');
export const formScale: Writable<number> = writable(1.0);
export const formHeight: Writable<number> = writable(0);
export const formHeightOffset: Writable<number> = writable(0.0);
export const formHeading: Writable<number> = writable(0);
export const formPitch: Writable<number> = writable(0);
export const formRoll: Writable<number> = writable(0);

// Roaming state
export const formIsRoamingEnabled: Writable<boolean> = writable(false);
export const formRoamingSpeed: Writable<number> = writable(1.0);
export const formRoamingArea: Writable<{
  north: number;
  south: number;
  east: number;
  west: number;
} | null> = writable(null);

// ─── Internal State ──────────────────────────────────────────────────

let _updateRoamingModel: ((modelData: any) => void) | undefined = undefined;

// ─── Service Class ───────────────────────────────────────────────────

class ModelEditorService {
  /** Called by App.svelte to pass the Cesium roaming callback */
  setUpdateRoamingModel(fn: ((modelData: any) => void) | undefined) {
    _updateRoamingModel = fn;
  }

  /** Reset all form state to defaults */
  resetFormData() {
    const tempId = get(temporaryModelId);
    if (tempId) {
      removeTemporaryModel(tempId);
      temporaryModelId.set(null);
    }

    editingModelId.set(null);

    formSelectedSource.set('url');
    formGltfFile.set(null);
    formGltfUrl.set('');
    formModelName.set('');
    formModelDescription.set('');
    formScale.set(1.0);
    formHeight.set(0);
    formHeightOffset.set(0.0);
    formHeading.set(0);
    formPitch.set(0);
    formRoll.set(0);
    formIsRoamingEnabled.set(false);
    formRoamingSpeed.set(1.0);
    formRoamingArea.set(null);
  }

  /** Get a snapshot of all current form values */
  private getFormSnapshot() {
    return {
      selectedSource: get(formSelectedSource),
      gltfFile: get(formGltfFile),
      gltfUrl: get(formGltfUrl),
      modelName: get(formModelName),
      modelDescription: get(formModelDescription),
      scale: get(formScale),
      height: get(formHeight),
      heightOffset: get(formHeightOffset),
      heading: get(formHeading),
      pitch: get(formPitch),
      roll: get(formRoll),
      isRoamingEnabled: get(formIsRoamingEnabled),
      roamingSpeed: get(formRoamingSpeed),
      roamingArea: get(formRoamingArea)
    };
  }

  // ─── Add / Edit Triggers ────────────────────────────────────────────

  /** Open the editor in "add new model" mode */
  handleAddModel() {
    this.resetFormData();
    modalService.showModelEditor(false);
  }

  /** Open the editor in "edit existing model" mode */
  handleEditModel(modelData: any) {
    if (!modelData) return;

    editingModelId.set(modelData.id);

    // Update coordinates store with model data
    coordinates.set({
      latitude: modelData.coordinates.latitude.toString(),
      longitude: modelData.coordinates.longitude.toString(),
      height: modelData.transform.height
    });

    // Populate form stores
    formModelName.set(modelData.name);
    formModelDescription.set(modelData.description || '');
    formScale.set(modelData.transform.scale);
    formHeight.set(modelData.transform.height);
    formHeightOffset.set(modelData.transform.heightOffset || 0.0);
    formHeading.set(modelData.transform.heading);
    formPitch.set(modelData.transform.pitch);
    formRoll.set(modelData.transform.roll);

    if (modelData.source === 'file' && modelData.file) {
      formSelectedSource.set('file');
      formGltfFile.set(modelData.file);
      formGltfUrl.set('');
    } else {
      formSelectedSource.set('url');
      formGltfUrl.set(modelData.url || '');
      formGltfFile.set(null);
    }

    formIsRoamingEnabled.set(modelData.roaming?.isEnabled || false);
    formRoamingSpeed.set(modelData.roaming?.speed || 1.0);
    formRoamingArea.set(modelData.roaming?.area || null);

    // Clear any existing temporary model
    const tempId = get(temporaryModelId);
    if (tempId) {
      removeTemporaryModel(tempId);
      temporaryModelId.set(null);
    }

    // Create temporary model for edit mode
    this.addTemporaryModelFromFormData();

    modalService.showModelEditor(true, modelData);
  }

  // ─── Temporary Model Management ────────────────────────────────────

  /** Create a temporary (preview) model from current form state */
  addTemporaryModelFromFormData() {
    const coords = get(coordinates);
    const form = this.getFormSnapshot();

    const modelCoordinates = {
      latitude: coords.latitude || '0',
      longitude: coords.longitude || '0',
      height: coords.height || 0
    };

    const editId = get(editingModelId);

    const tempModelData = createFinalModelData(
      modelCoordinates,
      {
        selectedSource: form.selectedSource,
        gltfFile: form.gltfFile,
        gltfUrl: form.gltfUrl,
        modelName: form.modelName || (form.gltfFile?.name || 'New Model'),
        modelDescription: form.modelDescription,
        scale: form.scale,
        height: form.height,
        heightOffset: form.heightOffset,
        heading: form.heading,
        pitch: form.pitch,
        roll: form.roll,
        isRoamingEnabled: form.isRoamingEnabled,
        roamingSpeed: form.roamingSpeed,
        roamingArea: form.roamingArea
      },
      !!editId,
      editId || undefined
    );

    const tempId = addTemporaryModel(tempModelData);
    temporaryModelId.set(tempId);
  }

  /** Update the existing temporary model with current form state */
  updateTemporaryModelFromFormData() {
    const tempId = get(temporaryModelId);
    if (tempId) {
      removeTemporaryModel(tempId);
      this.addTemporaryModelFromFormData();
    }
  }

  // ─── Preview Model Update ───────────────────────────────────────────

  /** Called reactively by Editor when form stores change -- manages the temporary preview model */
  updatePreview() {
    const form = this.getFormSnapshot();
    const hasSource =
      (form.selectedSource === 'url' && form.gltfUrl) ||
      (form.selectedSource === 'file' && form.gltfFile);

    if (hasSource) {
      const tempId = get(temporaryModelId);
      if (!tempId) {
        this.addTemporaryModelFromFormData();
      } else {
        this.updateTemporaryModelFromFormData();
      }
    }
  }

  // ─── Save / Cancel ─────────────────────────────────────────────────

  /** Submit the form -- persist or update the model */
  async handleSubmit() {
    const editId = get(editingModelId);
    const coords = get(coordinates);
    const form = this.getFormSnapshot();

    try {
      const validation = validateModelForm(
        form.modelName,
        coords,
        form.selectedSource,
        form.gltfFile,
        form.gltfUrl
      );

      if (!validation.isValid) {
        alert(validation.errorMessage);
        return;
      }

      const modelData = createFinalModelData(
        coords,
        {
          selectedSource: form.selectedSource,
          gltfFile: form.gltfFile,
          gltfUrl: form.gltfUrl,
          modelName: form.modelName,
          modelDescription: form.modelDescription,
          scale: form.scale,
          height: form.height,
          heightOffset: form.heightOffset,
          heading: form.heading,
          pitch: form.pitch,
          roll: form.roll,
          isRoamingEnabled: form.isRoamingEnabled,
          roamingSpeed: form.roamingSpeed,
          roamingArea: form.roamingArea
        },
        !!editId,
        editId || undefined
      );

      const tempId = get(temporaryModelId);

      if (editId) {
        // Update existing model
        const originalModelData = {
          ...modelData,
          id: editId,
          name: modelData.name.replace(' (Preview)', '')
        };

        await updateModel(originalModelData);
        logger.modelUpdated(originalModelData.name);

        if (tempId) {
          removeTemporaryModel(tempId);
          temporaryModelId.set(null);
        }

        if (_updateRoamingModel && originalModelData.roaming?.isEnabled) {
          _updateRoamingModel(originalModelData);
        }
      } else if (tempId) {
        // Persist the temporary model
        await persistTemporaryModel(tempId);
        logger.modelAdded(modelData.name);
        temporaryModelId.set(null);

        if (_updateRoamingModel && modelData.roaming?.isEnabled) {
          _updateRoamingModel(modelData);
        }
      } else {
        // Fallback: add as new model
        await addModel(modelData);
        logger.modelAdded(modelData.name);

        if (_updateRoamingModel && modelData.roaming?.isEnabled) {
          _updateRoamingModel(modelData);
        }
      }

      // Remove roaming area visuals from the Cesium scene
      window.dispatchEvent(new CustomEvent('clearRoamingAreaVisuals'));
      modalService.hideModelEditor();
    } catch (error) {
      logger.operationError('submitModel', error, { component: 'ModelEditorService', operation: 'handleSubmit' });
      alert('Failed to save model. Please try again.');
    }
  }

  /** Cancel editing -- clean up temporary model and close */
  handleCancel() {
    this.resetFormData();
    // Remove roaming area visuals from the Cesium scene
    window.dispatchEvent(new CustomEvent('clearRoamingAreaVisuals'));
    modalService.hideModelEditor();
  }

  /** Called when coordinates change while a temporary model exists */
  handleCoordinatesChanged() {
    const tempId = get(temporaryModelId);
    if (tempId) {
      this.updateTemporaryModelFromFormData();
    }
  }
}

// Export singleton instance
export const modelEditorService = new ModelEditorService();
