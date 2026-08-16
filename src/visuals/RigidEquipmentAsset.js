import { Group, Mesh, Vector3 } from 'three';
import { bakeRigidTrait } from './FriendsiesTraitEchoes.js';

/** Bake one rigid fRiENDSiES hand trait into centered static equipment. */
export function prepareRigidEquipmentAsset(source, {
  name,
  label,
  longest,
  rotateY = 0,
  rotateZ = 0,
}) {
  const baked = bakeRigidTrait(source, label);
  const geometry = baked.geometry;
  if (rotateY) geometry.rotateY(rotateY);
  if (rotateZ) geometry.rotateZ(rotateZ);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new Vector3());
  const sourceLongest = Math.max(size.x, size.y, size.z);
  if (!(sourceLongest > 0)) throw new Error(`${label} has zero extent`);

  const scale = longest / sourceLongest;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const presentation = new Group();
  presentation.name = name;
  const mesh = new Mesh(geometry, baked.material);
  mesh.name = `${name}_mesh`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.cameraCollision = false;
  mesh.userData.physicsCollision = false;
  presentation.add(mesh);
  return presentation;
}
