// hooks/useOverview.ts

import { useState, useEffect, useMemo, useRef } from "react";
import * as BABYLON from "@babylonjs/core";

export type OverviewProps = {
  courseElements?: BABYLON.AbstractMesh[];
  active: boolean;
  globalScale: number;
  scene?: BABYLON.Scene;
};

export const useOverview = ({ courseElements, active, globalScale, scene }: OverviewProps) => {
  const overviewCamera = useMemo(() => {
    if (scene) {
      const overview = new BABYLON.FreeCamera("overview", new BABYLON.Vector3(0, 200, 0), scene);
      overview.setTarget(BABYLON.Vector3.Zero());
      return overview;
    }
  }, [scene]);

  // Ref to store the observer for keyboard events
  const keyboardObserverRef = useRef<BABYLON.Nullable<BABYLON.Observer<BABYLON.KeyboardInfo>>>(null);
  const beforeRenderObserverRef = useRef<BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>>>(null);
  const pressedKeys = useRef(new Set<string>()); // Set to keep track of pressed keys

  // Various controls for zooming and panning the overview camera
  const [zoomLevel, setZoomLevel] = useState(1);
  const [distance, setDistance] = useState(0);
  const maxZoom = 2.5;
  const minZoom = 0.5;
  const worldY = 100;

  // Determine the bounding box of all course elements
  const boundingBox = useMemo(() => {
    let maxWorldX = 0;
    let maxWorldZ = 0;
    let minWorldX = 0;
    let minWorldZ = 0;

    // Iterate through all course elements to determine the bounding box
    if (courseElements && courseElements.length) {
      for (let mesh of courseElements) {

        // Don't include beach or water meshes in the bounding box
        if (mesh.name.startsWith("Beach") || mesh.name.startsWith("Water")) {
          continue;
        }

        const boundingBox = mesh.getBoundingInfo().boundingBox;

        if (boundingBox.maximumWorld.x > maxWorldX) {
          maxWorldX = boundingBox.maximumWorld.x;
        }

        if (boundingBox.maximumWorld.z > maxWorldZ) {
          maxWorldZ = boundingBox.maximumWorld.z;
        }

        if (boundingBox.minimumWorld.x < minWorldX) {
          minWorldX = boundingBox.minimumWorld.x;
        }

        if (boundingBox.minimumWorld.z < minWorldZ) {
          minWorldZ = boundingBox.minimumWorld.z;
        }
      }
    }

    return new BABYLON.BoundingBox(new BABYLON.Vector3(minWorldX, worldY, minWorldZ), new BABYLON.Vector3(maxWorldX, worldY, maxWorldZ));
  }, [courseElements]);

  // When zoom level changes, update the camera position
  useEffect(() => {
    if (overviewCamera && scene && distance && zoomLevel) {
      const maxX = boundingBox.center.x + (boundingBox.extendSize.x / (maxZoom - zoomLevel + 1));
      const minX = boundingBox.center.x - (boundingBox.extendSize.x / (maxZoom - zoomLevel + 1));
      const maxZ = boundingBox.center.z + (boundingBox.extendSize.z / (maxZoom - zoomLevel + 1));
      const minZ = boundingBox.center.z - (boundingBox.extendSize.z / (maxZoom - zoomLevel + 1));
  
      // Move smoothly to new position over 500ms
      const animation = new BABYLON.Animation(
        "cameraAnimation",
        "position",
        30,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      const newPosition = overviewCamera.position.clone();
      newPosition.y = distance / zoomLevel;

      if (overviewCamera.position.x > maxX || overviewCamera.position.x < minX || overviewCamera.position.z > maxZ || overviewCamera.position.z < minZ) {
        newPosition.x = Math.min(Math.max(newPosition.x, minX), maxX);
        newPosition.z = Math.min(Math.max(newPosition.z, minZ), maxZ);
      }
  
      const keys = [
        { frame: 0, value: overviewCamera.position },
        { frame: 15, value: newPosition }
      ];

      animation.setKeys(keys);
      scene.beginDirectAnimation(overviewCamera, [animation], 0, 15, false);

    }
  }, [zoomLevel, distance, overviewCamera, scene, active]);

  useEffect(() => {
    // draw a box that represents the bounding box
    if (overviewCamera && scene && boundingBox) {
      // Center camera on bounding box and adjust its position so that the box fills the screen
      if (boundingBox) {
        const center = boundingBox.center;
        const size = boundingBox.extendSize;

        const aspectRatio = scene!.getEngine().getAspectRatio(overviewCamera);
        const halfWidth = size.x;
        const halfHeight = halfWidth / aspectRatio;

        const newDistance = Math.max(halfWidth, halfHeight) / Math.tan(overviewCamera.fov / 2);
        setDistance(newDistance);

        overviewCamera.position = boundingBox.center.add(new BABYLON.Vector3(0, (newDistance - worldY) / 2, 0));
        overviewCamera.setTarget(center);
      }

      // box.dispose();
    }
  }, [boundingBox]);

  // Add the keyboard controls each time the camera or scene changes or overview is activated/deactivated
  useEffect(() => {
    if (!scene || !overviewCamera) return;

    // Remove the existing observer if it's already registered
    if (keyboardObserverRef.current) {
      scene.onKeyboardObservable.remove(keyboardObserverRef.current);
    }

    if (beforeRenderObserverRef.current) {
      scene.onBeforeRenderObservable.remove(beforeRenderObserverRef.current);
    }

    if (!active) return;

    console.log("Adding controls to overview...");

    // Handle key down and key up to track pressed keys
    const keyboardCheck = (kbInfo: BABYLON.KeyboardInfo) => {
      if (!overviewCamera) return;

      switch (kbInfo.type) {
        case BABYLON.KeyboardEventTypes.KEYDOWN:
          pressedKeys.current.add(kbInfo.event.key);
          if (kbInfo.event.key === "d") {
            setZoomLevel((prevZoom) => Math.max(minZoom, prevZoom - 0.5));
          }
          if (kbInfo.event.key === "f") {
            setZoomLevel((prevZoom) => Math.min(maxZoom, prevZoom + 0.5));
          }
          break;
        case BABYLON.KeyboardEventTypes.KEYUP:
          pressedKeys.current.delete(kbInfo.event.key);
          break;
      }
    };

    // Register the keyboard event and store the observer reference
    const observer = scene.onKeyboardObservable.add(keyboardCheck);
    keyboardObserverRef.current = observer;

    // Register a before render loop to smoothly move the camera
    const moveSpeed = 0.2 * globalScale;
    const beforeRender = () => {
      if (!overviewCamera) return;

      const maxX = boundingBox.center.x + (boundingBox.extendSize.x / (maxZoom - zoomLevel + 1));
      const minX = boundingBox.center.x - (boundingBox.extendSize.x / (maxZoom - zoomLevel + 1));
      const maxZ = boundingBox.center.z + (boundingBox.extendSize.z / (maxZoom - zoomLevel + 1));
      const minZ = boundingBox.center.z - (boundingBox.extendSize.z / (maxZoom - zoomLevel + 1));

      if (pressedKeys.current.has("ArrowLeft")) {
        overviewCamera.position.x = Math.min(overviewCamera.position.x + moveSpeed, maxX);
      }
      if (pressedKeys.current.has("ArrowRight")) {
        overviewCamera.position.x = Math.max(overviewCamera.position.x - moveSpeed, minX);
      }
      if (pressedKeys.current.has("ArrowUp")) {
        overviewCamera.position.z = Math.max(overviewCamera.position.z - moveSpeed, minZ);
      }
      if (pressedKeys.current.has("ArrowDown")) {
        overviewCamera.position.z = Math.min(overviewCamera.position.z + moveSpeed, maxZ);
      }
    };
    const beforeRenderObserver = scene.onBeforeRenderObservable.add(beforeRender);
    beforeRenderObserverRef.current = beforeRenderObserver;

    // Cleanup function to remove the observer and before render function when the component is unmounted or dependencies change
    return () => {
      if (observer) {
        scene.onKeyboardObservable.remove(observer);
      }
      if (beforeRenderObserver) {
        scene.onBeforeRenderObservable.remove(beforeRenderObserver);
      }
    };
  }, [scene, overviewCamera, boundingBox, zoomLevel, globalScale, active]);

  return { overviewCamera, boundingBox };
};
