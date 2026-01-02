import * as THREE from 'three'

/**
 * ResourceTracker for Three.js resources
 *
 * Three.js resources do NOT auto-dispose when removed from scene.
 * This class tracks geometries, materials, textures, and render targets
 * for systematic cleanup on unmount.
 */
export class ResourceTracker {
  private resources = new Set<{ dispose: () => void }>()

  /**
   * Track a resource for later disposal
   */
  track<T extends { dispose?: () => void }>(resource: T): T {
    if (resource && typeof resource.dispose === 'function') {
      this.resources.add(resource as { dispose: () => void })
    }
    return resource
  }

  /**
   * Track multiple resources
   */
  trackAll<T extends { dispose?: () => void }>(resources: T[]): T[] {
    resources.forEach((r) => this.track(r))
    return resources
  }

  /**
   * Untrack a resource (if you want to manually manage it)
   */
  untrack<T extends { dispose?: () => void }>(resource: T): T {
    if (resource && typeof resource.dispose === 'function') {
      this.resources.delete(resource as { dispose: () => void })
    }
    return resource
  }

  /**
   * Dispose all tracked resources
   */
  dispose(): void {
    for (const resource of this.resources) {
      try {
        resource.dispose()
      } catch (e) {
        console.warn('Error disposing resource:', e)
      }
    }
    this.resources.clear()
  }

  /**
   * Get count of tracked resources
   */
  get count(): number {
    return this.resources.size
  }
}

/**
 * Dispose an entire scene and all its children
 */
export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) {
      ;(obj as THREE.Mesh).geometry.dispose()
    }

    const mesh = obj as THREE.Mesh
    if (mesh.material) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]

      materials.forEach((mat) => {
        // Dispose all textures in the material
        Object.values(mat).forEach((value) => {
          if (value instanceof THREE.Texture) {
            value.dispose()
          }
        })
        mat.dispose()
      })
    }
  })
}

/**
 * Create a singleton instance for global resource tracking
 */
let globalTracker: ResourceTracker | null = null

export function getGlobalResourceTracker(): ResourceTracker {
  if (!globalTracker) {
    globalTracker = new ResourceTracker()
  }
  return globalTracker
}

export function disposeGlobalTracker(): void {
  if (globalTracker) {
    globalTracker.dispose()
    globalTracker = null
  }
}
