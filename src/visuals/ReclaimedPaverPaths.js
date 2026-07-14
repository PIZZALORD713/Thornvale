import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { TOWN_LAYOUT, TOWN_PATH_PROFILES } from '../config/town.js';
import { sampleMoundHeight } from '../utils/terrain-surface.js';

const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const SURFACE_UP = new Vector3();
const BASIS = new Matrix4();
const LOCAL_TWIST = new Quaternion();

export const RECLAIMED_PAVER_COLORS = Object.freeze({
  'warm-brick': Object.freeze([0xb96f55, 0xc17a5d, 0xa9634f, 0xc98768]),
  'deep-clay': Object.freeze([0x8f594a, 0x9d6250, 0x7f554c]),
  'repair-stone': Object.freeze([0xcab7a1, 0xbfa991, 0xd3c3ad]),
});

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pathPoint(point) {
  if (Array.isArray(point) && point.length >= 3) {
    return new Vector3(
      Number(point[0]) || 0,
      Number(point[1]) || 0,
      Number(point[2]) || 0,
    );
  }
  return new Vector3(Number(point?.[0]) || 0, 0, Number(point?.[1]) || 0);
}

function createPathCurve(points) {
  return new CatmullRomCurve3(points.map(pathPoint), false, 'centripetal');
}

function pointInsidePlaza(point, plaza, margin = -0.08) {
  if (!plaza) return false;
  const radiusX = Math.max(0.001, (Number(plaza.radius) || 0) + margin);
  const radiusZ = radiusX * (Number(plaza.scaleZ) || 0.88);
  const dx = (point.x - (Number(plaza.x) || 0)) / radiusX;
  const dz = (point.z - (Number(plaza.z) || 0)) / radiusZ;
  return dx * dx + dz * dz < 1;
}

function pointInsideApron(point, apron, inset = 0) {
  const yaw = -(Number(apron.rotationY) || 0);
  const dx = point.x - (Number(apron.x) || 0);
  const dz = point.z - (Number(apron.z) || 0);
  const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  const localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
  return Math.abs(localX) < Math.max(0, Number(apron.width) * 0.5 - inset)
    && Math.abs(localZ) < Math.max(0, Number(apron.depth) * 0.5 - inset);
}

function chooseTone(random) {
  const value = random();
  if (value < 0.73) return 'warm-brick';
  if (value < 0.91) return 'deep-clay';
  return 'repair-stone';
}

function chooseColor(role, random) {
  const colors = RECLAIMED_PAVER_COLORS[role];
  return colors[Math.min(colors.length - 1, Math.floor(random() * colors.length))];
}

function orientationForTangent(tangent, twist = 0, normal = UP) {
  SURFACE_UP.copy(normal).normalize();
  FORWARD.copy(tangent).addScaledVector(
    SURFACE_UP,
    -tangent.dot(SURFACE_UP),
  ).normalize();
  if (FORWARD.lengthSq() < 0.001) FORWARD.set(0, 0, 1);
  RIGHT.crossVectors(SURFACE_UP, FORWARD).normalize();
  if (RIGHT.lengthSq() < 0.001) RIGHT.set(1, 0, 0);
  FORWARD.crossVectors(RIGHT, SURFACE_UP).normalize();
  BASIS.makeBasis(RIGHT, SURFACE_UP, FORWARD);
  const rotation = new Quaternion().setFromRotationMatrix(BASIS);
  if (twist !== 0) {
    LOCAL_TWIST.setFromAxisAngle(UP, twist);
    rotation.multiply(LOCAL_TWIST);
  }
  return rotation;
}

function placementKey(x, z) {
  return `${Math.round(x * 8)}:${Math.round(z * 8)}`;
}

function pointInsideMound(mound, x, z) {
  if (!mound) return false;
  const dx = (x - (Number(mound.x) || 0)) / Math.max(0.001, Number(mound.radiusX) || 1);
  const dz = (z - (Number(mound.z) || 0)) / Math.max(0.001, Number(mound.radiusZ) || 1);
  return dx * dx + dz * dz <= 1;
}

function sampleTownSurface(layout, x, z, fallbackY = 0) {
  const mound = layout.terrain?.bellHill;
  if (!pointInsideMound(mound, x, z)) return Number(fallbackY) || 0;
  return Math.max(0, sampleMoundHeight(mound, x, z));
}

function sampleTownSurfaceNormal(layout, x, z) {
  const epsilon = 0.2;
  const left = sampleTownSurface(layout, x - epsilon, z, 0);
  const right = sampleTownSurface(layout, x + epsilon, z, 0);
  const back = sampleTownSurface(layout, x, z - epsilon, 0);
  const front = sampleTownSurface(layout, x, z + epsilon, 0);
  return new Vector3(left - right, epsilon * 2, back - front).normalize();
}

function addPlacement(placements, occupied, {
  x,
  y,
  z,
  tangent,
  normal,
  width,
  length,
  thickness,
  toneRole,
  color,
  twist = 0,
  routeId,
  role = 'route',
}) {
  const occupancyKey = placementKey(x, z);
  if (occupied.has(occupancyKey)) return;
  occupied.add(occupancyKey);
  const positionY = y + thickness * 0.5 + 0.014;
  placements.push({
    x,
    y: positionY,
    z,
    width,
    length,
    thickness,
    bottomY: positionY - thickness * 0.5,
    quaternion: orientationForTangent(tangent, twist, normal),
    toneRole,
    color,
    routeId,
    role,
    occupancyKey,
  });
}

export function generateReclaimedPaverPlacements(layout = TOWN_LAYOUT) {
  const placements = [];
  const occupied = new Set();
  const aprons = layout.pathAprons || [];

  for (const route of layout.paths || []) {
    const profile = TOWN_PATH_PROFILES[route.profile];
    if (profile?.family !== 'reclaimed-pavers' || route.points?.length < 2) continue;
    const random = seededRandom(hashString(`reclaimed-pavers:${route.id}`));
    const curve = createPathCurve(route.points);
    const routeLength = Math.max(0.001, curve.getLength());
    const joint = profile.paverJoint;
    const rowPitch = profile.paverWidth + joint;
    const rowCount = Math.max(2, Math.floor((route.width + joint) / rowPitch));
    const outerRow = (row) => row === 0 || row === rowCount - 1;

    for (let row = 0; row < rowCount; row += 1) {
      const lateral = (row - (rowCount - 1) * 0.5) * rowPitch;
      const alongPitch = profile.paverLength + joint;
      const stagger = (row % 2) * alongPitch * 0.5;
      for (
        let distance = profile.paverLength * 0.5 + stagger;
        distance < routeLength - profile.paverLength * 0.2;
        distance += alongPitch
      ) {
        const t = Math.max(0, Math.min(1, distance / routeLength));
        const point = curve.getPointAt(t);
        if (pointInsidePlaza(point, layout.plaza)) continue;
        if (aprons.some((apron) => pointInsideApron(point, apron, profile.paverLength * 0.2))) {
          continue;
        }
        if (outerRow(row) && random() < profile.edgeOmission) continue;

        const tangent = curve.getTangentAt(t).normalize();
        const side = new Vector3(-tangent.z, 0, tangent.x).normalize();
        const lateralJitter = (random() - 0.5) * 0.035;
        const x = point.x + side.x * (lateral + lateralJitter);
        const z = point.z + side.z * (lateral + lateralJitter);
        const surfaceY = sampleTownSurface(layout, x, z, point.y);
        const width = profile.paverWidth * (0.92 + random() * 0.14);
        const length = profile.paverLength * (0.91 + random() * 0.16);
        const thickness = 0.072 + random() * 0.018;
        const toneRole = chooseTone(random);
        addPlacement(placements, occupied, {
          x,
          y: surfaceY,
          z,
          tangent,
          normal: sampleTownSurfaceNormal(layout, x, z),
          width,
          length,
          thickness,
          toneRole,
          color: chooseColor(toneRole, random),
          twist: (random() - 0.5) * 0.052,
          routeId: route.id,
        });
      }
    }
  }

  for (const apron of aprons) {
    const profile = TOWN_PATH_PROFILES[apron.profile];
    if (profile?.family !== 'reclaimed-pavers') continue;
    const random = seededRandom(hashString(`reclaimed-apron:${apron.id}`));
    const joint = profile.paverJoint;
    const columns = Math.max(2, Math.floor((apron.width + joint) / (profile.paverWidth + joint)));
    const rows = Math.max(2, Math.floor((apron.depth + joint) / (profile.paverLength + joint)));
    const yaw = Number(apron.rotationY) || 0;
    const tangent = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((row === 0 || row === rows - 1 || column === 0 || column === columns - 1)
          && random() < 0.045) continue;
        const along = (row - (rows - 1) * 0.5) * (profile.paverLength + joint);
        const across = (column - (columns - 1) * 0.5) * (profile.paverWidth + joint)
          + (row % 2 ? profile.paverWidth * 0.18 : 0);
        const toneRole = chooseTone(random);
        const x = apron.x + right.x * across + tangent.x * along;
        const z = apron.z + right.z * across + tangent.z * along;
        const surfaceY = sampleTownSurface(layout, x, z, apron.y);
        addPlacement(placements, occupied, {
          x,
          y: surfaceY,
          z,
          tangent,
          normal: sampleTownSurfaceNormal(layout, x, z),
          width: profile.paverWidth * (0.96 + random() * 0.08),
          length: profile.paverLength * (0.96 + random() * 0.08),
          thickness: 0.078 + random() * 0.012,
          toneRole,
          color: chooseColor(toneRole, random),
          twist: (random() - 0.5) * 0.025,
          routeId: apron.id,
          role: 'apron',
        });
      }
    }
  }

  return placements;
}

export function createChamferedPaverGeometry() {
  const positions = [
    -0.48, -0.5, -0.48, 0.48, -0.5, -0.48, 0.48, -0.5, 0.48, -0.48, -0.5, 0.48,
    -0.5, 0.16, -0.5, 0.5, 0.16, -0.5, 0.5, 0.16, 0.5, -0.5, 0.16, 0.5,
    -0.43, 0.5, -0.43, 0.43, 0.5, -0.43, 0.43, 0.5, 0.43, -0.43, 0.5, 0.43,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    0, 5, 1, 0, 4, 5,
    1, 6, 2, 1, 5, 6,
    2, 7, 3, 2, 6, 7,
    3, 4, 0, 3, 7, 4,
    4, 9, 5, 4, 8, 9,
    5, 10, 6, 5, 9, 10,
    6, 11, 7, 6, 10, 11,
    7, 8, 4, 7, 11, 8,
    8, 10, 9, 8, 11, 10,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createReclaimedPaverMesh(layout = TOWN_LAYOUT) {
  const placements = generateReclaimedPaverPlacements(layout);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
  });
  material.name = 'reclaimed_warm_paver_material';
  const mesh = new InstancedMesh(createChamferedPaverGeometry(), material, placements.length);
  mesh.name = 'reclaimed_warm_pavers';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.cameraCollision = false;
  mesh.userData.surfaceFamily = 'reclaimed-pavers';
  mesh.userData.routeIds = [...new Set(placements.map(({ routeId }) => routeId))];
  mesh.userData.minimumBottomY = placements.reduce(
    (minimum, placement) => Math.min(minimum, placement.bottomY),
    Number.POSITIVE_INFINITY,
  );
  mesh.userData.toneCounts = placements.reduce((counts, { toneRole }) => {
    counts[toneRole] = (counts[toneRole] || 0) + 1;
    return counts;
  }, {});

  const dummy = new Object3D();
  const color = new Color();
  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, placement.y, placement.z);
    dummy.quaternion.copy(placement.quaternion);
    dummy.scale.set(placement.width, placement.thickness, placement.length);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.setHex(placement.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
