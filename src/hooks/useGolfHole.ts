// hooks/useGolfHole.ts

import { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { WaterMaterial } from '@babylonjs/materials';

export type GolfHoleProps = {
  id: string;
  scene?: BABYLON.Scene;
  physicsEnabled: boolean;
  globalScale: number;
  golfBall?: BABYLON.TransformNode;
};

export const useGolfHole = ({ id, scene, physicsEnabled, globalScale }:GolfHoleProps) => {
  const [courseElements, setCourseElements] = useState<BABYLON.AbstractMesh[]>([]);
  const [teePosition, setTeePosition] = useState<BABYLON.Vector3>();
  const [camPosition, setCamPosition] = useState<BABYLON.Vector3>();
  const [camRotation, setCamRotation] = useState<BABYLON.Vector3>();

  const [markers, setMarkers] = useState<BABYLON.AbstractMesh[]>([]);

  if (!scene || !physicsEnabled) return { courseElements, teePosition, camPosition, camRotation };

  // Create a material for the terrain and add custom properties for thickness and friction
  const makeGrassMaterial = (name:string, thickness:number = 1.5, friction:number = 0.9, brightness:number = 0.8) => {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = new BABYLON.Color3(0.1, brightness, 0.1); // Green color for the terrain
    mat.specularColor = new BABYLON.Color3(0, 0, 0); // Remove shininess
    mat.roughness = 1; // Increase roughness to make it less reflective
    mat.metadata = { thickness: thickness, friction: friction }; // Custom properties to affect ball physics
    return mat;
  };

  // const shortGrassMaterial = makeGrassMaterial('shortGrassMaterial', 0.65, 0.75, 1);
  const fairwayGrassMaterial = makeGrassMaterial('grassMaterial', 1.3, 1, 0.5);
  const longGrassMaterial = makeGrassMaterial('longGrassMaterial', 2.2, 1, 0.45);
  // const roughMaterial = makeGrassMaterial('roughMaterial', 25, 8, 0.15);

  const loadElements = async () => {
    BABYLON.SceneLoader.ImportMesh("", "/golf_holes/", `${id}.glb`, scene, (meshes, a, b, c, tNodes) => {
      let tPos: BABYLON.Vector3;
      let cPos: BABYLON.Vector3;
      let cRot: BABYLON.Vector3;

      for (let tNode of tNodes) {
        switch (tNode.name) {
          case "Camera":
            cPos = tNode.position.clone();
            cPos.x = tNode.position.x * globalScale;
            cPos.y *= globalScale;
            cPos.z = tNode.position.z * globalScale;
            setCamPosition(cPos);

            cRot = tNode.rotation.clone();
            cRot.x = tNode.rotation.x;
            cRot.y = tNode.rotation.y;
            cRot.z = tNode.rotation.z;
            setCamRotation(cRot);

            break;
        }
      }

      for (let mesh of meshes) {
        switch (mesh.name) {
          case "__root__":
            mesh.position = new BABYLON.Vector3(0, 0, 0);
            mesh.scaling = new BABYLON.Vector3(globalScale, globalScale, globalScale);

            mesh.parent = null;
            break;
          
          case "Beach":
            const sandMaterial = new BABYLON.StandardMaterial("sand", scene);
            sandMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.2);
            sandMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            sandMaterial.roughness = 1;

            // use /textures/sand.jpg for the texture
            const sandTexture = new BABYLON.Texture("/textures/sand.jpg", scene);
            sandTexture.uScale = 10;
            sandTexture.vScale = 10;
            sandMaterial.diffuseTexture = sandTexture;
            sandMaterial.metadata = { thickness: 10, friction: 100 };

            mesh.receiveShadows = true;
            mesh.material = sandMaterial;

            break;


          case "Water":
          	// Water
            var water = new WaterMaterial("water", scene);
            water.bumpTexture = new BABYLON.Texture("/textures/waterbump.png", scene);
            
            // Water properties
            water.windForce = -15;
            water.waveHeight = .03;
            water.windDirection = new BABYLON.Vector2(1, 1);
            water.waterColor = (mesh.material as BABYLON.StandardMaterial)?.diffuseColor?.clone() || new BABYLON.Color3(0.1, 0.1, 0.6);
            water.colorBlendFactor = 0.3;
            water.bumpHeight = 0.05;
            water.waveLength = 0.1;
            
            // Add skybox, border and beach to the reflection and refraction
            // water.addToRenderList(skybox);
            // water.addToRenderList(ground);

            // mesh.material = water;

            if (mesh.material) {
              mesh.material.alpha = 0.6;
            }
            break;

          case "TeeMarker":
          case "GoalMarker":
            // markers.push(mesh);
            mesh.visibility = 0;
            const torus = BABYLON.MeshBuilder.CreateTorus("torus", { diameter: .5, thickness: .1 });
            torus.scaling = new BABYLON.Vector3(1, .001, 1).scale(globalScale);
        
            setMarkers([...markers, mesh]);
            break;

          case "Cup":
            mesh.material = longGrassMaterial;
            mesh.receiveShadows = true;

            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, scene);
            break;

          case "Grass":
            // mesh.material = shortGrassMaterial;
            if (mesh.material) {
              mesh.material.metadata = fairwayGrassMaterial.metadata;
            }
            mesh.receiveShadows = true;
            // mesh.dispose();

            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, scene);
            break;
          
          case "Camera":
            break;
          case "Plane":
          case "Clear":
            // mesh.dispose();
            if (mesh.material) {
              mesh.material.metadata = { clear: true };
            }

            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, scene);
            
            break;

          case "Tee":
            tPos = mesh.position.clone();
            tPos.x = mesh.position.z * globalScale;
            tPos.y *= globalScale;
            tPos.z = mesh.position.x * globalScale;
            // tPos = new BABYLON.Vector3(-153, 22, 4);
            setTeePosition(tPos);
            break;

          case "Loop":
            // mesh.position = new BABYLON.Vector3(0, 1.6125, .28);
            mesh.receiveShadows = true;
            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: .01 }, scene);
            // mesh.dispose();
            break;

          case "Bricks":
            mesh.receiveShadows = true;
            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: 10 }, scene);
            break;

          case "Border":
            mesh.receiveShadows = true;
            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: 10 }, scene);
            break;
        }
      };

      setCourseElements(meshes);
    });
  }
  
  if (!courseElements.length) {
    loadElements();
  } 
  
  return { courseElements, teePosition, camPosition, camRotation };

};
