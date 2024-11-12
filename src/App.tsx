// App.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HavokPhysics from "@babylonjs/havok";
import { useBabylon } from "./hooks/useBabylon";
import * as GUI from "@babylonjs/gui";
import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";
import { useWind } from "./hooks/useWind";
import { useGolfBall } from "./hooks/useGolfBall";
import { useGolfHole } from "./hooks/useGolfHole";
import { useGamePlay } from "./hooks/useGamePlay";
import { useOverview } from "./hooks/useOverview";

const App = () => {
  const { canvasRef, scene, defaultCamera, engine } = useBabylon();
  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const [light, setLight] = useState<BABYLON.DirectionalLight>();
  const [strokes, setStrokes] = useState(0);
  const [goalReached, setGoalReached] = useState(false);

  const [viewMode, setViewMode] = useState<'ball' | 'overview'>('ball');
  const [swingActive, setSwingActive] = useState(false);
  const [shotReady, setShotReady] = useState(true);

  const swingActiveRef = useRef(swingActive);
  const viewModeRef = useRef(viewMode);
  const shotReadyRef = useRef(shotReady);

  useEffect(() => {
    swingActiveRef.current = swingActive;
    viewModeRef.current = viewMode;
    shotReadyRef.current = shotReady;
  }, [swingActive, viewMode, shotReady]);

  const incrementStrokes = useCallback(() => {
    setStrokes(prevStrokes => prevStrokes + 1);
  }, []);

  useEffect(() => {
    console.log('Strokes:', strokes);
  }, [strokes]);

  // Affects size and weight of the golf ball, course and wind power.
  const globalScale = 25;

  // Create a GUI interface for the scene
  const uInterface = useMemo(() => {
    if (scene && physicsEnabled) {
      console.log('get uInterface');
      return GUI.AdvancedDynamicTexture.CreateFullscreenUI("interface", true, scene);
    }
  }, [scene, physicsEnabled]);

  useEffect(() => {
    if (!scene || !engine) return;

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });
  }, [scene, engine]);

  // Create a directional light for the scene
  useEffect(() => {
    if (!scene) return;

    const lt = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -1.5, -1), scene);
    lt.position = new BABYLON.Vector3(0, 400, 0); // Position the light high above the scene
    lt.intensity = 4.4;

    setLight(lt);
    
  }, [scene]);

  // Enable physics in the scene and make `HK` available globally
  useEffect(() => {
    const enablePhysics = async () => {
      try {
        // @ts-ignore
        globalThis.HK = await HavokPhysics();
        if (scene) {
          scene.enablePhysics(new BABYLON.Vector3(0, -9.81 * globalScale, 0), new BABYLON.HavokPlugin());
          setPhysicsEnabled(true);
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (scene) {
      enablePhysics();
    }
  }, [scene]);

  // @ts-ignore
  globalThis.scene = scene;

  // Create a shadow generator for the scene
  const shadowGenerator = useMemo(() => {
    if (light) {
      return new BABYLON.ShadowGenerator(1024, light);
    }
  }, [light]);

  // Render the golf hole and terrain from a GLB file
  const { courseElements, teePosition, camPosition, camRotation } = useGolfHole({
    id: "curve-hill",
    // id: "j-curve",
    // id: "flat",
    // id: "loopy",
    scene,
    physicsEnabled,
    globalScale
  });

  // const musicUrl = '/music/Fable Run.mp3';
  // const musicUrl = '/music/Daniel Swinney - Creekside Village v5.mp3';
  // const musicUrl = '/music/18tokyo.mp3';

  // // Loop the music
  // useEffect(() => {
  //   if (!scene) return;

  //   const music = new BABYLON.Sound("Music", musicUrl, scene, () => {
  //     music.setVolume(0.025);
  //     music.loop = true;
  //     music.play();
  //   });

  //   return () => {
  //     music.stop();
  //   };
  // }, [scene]);
  
  const { overviewCamera } = useOverview({
    courseElements,
    active: viewMode === 'overview',
    globalScale,
    scene
  });

  // const aiming = true;

  useEffect(() => {
    console.log('shotReady', shotReady, 'swingActive', swingActive);
  }, [shotReady, swingActive]);

  const goalCallback = useCallback(() => {
    setGoalReached(true);
    setSwingActive(false);
  }, [setGoalReached, setSwingActive]);

  const stopCallback = useCallback(() => {
    setSwingActive(false);

    if (!goalReached) {
      setShotReady(true);
    } 
  }, [setSwingActive, setShotReady, goalReached]);

  // Create a golf ball and physics aggregate for the golf ball
  const { golfBall, golfBallAggregate } = useGolfBall({
    globalScale,
    scene,
    shotReady,
    physicsEnabled,
    shadowGenerator,
    followerCamera: defaultCamera,
    loc: teePosition,
    swingActive,
    goalCallback,
    stopCallback
  });

  // Simulate wind in the scene and add a GUI display for wind speed
  useWind({
    globalScale,
    baseWindMph: 12,
    mphInterval: 1000,
    scene,
    uInterface,
    pos: { left: "40%", top: "-40%" },
    golfBall,
    golfBallAggregate,
    physicsEnabled,
    swingActive
  });

  const viewCallback = useCallback((mode: 'ball' | 'overview') => {
    setViewMode(mode);
  }, [setViewMode]);

  const swingCallback = useCallback(() => {
    incrementStrokes();
    setSwingActive(true);
    setShotReady(false);
    console.log('Swing callback...');
  }, [incrementStrokes, setSwingActive, setShotReady]);

  // Add controls to the scene for the golf ball
  useGamePlay({
    scene,
    golfBallAggregate,
    golfBall,
    physicsEnabled,
    globalScale,
    swingActive: swingActive,
    shotReady: shotReady,
    defaultCamera,
    aiming: shotReady,
    overviewCamera,
    viewMode,
    viewCallback,
    swingCallback
  });

  useEffect(() => {
    if (!scene || !overviewCamera || !defaultCamera) return;

    if (viewMode === 'overview' && overviewCamera) {
      scene.activeCamera = overviewCamera;
    } else {
      scene.activeCamera = defaultCamera;
    }

  }, [viewMode, scene, overviewCamera, defaultCamera]);

  useEffect(() => {
    if (goalReached) {
      console.log(`Goal reached in ${strokes} strokes!`);
      setSwingActive(false);
      setShotReady(false);
    }
  }, [goalReached, strokes]);

  useEffect(() => {
    if (defaultCamera && camPosition && camRotation) {
      defaultCamera.position = camPosition;
      defaultCamera.rotation = camRotation;
    }

    // console.log('camPosition', camPosition, 'camRotation', camRotation);
  }, [camPosition, camRotation, defaultCamera]);

  return <canvas ref={canvasRef} id="renderCanvas" />;
}

export default App;
