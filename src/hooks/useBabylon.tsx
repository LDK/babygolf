// hooks/useBabylon.tsx

import { useRef, useEffect, useState } from "react";
import { Engine, Scene, Color4, FreeCamera, Vector3 } from "@babylonjs/core";

export const useBabylon = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [scene, setScene] = useState<Scene | undefined>(undefined);
    const [defaultCamera, setDefaultCamera] = useState<FreeCamera | undefined>(undefined);
    const [overviewCamera, setOverviewCamera] = useState<FreeCamera | undefined>(undefined);
    const [engine, setEngine] = useState<Engine | undefined>(undefined);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize Babylon.js engine and scene
        setEngine(new Engine(canvasRef.current, true));
    }, []);

    useEffect(() => {
        if (!engine) return;

        const scn:Scene = new Scene(engine);
        scn.clearColor = new Color4(0, 0.12, 0.21, 1);
        setScene(scn || undefined);
    }, [engine]);

    useEffect(() => {
        if (!scene || !canvasRef.current || !engine) return;
        // Basic camera and light setup
        const camera = new FreeCamera("camera1", new Vector3(0, 200, 0), scene);
        camera.setTarget(Vector3.Zero());
        // camera.attachControl(canvasRef.current, true);
        setDefaultCamera(camera);

        const overview = new FreeCamera("overview", new Vector3(0, 200, 0), scene);
        overview.setTarget(Vector3.Zero());
        setOverviewCamera(overview);

        // Handle window resize
        window.addEventListener("resize", () => {
            engine.resize();
        });

        // Clean up when component unmounts
        return () => {
          if (scene) {
              scene.dispose();
          }
          engine.dispose();
        };
    }, [scene, canvasRef, engine]);

    return { canvasRef, scene, defaultCamera, engine, overviewCamera };
};
