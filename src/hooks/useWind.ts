// hooks/useWind.ts

import { useState, useEffect, useMemo, useRef } from "react";
import * as GUI from "@babylonjs/gui";
import * as BABYLON from "@babylonjs/core";

export type WindProps = {
  globalScale: number;
  baseWindMph?: number;
  mphInterval?: number;
  scene?: BABYLON.Scene;
  uInterface?: GUI.AdvancedDynamicTexture;
  pos: { left: string; top: string };
  golfBall?: BABYLON.TransformNode;
  golfBallAggregate?: BABYLON.PhysicsAggregate;
  physicsEnabled: boolean;
  teePosition?: BABYLON.Vector3;
  swingActive: boolean;
};

export const useWind = ({ globalScale, teePosition, baseWindMph = 0, mphInterval = 1000, swingActive, scene, uInterface, pos, golfBall, golfBallAggregate, physicsEnabled }: WindProps) => {
  const [windDirection/*, setWindDirection*/] = useState(new BABYLON.Vector3(0.05, 0, -1));
  const [windMph, setWindMph] = useState(baseWindMph);

  const [windContainer, setWindContainer] = useState<GUI.Rectangle>();

  // Determine wind strength based on wind speed and global scale
  const windStrength = useMemo(() => windMph * (globalScale / 12), [windMph, globalScale]);

  const maxWindIncrement = .05;
  const windRange = 7;

  const windCallbackRef = useRef<() => void>();

  useEffect(() => {
    const updateWind = () => {
      // a random number between -maxWindIncrement and +maxWindIncrement
      const windAdjustment = (Math.random() * 2 - 1) / (1 / maxWindIncrement);
      const windFloor = Math.max(baseWindMph - windRange, 0);
      const windCeiling = baseWindMph + windRange;

      const newMph = windAdjustment + windMph;

      setWindMph(Math.min(Math.max(newMph, windFloor), windCeiling));
    };

    const windInterval = setInterval(updateWind, mphInterval);

    return () => clearInterval(windInterval);
  }, [windStrength, baseWindMph, mphInterval, windMph]);

  useEffect(() => {
    if (scene && physicsEnabled && golfBall && golfBallAggregate) {
      // Remove previous before render function to prevent multiple instances
      if (windCallbackRef.current) {
        scene.unregisterBeforeRender(windCallbackRef.current);
      }
  
      const windCallback = () => {
        if (golfBallAggregate?.body?._pluginData?.hpBodyId && golfBall && swingActive) {
          try {
            golfBallAggregate.body.applyForce(
              windDirection.scale(windStrength), // Wind force vector
              golfBall.getAbsolutePosition() // Position of application (center of the ball)
            );
          } catch (e) {
            console.error('Error applying wind force to golf ball', e);
          }
        }
      };
  
      windCallbackRef.current = windCallback;
      scene.registerBeforeRender(windCallback);
    }
  }, [scene, physicsEnabled, golfBallAggregate, windDirection, windStrength, swingActive, golfBall]);

  useEffect(() => {
    if (scene && uInterface) {
      scene.onReadyObservable.add(function(){
        // Force GUI to update
        uInterface._rootContainer.children[0]?._markAsDirty();
      });
    }
  }, [scene, uInterface]);

  if (!scene || !uInterface) return { windDisplay: null };

  // Limit to 1 decimal place
  const windText = `Wind: ${windMph.toFixed(1)} mph`;

  if (windContainer) {
    for (let child of windContainer.children) {
      if (child.name === "windText" || child.name === "windTextShadow") {
        // const textBlock = child as GUI.TextBlock;
        (child as GUI.TextBlock).text = windText;
      }
    }
    return { windDisplay: windContainer };
  }

  const createWindElements = () => {
    if (windContainer) {
      console.log("Wind container already exists", windContainer);
    }

    const container = windElement('Rectangle', undefined, {
      name: 'windContainer',
      height: "42px",
      width: "150px",
      background: "rgba(1,1,1,.3)",
      color: "transparent",
      thickness: 2,
      alpha: 1,
      left: pos.left || "50px",
      top: pos.top || "50px"
    });

    uInterface.addControl(container);

    //text
    let textProps = {
        name: "windText",
        color: "#CCCCCC",
        fontStyle: 'bold',
    }

    windElement('TextBlock', container, {...textProps, 
        name: "windTextShadow",
        color: "#333",
        top: "1",
        left: "-1"
    });

    windElement('TextBlock', container, textProps);

    setWindContainer(container);
    return container;
  }

  return { windDisplay: createWindElements() };
}

// Wrapper functions

function windElement(type:string, parent:GUI.Rectangle | undefined, properties:any, ...args:any){
  if(!type || !GUI[type as keyof typeof GUI]) return false;

  let result:any;

  switch (type) {
    case 'Rectangle':
      result = new GUI.Rectangle(...args);
      break;
    case 'TextBlock':
      result = new GUI.TextBlock(...args);
      break;
    case 'StackPanel':
      result = new GUI.StackPanel(...args);
      break;
  }

  if(typeof(properties) === 'object'){
      Object.keys(properties).forEach( key => {
          result[key] = properties[key];
      });
  }
  if(parent) parent.addControl(result);
  return result;
};
