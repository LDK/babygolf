// hooks/useGamePlay.ts

import * as BABYLON from "@babylonjs/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GamePlayProps = {
  scene?: BABYLON.Scene;
  golfBallAggregate?: BABYLON.PhysicsAggregate;
  golfBall?: BABYLON.TransformNode;
  physicsEnabled: boolean;
  globalScale: number;
  swingCallback?: () => void;
  shotReady: boolean;
  swingActive: boolean;
  aiming?: boolean;
  defaultCamera?: BABYLON.FreeCamera;
  overviewCamera?: BABYLON.FreeCamera;
  viewMode: 'ball' | 'overview';
  viewCallback?: (mode: 'ball' | 'overview') => void;
};

export const useGamePlay = ({
  scene,
  golfBallAggregate,
  golfBall,
  physicsEnabled,
  globalScale,
  swingCallback,
  swingActive,
  shotReady,
  viewMode,
  viewCallback
}: GamePlayProps) => {
  // Ref to store the observer for keyboard events
  const keyboardObserverRef = useRef<BABYLON.Nullable<BABYLON.Observer<BABYLON.KeyboardInfo>>>(null);

  // Refs for the direction line
  const directionLineRef = useRef<BABYLON.LinesMesh>();

  // Instance of arrowhead mesh (/parts/arrow-point.glb)
  const arrowHeadRef = useRef<BABYLON.Mesh>();

  // Red material for the direction line
  const [arrowMaterial, setArrowMaterial] = useState<BABYLON.StandardMaterial>();

  // Set up sounds for strike and aiming
  const strikeSound = useMemo(() => {
    if (scene) {
      const sound = new BABYLON.Sound("strikeSound", "/sounds/ball-strike.wav", scene);
      sound.setVolume(0.1);
      return sound;
    }
  }, [scene]);

  const tickSound = useMemo(() => {
    if (scene) {
      const sound = new BABYLON.Sound("tickSound", "/sounds/tick.wav", scene);
      sound.setVolume(0.25);
      return sound;
    }
  }, [scene]);
  
  // Create a material for the arrowhead
  useEffect(() => {
    if (scene) {
      const newMat = new BABYLON.StandardMaterial("arrowMaterial", scene);
      newMat.diffuseColor = BABYLON.Color3.Red();
      // newMat.unlit = true;
      setArrowMaterial(newMat);
    }
  }, [scene, setArrowMaterial]);

  // const aimCallback = (axis: ('y' | 'x'), value: number) => {
  //   switch (axis) {
  //     case 'y':
  //       setAimY(value);
  //       break;
  //     case 'x':
  //       setAimX(value);
  //       break;
  //   }
  // };

  // Load the arrowhead mesh
  useEffect(() => {
    const loadArrowHead = async () => {
      BABYLON.SceneLoader.ImportMesh("", "/parts/", "arrow-point.glb", scene, (meshes) => {
        const mesh = meshes[0] as BABYLON.Mesh;
  
        if (!arrowMaterial) {
          const newMat = new BABYLON.StandardMaterial("arrowMaterial", scene);
          newMat.diffuseColor = BABYLON.Color3.Red();
          // newMat.unlit = true;
          mesh.material = newMat;
          setArrowMaterial(newMat);
        } else {
          mesh.material = arrowMaterial;
        }
  
        arrowHeadRef.current = mesh;
        arrowHeadRef.current.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.WORLD);
      });
    };
  
    if (scene && !arrowHeadRef.current && arrowMaterial) {
      loadArrowHead();
    }
  }, [scene, arrowHeadRef, arrowMaterial]);

  const [aimY, setAimY] = useState(0);
  const [aimX, setAimX] = useState(0);

  const aimCallback = useCallback((axis: ('y' | 'x'), increment: number) => {
    switch (axis) {
      case 'y':
        setAimY(a => a + increment);
        break;
      case 'x':
        setAimX(a => a + increment);
        break;
    }
  }, [setAimY, setAimX]);

  useEffect(() => {
    tickSound?.play();
    if (directionLineRef.current) {
      directionLineRef.current.rotation.y = aimY;
    }
  }, [aimY, tickSound]);

  useEffect(() => {
    tickSound?.play();
    if (directionLineRef.current) {
      directionLineRef.current.rotation.x = aimX;
    }
  }, [aimX, tickSound]);

  // Adding a line to represent shot direction
  useEffect(() => {
    if (scene && golfBall) {
      // Remove any existing direction line
      if (arrowHeadRef.current) {
        arrowHeadRef.current.parent = null;
        if (arrowMaterial) {
          arrowHeadRef.current.material = arrowMaterial;
        }
      }
      directionLineRef.current?.dispose();
      // arrowHeadRef.current?.dispose();

      const golfBallPosition = golfBall.getAbsolutePosition();
      const linePosition = golfBallPosition.clone().add(new BABYLON.Vector3(0, 10, 0));
      const direction = new BABYLON.Vector3(0, 0, 1); // Example direction, you can modify this

      const linePoints = [
        linePosition,
        linePosition.add(direction.scale(globalScale)), // Arrow extending forward
      ];

      // console.log('linePoints', linePoints);

      if (shotReady && linePoints && linePoints.length > 1 && scene) {
        // Create or update the direction line
        directionLineRef.current = BABYLON.MeshBuilder.CreateLines(
          "golfBallDirectionLine",
          { points: linePoints },
          scene
        );

        directionLineRef.current.color = BABYLON.Color3.Red();

        const lineLength = BABYLON.Vector3.Distance(linePoints[0], linePoints[1]);
  
        const cylinderLine = BABYLON.MeshBuilder.CreateCylinder("cylinderLine", {
          height: lineLength,
          diameter: 0.05 * globalScale,
          tessellation: 6,
        }, scene);

        cylinderLine.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.WORLD);
        cylinderLine.position = linePosition.add(direction.scale(lineLength / 2));

        cylinderLine.parent = directionLineRef.current;
        if (arrowMaterial) {
          cylinderLine.material = arrowMaterial;
        }

        // Create an instance of the arrowhead mesh or a sphere if the mesh hasn't loaded yet
        // const arrowHead = arrowHeadRef.current?.createInstance("arrowHead") || BABYLON.MeshBuilder.CreateSphere("arrowHead", { diameter: 0.1 * globalScale }, scene);
        if (arrowHeadRef.current) {
          arrowHeadRef.current.position = linePoints[1].subtract(directionLineRef.current.position);
          arrowHeadRef.current.parent = directionLineRef.current;
          arrowHeadRef.current.visibility = 0;
          if (arrowMaterial) {
            arrowHeadRef.current.material = arrowMaterial;
          }
        } else {
          console.log('Arrow head not loaded yet', arrowHeadRef);
        }

        console.log('directionLineRef', directionLineRef.current);
      }
      // Hide the line initially if not aiming
      // if (!shotReady) {
      //   directionLineRef.current.visibility = 0;
      // }
    }
  }, [scene, golfBall, shotReady, globalScale, arrowMaterial]);

  // Update direction line during aiming
  useEffect(() => {
    if (scene && golfBall && directionLineRef.current) {
      if (shotReady) {
        directionLineRef.current.setPivotPoint(golfBall.position.add(new BABYLON.Vector3(0, 10, 0)));
      }
    }
  }, [scene, golfBall, shotReady, globalScale]);

  useEffect(() => {
    if (!scene || !golfBallAggregate || !golfBall || !physicsEnabled) return;

    // Remove the existing observer if it's already registered
    if (keyboardObserverRef.current) {
      scene.onKeyboardObservable.remove(keyboardObserverRef.current);
    }

    // console.log("Adding controls to scene...");

    // Function to call when the user presses the space bar
    const swingActionCallback = (velocity:number = 1) => {
      console.log("Swing...");
      if (golfBall && golfBallAggregate.body?._pluginData?.hpBodyId) {
        // Reset damping values to zero
        try {
          // Play the strike sound
          strikeSound?.play();
          setAimX(0);
          setAimY(0);

          if (arrowHeadRef.current) {
            // position it far away so it doesn't interfere with the shot
            arrowHeadRef.current.position = new BABYLON.Vector3(0, -1000, 1000);
          }
          golfBallAggregate.body.setAngularDamping(0);
          golfBallAggregate.body.setLinearDamping(0);

          const direction = directionLineRef?.current?.getDirection(BABYLON.Axis.Z);

          if (direction) {
            const force = 50;
            console.log('velocity', velocity);
            golfBallAggregate.body.applyForce(
              direction.scale(1000 * force * globalScale * velocity), // Force to apply
              golfBall.getAbsolutePosition() // Position of application (center of the ball)
            );

            if (swingCallback) {
              swingCallback();
            }
          }
        } catch (e) {
          console.error("Error applying force to golf ball", e);
        }
      }
    };

    // Function to handle keyboard events
    const keyboardCheck = (kbInfo: BABYLON.KeyboardInfo) => {
      switch (kbInfo.type) {
        case BABYLON.KeyboardEventTypes.KEYDOWN:
          // This is a placeholder event to test out "hitting" the golf ball
          switch (kbInfo.event.key) {
            case " ": // space bar
              if (shotReady && !swingActive) {
                swingActionCallback(1);
              }
              break;
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
              const velocity = parseInt(kbInfo.event.key) / 9;

              if (!isNaN(velocity) && shotReady && !swingActive) {
                swingActionCallback(velocity);
              }

              break; 
            case "v":
              if (viewCallback) {
                viewCallback(viewMode === 'ball' ? 'overview' : 'ball');
              }
              break;
            case "a":
              console.log('line ref', directionLineRef?.current);
              console.log('golf ball', golfBall);
              console.log('arrow head', arrowHeadRef?.current);
              console.log('arrow material', arrowMaterial);
              break;
            case "ArrowLeft":
              // Rotate the direction line clockwise around the Y axis
              // setAimY(aimY - Math.PI / 180);
              aimCallback('y', -Math.PI / 180);
              // tickSound?.play();
              // directionLineRef?.current?.rotate(BABYLON.Axis.Y, -Math.PI / 180, BABYLON.Space.WORLD);
              break;
            case "ArrowRight":
              // Rotate the direction line counter-clockwise around the Y axis
              // setAimY(aimY + Math.PI / 180);
              aimCallback('y', Math.PI / 180);
              // tickSound?.play();
              // directionLineRef?.current?.rotate(BABYLON.Axis.Y, Math.PI / 180, BABYLON.Space.WORLD);
              break;
            case "ArrowUp":
              // Rotate the direction line counter-clockwise around the X axis
              aimCallback('x', -Math.PI / 180);
              // tickSound?.play();
              // directionLineRef?.current?.rotate(BABYLON.Axis.X, -Math.PI / 180, BABYLON.Space.WORLD);
              break;
            case "ArrowDown":
              // Rotate the direction line clockwise around the X axis
              aimCallback('x', Math.PI / 180);
              // tickSound?.play();
              // directionLineRef?.current?.rotate(BABYLON.Axis.X, Math.PI / 180, BABYLON.Space.WORLD);
              break;
          }
          break;
      }
    };

    // Register the keyboard event and store the observer reference
    const observer = scene.onKeyboardObservable.add(keyboardCheck);
    keyboardObserverRef.current = observer;

    // Cleanup function to remove the observer when the component is unmounted or dependencies change
    return () => {
      if (observer) {
        scene.onKeyboardObservable.remove(observer);
      }
    };
  }, [golfBallAggregate, golfBall, scene, physicsEnabled, swingActive, shotReady, directionLineRef, viewMode, viewCallback, globalScale, swingCallback, aimCallback, arrowMaterial, strikeSound]);
};
