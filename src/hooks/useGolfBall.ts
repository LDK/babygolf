// hooks/useGolfBall.ts

import { useEffect, useMemo } from "react";
import * as BABYLON from "@babylonjs/core";

export type GolfBallProps = {
  globalScale: number;
  scene?: BABYLON.Scene;
  physicsEnabled: boolean;
  loc?: BABYLON.Vector3;
  shadowGenerator?: BABYLON.ShadowGenerator;
  followerCamera?: BABYLON.FreeCamera;
  goalCallback?: () => void;
  stopCallback?: () => void;
  swingActive: boolean;
  shotReady?: boolean;
};

export const useGolfBall = ({ globalScale, scene, physicsEnabled, loc, shadowGenerator, swingActive, followerCamera, goalCallback, stopCallback, shotReady = true }: GolfBallProps) => {  
  const ballDiameter = 0.035 * globalScale;

  const thicknessDampingFactor = 0.95;
  const angularDampingFactor = 0.55;
  const maxDamping = 1;
  const minIncrement = 0.001;
  const speedThreshold = 0.335; // Threshold to stop the ball completely

  const wallBounceSound = useMemo(() => {
    if (scene) {
      const sound = new BABYLON.Sound("wallBounceSound", "/sounds/ball-wall-bounce.wav", scene);
      sound.setVolume(0.1);
      return sound;
    }
  }, [scene]);

  const golfBall = useMemo(() => {
    if (scene && physicsEnabled && loc) {
      console.log('Creating golf ball...');
      const existingBall = scene.getTransformNodeByName("golfBall-container");

      if (existingBall) {
        for (let child of existingBall.getChildMeshes()) {
          child.dispose();
        }
        existingBall.dispose();
      }

      const ball = BABYLON.MeshBuilder.CreateSphere("golfBall", { diameter: ballDiameter }, scene);

      const normalPath = "/golfBall_normal.png";
      const ballMaterial = new BABYLON.PBRMaterial("pbrBallMat", scene);
      ballMaterial.albedoColor = new BABYLON.Color3(1, 1, 1); // Bright white color
      ballMaterial.reflectivityColor = new BABYLON.Color3(1, 1, 1); // Reflectivity to add some shine
      ballMaterial.roughness = .5; // Lower roughness for a shinier appearance
      ballMaterial.metallic = 0.5; // Add some metallic properties
      ballMaterial.bumpTexture = new BABYLON.Texture(normalPath, scene); // Add a normal map for texture

      ball.material = ballMaterial;

      const empty = new BABYLON.TransformNode("golfBall-container", scene);
      ball.parent = empty;
      empty.position = loc || new BABYLON.Vector3(0, 350, 0);

      // console.log('loc', loc);

      return empty;
    }
  }, [scene, physicsEnabled, loc, ballDiameter]);
  
  const golfBallAggregate = useMemo(() => {
    if (golfBall) {
      // Add physics to the golf ball. It weighs 0.04593 kg (45.93 grams)
      const agg = new BABYLON.PhysicsAggregate(golfBall, BABYLON.PhysicsShapeType.SPHERE, { mass: 0.04593 * 100 * globalScale }, scene);
      agg.body.setCollisionCallbackEnabled(true);

      return agg;
    }
  }, [golfBall, globalScale, scene]);

  const golfBallObservable = useMemo(() => {
    if (golfBallAggregate) {
      return golfBallAggregate.body.getCollisionObservable();
    }
  }, [golfBallAggregate]);

  const bounceSoundVelocityThreshold = .6 * globalScale;

  // const playBounceSound = (velocity: number) => {
  //   if (wallBounceSound && velocity >= bounceSoundVelocityThreshold) {
  //     console.log('bounce', velocity);
  //     wallBounceSound.setVolume(Math.min(velocity / (10 * globalScale), 1));
  //     wallBounceSound.play();
  //   // } else if (wallBounceSound) {
  //   //     // console.log('quiet bounce', velocity);
  //   }
  // };

  const playBounceSound = useMemo(() => {
    if (wallBounceSound) {
      return (velocity: number) => {
        if (velocity >= bounceSoundVelocityThreshold) {
          // console.log('bounce', velocity);
          wallBounceSound.setVolume(Math.min(velocity / (10 * globalScale), 1));
          wallBounceSound.play();
        }
      };
    }
  }, [wallBounceSound, bounceSoundVelocityThreshold, globalScale]);

  /*const golfBallObserver = */ 
  useMemo(() => {
    if (golfBallObservable && golfBallAggregate) {
      return golfBallObservable.add((collision) => {
        const tNode = collision.collidedAgainst.transformNode as BABYLON.AbstractMesh;

        if (tNode.material?.metadata?.clear && collision.type === 'COLLISION_STARTED') {
          if (goalCallback) {
            goalCallback();
          }
        }

        if (
          collision.type === 'COLLISION_STARTED' &&
          (tNode.name.includes('Wall') || tNode.name.includes('Bricks') || tNode.name.includes('Border')) 
        ) {
          if (playBounceSound) {
            playBounceSound(golfBallAggregate.body.getLinearVelocity().length());
          }
        }

        const friction = tNode.material?.metadata?.friction || 0.2;
        const thickness = tNode.material?.metadata?.thickness || 0;  

        // console.log("Friction: ", friction, "Thickness: ", thickness);
        const linearDamping = golfBallAggregate.body.getLinearDamping();
        // console.log("Linear Damping: ", linearDamping);
        // Apply linear damping dynamically based on the thickness value
        golfBallAggregate.body.setLinearDamping(Math.min(Math.max(thickness * linearDamping * thicknessDampingFactor, linearDamping + minIncrement), maxDamping));

        // Apply angular damping based on the friction value
        golfBallAggregate.body.setAngularDamping(Math.min(friction * angularDampingFactor, 1));
      });
    }
  }, [golfBallObservable, golfBallAggregate, goalCallback, playBounceSound]);

  // Add the golf ball as a shadow caster
  useEffect(() => {
    if (shadowGenerator && golfBall) {
      shadowGenerator.addShadowCaster(golfBall.getChildMeshes()[0]);
      shadowGenerator.useBlurExponentialShadowMap = true; // Use a blurred shadow map for softer shadows
      shadowGenerator.blurScale = 2;
    }
  }, [golfBall, shadowGenerator]);

  useEffect(() => {
    if (scene && followerCamera && golfBall) {
      scene.registerBeforeRender(function () {
        if (!followerCamera || !golfBall) return;
        // Focus on golfBall
        followerCamera.position = BABYLON.Vector3.Lerp(followerCamera.position, new BABYLON.Vector3(golfBall.position.x + 50, golfBall.position.y + 100, golfBall.position.z - 50), 0.05);
        followerCamera.setTarget(golfBall.position);
      });
    }
  }, [scene, followerCamera, golfBall]);

  // Stop the ball completely if speed falls below a threshold
  useEffect(() => {
    if (scene && golfBallAggregate ) {
      if (!swingActive) return;

      scene.registerBeforeRender(() => {
        const velocity = golfBallAggregate.body.getLinearVelocity();
        const linearDamping = golfBallAggregate.body.getLinearDamping();
        // const angularDamping = golfBallAggregate.body.getAngularDamping();

        if ((velocity.length() < speedThreshold && velocity.length() >= 0) ||
            (linearDamping >= maxDamping && velocity.length() < .9)) {
          // console.log('Stopping ball...', velocity.length());
          golfBallAggregate.body.setLinearVelocity(BABYLON.Vector3.Zero());
          golfBallAggregate.body.setAngularVelocity(BABYLON.Vector3.Zero());

          if (stopCallback) {
            // console.log('Stopping callback...');
            stopCallback();
          }
        }
      });
    }
  }, [scene, golfBallAggregate, swingActive, stopCallback, globalScale]);

  return { golfBall, golfBallAggregate };
};
