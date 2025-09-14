# UI.svelte Component

A Svelte component for adding 3D GLTF models to a Cesium-based 3D globe application.

## Features

- **Coordinate Selection**: Automatically captures coordinates from map click events via the `coordinates` store
- **File Upload**: Support for uploading GLTF files (.glb, .gltf)
- **URL Input**: Support for loading GLTF models from URLs
- **Transform Controls**: Scale, height, heading, pitch, and roll adjustments
- **Form Validation**: Comprehensive validation with error messages
- **Responsive Design**: Mobile-friendly interface
- **Accessibility**: ARIA labels and keyboard navigation support

## Usage

### Basic Integration

```svelte
<script>
  import UI from './UI.svelte';
  
  let uiComponent;
</script>

<UI bind:this={uiComponent} />

<!-- Trigger the UI -->
<button on:click={() => uiComponent?.toggle()}>
  Add 3D Model
</button>
```

### With Coordinate Store

The component automatically reads coordinates from the `coordinates` store:

```typescript
import { coordinates } from './store';

// The component will automatically display current coordinates
// when they are updated via map clicks
```

## API

### Methods

- `toggle()`: Show/hide the UI modal

### Props

None required - the component is self-contained and reads from the coordinates store.

## Form Fields

### Required Fields
- **Model Name**: Display name for the model
- **Coordinates**: Automatically captured from map clicks
- **Model Source**: Either file upload or URL

### Optional Fields
- **Description**: Text description of the model
- **Scale**: Model scale factor (default: 1.0)
- **Height**: Height offset in meters (default: 0)
- **Heading**: Rotation around Z-axis in degrees (default: 0)
- **Pitch**: Rotation around X-axis in degrees (default: 0)
- **Roll**: Rotation around Y-axis in degrees (default: 0)

## Styling

The component uses a glassmorphism design pattern that matches the existing application style:
- Semi-transparent background with blur effects
- White text on dark backgrounds
- Rounded corners and subtle shadows
- Responsive grid layout for form fields

## Events

The component doesn't emit events but provides a `toggle()` method for external control.

## Dependencies

- Svelte stores for coordinate management
- Cesium for 3D rendering (handled by parent components)
- No external UI libraries required

## Example Integration

```svelte
<!-- App.svelte -->
<script>
  import UI from './UI.svelte';
  import Grid from './Grid.svelte';
  
  let uiComponent;
</script>

<Grid on:openUI={() => uiComponent?.toggle()} />
<UI bind:this={uiComponent} />
```

The component is designed to work seamlessly with the existing Cesium-based 3D globe application and follows the established design patterns.
