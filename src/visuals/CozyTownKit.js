import {
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  BoxGeometry,
} from 'three';
import { getBuildingBounds, TOWN_LAYOUT } from '../config/town.js';

export const TOWN_PALETTE = {
  grass: 0x87bd72,
  grassLight: 0x9dce81,
  grassDark: 0x679c62,
  path: 0xffddb3,
  pathEdge: 0xf2be91,
  cream: 0xfff3dd,
  vanilla: 0xffe8b7,
  blush: 0xf5a9b8,
  pink: 0xee7f9d,
  coral: 0xef8a76,
  lavender: 0xb9a5db,
  periwinkle: 0x93a7df,
  mint: 0x9fd7bd,
  teal: 0x4f9f8f,
  cocoa: 0x815f58,
  darkCocoa: 0x5f4648,
  leaf: 0x4e9b62,
  leafLight: 0x75bd72,
  leafDark: 0x37784f,
  water: 0x7bd4d2,
  waterLight: 0xb8f1e5,
  glow: 0xffd77d,
  white: 0xfffbf4,
};

const shared = {
  materials: null,
  geometry: null,
};

function materials() {
  if (shared.materials) return shared.materials;

  const standard = (color, options = {}) => {
    const config = {
      color,
      roughness: options.roughness ?? 0.82,
      metalness: options.metalness ?? 0,
      flatShading: options.flatShading ?? false,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
    };
    if (options.side !== undefined) config.side = options.side;
    if (options.emissive !== undefined) config.emissive = options.emissive;
    if (options.emissiveIntensity !== undefined) {
      config.emissiveIntensity = options.emissiveIntensity;
    }
    return new MeshStandardMaterial(config);
  };

  shared.materials = {
    grass: standard(TOWN_PALETTE.grass, { roughness: 1 }),
    grassLight: standard(TOWN_PALETTE.grassLight, { roughness: 1 }),
    grassDark: standard(TOWN_PALETTE.grassDark, { roughness: 1 }),
    path: standard(TOWN_PALETTE.path, { roughness: 0.98 }),
    pathEdge: standard(TOWN_PALETTE.pathEdge, { roughness: 0.95 }),
    cream: standard(TOWN_PALETTE.cream),
    vanilla: standard(TOWN_PALETTE.vanilla),
    blush: standard(TOWN_PALETTE.blush),
    pink: standard(TOWN_PALETTE.pink),
    coral: standard(TOWN_PALETTE.coral),
    lavender: standard(TOWN_PALETTE.lavender),
    periwinkle: standard(TOWN_PALETTE.periwinkle),
    mint: standard(TOWN_PALETTE.mint),
    teal: standard(TOWN_PALETTE.teal),
    cocoa: standard(TOWN_PALETTE.cocoa, { roughness: 0.9 }),
    darkCocoa: standard(TOWN_PALETTE.darkCocoa, { roughness: 0.88 }),
    leaf: standard(TOWN_PALETTE.leaf, { roughness: 0.9, flatShading: true }),
    leafLight: standard(TOWN_PALETTE.leafLight, { roughness: 0.9, flatShading: true }),
    leafDark: standard(TOWN_PALETTE.leafDark, { roughness: 0.9, flatShading: true }),
    stone: standard(0xc9b8b2, { roughness: 1, flatShading: true }),
    stoneLight: standard(0xead7cb, { roughness: 1, flatShading: true }),
    gold: standard(0xe6ad55, { roughness: 0.42, metalness: 0.18 }),
    windowGlow: standard(0xffdc83, {
      roughness: 0.35,
      emissive: 0xffb956,
      emissiveIntensity: 0.18,
    }),
    smoke: standard(0xfff4ef, { transparent: true, opacity: 0.72, roughness: 1 }),
  };

  return shared.materials;
}

function geometry() {
  if (shared.geometry) return shared.geometry;
  shared.geometry = {
    trunk: new CylinderGeometry(0.16, 0.23, 1.55, 7),
    canopy: new IcosahedronGeometry(0.82, 1),
    rock: new IcosahedronGeometry(0.38, 1),
    flowerHead: new IcosahedronGeometry(0.105, 1),
    flowerStem: new CylinderGeometry(0.018, 0.026, 0.34, 5),
    mushroomStem: new CylinderGeometry(0.055, 0.07, 0.22, 7),
    mushroomCap: new SphereGeometry(0.15, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
  };
  return shared.geometry;
}

function decorate(object) {
  object.userData.cameraCollision = false;
  return object;
}

function shadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function seededRandom(seed = 713) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pointInsideBounds(x, z, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

function pointNearBuilding(x, z, layout, margin = 0) {
  return layout.buildings.some((building) => (
    pointInsideBounds(x, z, getBuildingBounds(building, margin))
  ));
}

function makeMesh(geo, material, {
  cast = true,
  receive = true,
  decorative = true,
  name = '',
} = {}) {
  const mesh = new Mesh(geo, material);
  mesh.name = name;
  if (decorative) decorate(mesh);
  return shadow(mesh, cast, receive);
}

export function createGroundDressing(animator, layout = TOWN_LAYOUT) {
  const mat = materials();
  // Keep the actual floor camera-collidable while decorative terrain opts out per child.
  const root = new Group();
  root.name = 'cozy_terrain_dressing';

  const meadow = makeMesh(new CircleGeometry(layout.meadowRadius, 80), mat.grass, {
    cast: false,
    decorative: false,
    name: 'cozy_terrain_surface',
  });
  meadow.userData.cameraCollision = true;
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = 0.012;
  root.add(meadow);

  const patchData = [
    [-22, -7, 10, 6.5, 0.05],
    [21, -11, 11, 7, -0.13],
    [-19, 19, 12, 6, 0.08],
    [21, 19, 9, 5.5, -0.08],
    [0, -27, 15, 5.5, 0],
  ];
  for (let i = 0; i < patchData.length; i += 1) {
    const [x, z, sx, sz, rotation] = patchData[i];
    const patch = makeMesh(
      new CircleGeometry(1, 32),
      i % 2 ? mat.grassDark : mat.grassLight,
      { cast: false, name: 'cozy_terrain_patch' },
    );
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rotation;
    patch.scale.set(sx, sz, 1);
    patch.position.set(x, 0.02 + i * 0.0005, z);
    root.add(patch);
  }

  const hillGeo = new SphereGeometry(1, 20, 12);
  const hillData = [
    [-35, -15, 10, 4.2, 8],
    [35, -12, 11, 4.6, 9],
    [-32, 26, 10, 4.1, 8],
    [33, 27, 12, 5, 9],
    [3, -38, 15, 5.2, 9],
  ];
  for (let i = 0; i < hillData.length; i += 1) {
    const [x, z, sx, sy, sz] = hillData[i];
    const hill = makeMesh(hillGeo, i % 2 ? mat.grassDark : mat.grassLight, {
      cast: false,
      name: 'cozy_terrain_hill',
    });
    hill.scale.set(sx, sy, sz);
    hill.position.set(x, -2.8, z);
    root.add(hill);
  }

  const grassTufts = [];
  const tuftGeo = new ConeGeometry(0.08, 0.32, 5);
  const random = seededRandom(1122);
  for (let attempt = 0; grassTufts.length < 64 && attempt < 240; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 12 + random() * (layout.meadowRadius - 4);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (pointNearBuilding(x, z, layout, 1.4)) continue;
    grassTufts.push(new Vector3(x, 0.17, z));
  }
  const tuftMesh = decorate(new InstancedMesh(tuftGeo, mat.leafDark, grassTufts.length));
  tuftMesh.name = 'particle_grass_tufts';
  const dummy = new Object3D();
  grassTufts.forEach((position, index) => {
    dummy.position.copy(position);
    const scale = 0.75 + random() * 0.65;
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    tuftMesh.setMatrixAt(index, dummy.matrix);
  });
  tuftMesh.instanceMatrix.needsUpdate = true;
  root.add(tuftMesh);

  return root;
}

function createRibbonGeometry(points, width) {
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal');
  const samples = curve.getPoints(Math.max(18, points.length * 10));
  const left = [];
  const right = [];

  for (let i = 0; i < samples.length; i += 1) {
    const previous = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const tangent = new Vector2(next.x - previous.x, next.z - previous.z).normalize();
    const normal = new Vector2(-tangent.y, tangent.x);
    const edgeNoise = Math.sin(i * 1.83) * 0.055 + Math.sin(i * 0.51) * 0.035;
    const halfWidth = width * 0.5 + edgeNoise;
    left.push(new Vector2(samples[i].x + normal.x * halfWidth, -(samples[i].z + normal.y * halfWidth)));
    right.push(new Vector2(samples[i].x - normal.x * halfWidth, -(samples[i].z - normal.y * halfWidth)));
  }

  const shape = new Shape();
  shape.moveTo(left[0].x, left[0].y);
  left.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  right.reverse().forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  const geo = new ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function createPathsAndPlaza(layout = TOWN_LAYOUT) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_paths_and_plaza';

  const routes = layout.paths;

  for (const route of routes) {
    const edge = makeMesh(createRibbonGeometry(route.points, route.width + 0.3), mat.pathEdge, {
      cast: false,
      name: 'cozy_path_edge',
    });
    edge.position.y = 0.033;
    root.add(edge);

    const path = makeMesh(createRibbonGeometry(route.points, route.width), mat.path, {
      cast: false,
      name: 'cozy_path',
    });
    path.position.y = 0.042;
    root.add(path);
  }

  const plazaEdge = makeMesh(new CircleGeometry(5.05, 48), mat.pathEdge, {
    cast: false,
    name: 'cozy_plaza_edge',
  });
  plazaEdge.rotation.x = -Math.PI / 2;
  plazaEdge.scale.z = 0.88;
  plazaEdge.position.set(layout.plaza.x, 0.034, layout.plaza.z);
  root.add(plazaEdge);

  const plaza = makeMesh(new CircleGeometry(4.72, 48), mat.path, {
    cast: false,
    name: 'cozy_plaza',
  });
  plaza.rotation.x = -Math.PI / 2;
  plaza.scale.z = 0.88;
  plaza.position.set(layout.plaza.x, 0.044, layout.plaza.z);
  root.add(plaza);

  const heart = new Shape();
  heart.moveTo(0, -0.52);
  heart.bezierCurveTo(-1.55, -1.45, -2.25, 0.45, -1.05, 1.15);
  heart.bezierCurveTo(-0.48, 1.5, 0, 1.1, 0, 0.72);
  heart.bezierCurveTo(0, 1.1, 0.48, 1.5, 1.05, 1.15);
  heart.bezierCurveTo(2.25, 0.45, 1.55, -1.45, 0, -0.52);
  const heartMesh = makeMesh(new ShapeGeometry(heart), mat.blush, {
    cast: false,
    name: 'cozy_plaza_heart',
  });
  heartMesh.rotation.x = -Math.PI / 2;
  heartMesh.rotation.z = Math.PI;
  heartMesh.scale.setScalar(0.68);
  heartMesh.position.set(layout.plaza.x, 0.056, layout.plaza.z);
  root.add(heartMesh);

  const pebbleGeo = new IcosahedronGeometry(0.11, 1);
  const pebbleCount = 34;
  const pebbles = decorate(new InstancedMesh(pebbleGeo, mat.stoneLight, pebbleCount));
  pebbles.name = 'particle_path_pebbles';
  const dummy = new Object3D();
  for (let i = 0; i < pebbleCount; i += 1) {
    const angle = (i / pebbleCount) * Math.PI * 2;
    dummy.position.set(
      layout.plaza.x + Math.cos(angle) * 4.45,
      0.11,
      layout.plaza.z + Math.sin(angle) * 3.88,
    );
    dummy.scale.set(1.25, 0.35, 0.85);
    dummy.rotation.y = angle;
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  root.add(pebbles);

  return root;
}

function createGableRoofGeometry(width, depth, height) {
  const halfWidth = width * 0.5;
  const halfDepth = depth * 0.5;
  const positions = new Float32Array([
    -halfWidth, 0, halfDepth,
    halfWidth, 0, halfDepth,
    0, height, halfDepth,
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    0, height, -halfDepth,
  ]);
  const indices = [
    0, 1, 2,
    5, 4, 3,
    0, 2, 5, 0, 5, 3,
    1, 4, 5, 1, 5, 2,
    0, 3, 4, 0, 4, 1,
  ];
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createWindow(windowMaterial, trimMaterial, shutterMaterial, frontSign = 1) {
  const root = decorate(new Group());
  const glass = makeMesh(new BoxGeometry(0.76, 0.76, 0.07), windowMaterial, {
    name: 'cozy_window_glow',
  });
  root.add(glass);

  const trimGeoV = new BoxGeometry(0.075, 0.94, 0.105);
  const trimGeoH = new BoxGeometry(0.94, 0.075, 0.105);
  for (const x of [-0.45, 0, 0.45]) {
    const bar = makeMesh(trimGeoV, trimMaterial, { name: 'cozy_window_trim' });
    bar.position.set(x, 0, 0.06 * frontSign);
    bar.scale.y = x === 0 ? 0.78 : 1;
    root.add(bar);
  }
  for (const y of [-0.45, 0, 0.45]) {
    const bar = makeMesh(trimGeoH, trimMaterial, { name: 'cozy_window_trim' });
    bar.position.set(0, y, 0.06 * frontSign);
    bar.scale.x = y === 0 ? 0.78 : 1;
    root.add(bar);
  }

  const shutterGeo = new BoxGeometry(0.25, 0.94, 0.1);
  for (const x of [-0.65, 0.65]) {
    const shutter = makeMesh(shutterGeo, shutterMaterial, { name: 'cozy_window_shutter' });
    shutter.position.set(x, 0, -0.01 * frontSign);
    shutter.rotation.y = x * 0.18 * frontSign;
    root.add(shutter);
  }

  return root;
}

function createFlowerBox(width, accentMaterial) {
  const mat = materials();
  const root = decorate(new Group());
  const box = makeMesh(new BoxGeometry(width, 0.22, 0.28), mat.cocoa, {
    name: 'particle_flower_box',
  });
  root.add(box);
  const random = seededRandom(Math.floor(width * 1000));
  for (let i = 0; i < 5; i += 1) {
    const stem = makeMesh(new CylinderGeometry(0.018, 0.025, 0.25, 5), mat.leafDark, {
      name: 'particle_flower_box_stem',
    });
    stem.position.set(-width * 0.36 + (i / 4) * width * 0.72, 0.2, 0);
    root.add(stem);
    const bloom = makeMesh(new IcosahedronGeometry(0.1, 1), i % 2 ? accentMaterial : mat.vanilla, {
      name: 'particle_flower_box_bloom',
    });
    bloom.position.copy(stem.position);
    bloom.position.y += 0.15 + random() * 0.08;
    root.add(bloom);
  }
  return root;
}

function createRoofDetails(data, roofHeight) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_roof_details';
  const roofWidth = data.size.x + 0.72;
  const roofDepth = data.size.z + 0.84;
  const halfWidth = roofWidth * 0.5;
  const slope = Math.atan2(roofHeight, halfWidth);
  const bandGeo = new BoxGeometry(0.11, 0.075, roofDepth + 0.04);
  const bandCount = Math.max(5, Math.round(roofWidth / 0.82));

  for (let index = 0; index < bandCount; index += 1) {
    const x = -halfWidth + 0.42 + (index / Math.max(1, bandCount - 1)) * (roofWidth - 0.84);
    if (Math.abs(x) < 0.18) continue;
    const band = makeMesh(bandGeo, mat.cream, { name: 'cozy_roof_seam' });
    band.position.set(
      x,
      data.size.y + roofHeight * (1 - Math.abs(x) / halfWidth) + 0.055,
      0,
    );
    band.rotation.z = x < 0 ? slope : -slope;
    root.add(band);
  }

  const ridge = makeMesh(
    new CylinderGeometry(0.13, 0.13, roofDepth + 0.14, 10),
    mat.cream,
    { name: 'cozy_roof_ridge' },
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = data.size.y + roofHeight + 0.065;
  root.add(ridge);
  return root;
}

function createCottageSign(data) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_shop_sign_' + data.id;

  const bracket = makeMesh(new TorusGeometry(0.32, 0.045, 7, 18, Math.PI * 1.15), mat.darkCocoa, {
    name: 'cozy_shop_sign_bracket',
  });
  bracket.rotation.z = Math.PI * 0.42;
  bracket.scale.y = 0.8;
  bracket.position.y = 0.38;
  root.add(bracket);

  const board = makeMesh(new BoxGeometry(0.82, 0.58, 0.13), data.roofMaterial, {
    name: 'cozy_shop_sign_board',
  });
  board.position.set(0.27, -0.02, 0);
  root.add(board);

  let icon;
  if (data.id === 'berry-bakery') {
    icon = makeMesh(new SphereGeometry(0.17, 12, 8), mat.vanilla, {
      name: 'cozy_sign_bread',
    });
    icon.scale.set(1.35, 0.72, 0.25);
  } else if (data.id === 'lavender-library') {
    icon = decorate(new Group());
    icon.name = 'cozy_sign_book';
    for (const x of [-0.09, 0.09]) {
      const page = makeMesh(new BoxGeometry(0.17, 0.25, 0.035), mat.vanilla, {
        name: 'cozy_sign_book_page',
      });
      page.position.x = x;
      page.rotation.z = -x * 0.65;
      icon.add(page);
    }
  } else if (data.id === 'mint-tea-house') {
    icon = makeMesh(new TorusGeometry(0.15, 0.045, 7, 16, Math.PI * 1.65), mat.vanilla, {
      name: 'cozy_sign_teacup',
    });
    icon.rotation.z = Math.PI * 0.15;
  } else {
    icon = decorate(new Group());
    icon.name = 'cozy_sign_letter';
    const envelope = makeMesh(new BoxGeometry(0.34, 0.23, 0.035), mat.vanilla, {
      name: 'cozy_sign_envelope',
    });
    const seal = makeMesh(new SphereGeometry(0.055, 9, 7), mat.blush, {
      name: 'cozy_sign_envelope_seal',
    });
    seal.position.z = 0.04;
    icon.add(envelope, seal);
  }
  icon.position.set(0.27, -0.02, data.frontSign * 0.085);
  root.add(icon);
  return root;
}

function createFenceRun(start, end, postCount = 4) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_cottage_fence';
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const centerX = (start.x + end.x) * 0.5;
  const centerZ = (start.z + end.z) * 0.5;

  for (let index = 0; index < postCount; index += 1) {
    const t = index / Math.max(1, postCount - 1);
    const post = makeMesh(new CylinderGeometry(0.065, 0.085, 0.92, 7), mat.cream, {
      name: 'cozy_fence_post',
    });
    post.position.set(start.x + dx * t, 0.46, start.z + dz * t);
    root.add(post);
  }
  for (const y of [0.34, 0.68]) {
    const rail = makeMesh(new BoxGeometry(0.09, 0.09, length), mat.cream, {
      name: 'cozy_fence_rail',
    });
    rail.position.set(centerX, y, centerZ);
    rail.rotation.y = angle;
    root.add(rail);
  }
  return root;
}

export function createCottagePlot(data, index, animator) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_cottage_plot_' + data.id;
  root.position.set(data.position.x, 0, data.position.z);

  const plotWidth = data.size.x * 0.5 + 1.65;
  const plotDepth = data.size.z * 0.5 + 1.5;
  const plot = makeMesh(new CircleGeometry(1, 44), index % 2 ? mat.grassLight : mat.grassDark, {
    cast: false,
    name: 'cozy_cottage_garden_plot',
  });
  plot.rotation.x = -Math.PI / 2;
  plot.scale.set(plotWidth, plotDepth, 1);
  plot.position.y = 0.024;
  root.add(plot);

  const edging = makeMesh(new RingGeometry(0.945, 1, 44), mat.pathEdge, {
    cast: false,
    name: 'cozy_cottage_plot_edge',
  });
  edging.rotation.x = -Math.PI / 2;
  edging.scale.set(plotWidth, plotDepth, 1);
  edging.position.y = 0.035;
  root.add(edging);

  const frontEdge = data.frontSign * (data.size.z * 0.5 + 1.35);
  for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
    const t = stepIndex / 3;
    const stone = makeMesh(new IcosahedronGeometry(0.31 - stepIndex * 0.018, 1), mat.stoneLight, {
      name: 'cozy_cottage_step_stone',
    });
    stone.scale.set(1.25, 0.23, 0.82);
    stone.position.set(
      Math.sin(index * 0.8 + stepIndex) * 0.09,
      0.1,
      data.frontSign * (data.size.z * 0.5 + 0.45 + t * 1.0),
    );
    stone.rotation.y = index * 0.21 + stepIndex * 0.16;
    root.add(stone);
  }

  const sideX = data.size.x * 0.5 + 1.05;
  const backZ = -data.frontSign * (data.size.z * 0.5 + 1.0);
  root.add(createFenceRun(
    { x: -sideX, z: backZ },
    { x: sideX, z: backZ },
    Math.max(4, Math.round(data.size.x / 1.5) + 1),
  ));
  root.add(createFenceRun(
    { x: -sideX, z: backZ },
    { x: -sideX, z: frontEdge * 0.45 },
    4,
  ));
  root.add(createFenceRun(
    { x: sideX, z: backZ },
    { x: sideX, z: frontEdge * 0.45 },
    4,
  ));

  const shrubPositions = [
    [-sideX + 0.2, frontEdge * 0.72],
    [sideX - 0.2, frontEdge * 0.72],
    [-sideX + 0.25, backZ + data.frontSign * 0.35],
    [sideX - 0.25, backZ + data.frontSign * 0.35],
  ];
  shrubPositions.forEach(([x, z], shrubIndex) => {
    const shrub = makeMesh(new IcosahedronGeometry(0.46, 1), shrubIndex % 2 ? mat.leaf : mat.leafLight, {
      name: 'particle_cottage_shrub',
    });
    shrub.scale.set(1.15, 0.8 + (shrubIndex % 2) * 0.15, 0.9);
    shrub.position.set(x, 0.35, z);
    shrub.rotation.y = shrubIndex * 0.9 + index;
    root.add(shrub);
    animator.registerSway(shrub, {
      speed: 0.38 + shrubIndex * 0.04,
      amount: 0.012,
      phase: index * 1.7 + shrubIndex,
    });
  });

  const bloomMaterial = [data.roofMaterial, data.doorMaterial, mat.vanilla][index % 3];
  for (const xSign of [-1, 1]) {
    for (let bloomIndex = 0; bloomIndex < 4; bloomIndex += 1) {
      const bloom = makeMesh(new IcosahedronGeometry(0.105, 1), bloomIndex % 2 ? bloomMaterial : mat.blush, {
        name: 'particle_cottage_garden_bloom',
      });
      bloom.position.set(
        xSign * (data.size.x * 0.5 + 0.55 + (bloomIndex % 2) * 0.24),
        0.24 + (bloomIndex % 2) * 0.08,
        data.frontSign * (0.35 + Math.floor(bloomIndex / 2) * 0.42),
      );
      root.add(bloom);
    }
  }
  return root;
}

export function createCottageAmbientDetails(data, index, animator) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_cottage_ambient_' + data.id;
  root.position.set(data.position.x, 0, data.position.z);

  const roofHeight = 1.55 + index * 0.08;
  const smoke = decorate(new Group());
  smoke.name = 'particle_chimney_smoke';
  smoke.position.set(
    -data.size.x * 0.27,
    data.size.y + roofHeight * 0.58 + 1.65,
    -data.frontSign * data.size.z * 0.18,
  );
  for (let puffIndex = 0; puffIndex < 4; puffIndex += 1) {
    const puff = makeMesh(
      new SphereGeometry(0.2 + puffIndex * 0.065, 10, 8),
      mat.smoke,
      {
        cast: false,
        receive: false,
        name: 'particle_smoke_puff',
      },
    );
    puff.position.set(
      puffIndex * 0.13,
      puffIndex * 0.4,
      Math.sin(puffIndex * 1.7) * 0.05,
    );
    smoke.add(puff);
  }
  root.add(smoke);
  animator.registerBob(smoke, {
    speed: 0.58 + index * 0.07,
    amount: 0.11,
    phase: index,
  });
  animator.registerSway(smoke, {
    speed: 0.46,
    amount: 0.075,
    phase: index * 1.7,
  });
  return root;
}

export function createCottage(data, index, animator) {
  const mat = materials();
  const root = new Group();
  root.name = 'cozy_cottage_' + data.id;
  root.position.set(data.position.x, 0, data.position.z);

  const wall = makeMesh(
    new BoxGeometry(data.size.x, data.size.y, data.size.z),
    data.wallMaterial,
    { decorative: false, name: 'building_mass_' + data.id },
  );
  wall.position.y = data.size.y * 0.5;
  root.add(wall);

  const foundation = makeMesh(
    new BoxGeometry(data.size.x + 0.28, 0.34, data.size.z + 0.28),
    mat.stoneLight,
    { name: 'cozy_cottage_foundation' },
  );
  foundation.position.y = 0.17;
  root.add(foundation);

  const roofHeight = 1.55 + index * 0.08;
  const roof = makeMesh(
    createGableRoofGeometry(data.size.x + 0.72, data.size.z + 0.84, roofHeight),
    data.roofMaterial,
    { decorative: false, name: 'building_roof_' + data.id },
  );
  roof.position.y = data.size.y;
  root.add(roof);
  root.add(createRoofDetails(data, roofHeight));

  const fasciaGeo = new CylinderGeometry(0.09, 0.09, data.size.z + 0.88, 10);
  for (const x of [-data.size.x * 0.5 - 0.34, data.size.x * 0.5 + 0.34]) {
    const fascia = makeMesh(fasciaGeo, mat.cream, { name: 'cozy_roof_fascia' });
    fascia.rotation.x = Math.PI / 2;
    fascia.position.set(x, data.size.y + 0.025, 0);
    root.add(fascia);
  }

  const cornerGeo = new CylinderGeometry(0.105, 0.13, data.size.y, 8);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const trim = makeMesh(cornerGeo, mat.cream, { name: 'cozy_cottage_corner_trim' });
      trim.position.set(
        x * (data.size.x * 0.5 - 0.03),
        data.size.y * 0.5,
        z * (data.size.z * 0.5 - 0.03),
      );
      root.add(trim);
    }
  }

  const wallBeamGeo = new BoxGeometry(data.size.x - 0.3, 0.12, 0.13);
  for (const sideSign of [-1, 1]) {
    for (const y of [0.58, data.size.y - 0.24]) {
      const beam = makeMesh(wallBeamGeo, mat.cream, { name: 'cozy_cottage_wall_beam' });
      beam.position.set(0, y, sideSign * (data.size.z * 0.5 + 0.072));
      root.add(beam);
    }
  }

  const frontZ = data.frontSign * (data.size.z * 0.5 + 0.065);
  const door = makeMesh(new BoxGeometry(0.92, 1.65, 0.12), data.doorMaterial, {
    name: 'cozy_cottage_door',
  });
  door.position.set(0, 0.94, frontZ);
  root.add(door);

  const doorTop = makeMesh(new SphereGeometry(0.46, 18, 10, 0, Math.PI, 0, Math.PI * 0.5), data.doorMaterial, {
    name: 'cozy_cottage_door_arch',
  });
  doorTop.rotation.z = Math.PI / 2;
  doorTop.scale.z = 0.13;
  doorTop.position.set(0, 1.76, frontZ);
  root.add(doorTop);

  const knob = makeMesh(new SphereGeometry(0.07, 10, 8), mat.gold, {
    name: 'cozy_door_knob',
  });
  knob.position.set(0.28, 1.0, frontZ + data.frontSign * 0.09);
  root.add(knob);

  const canopy = makeMesh(new BoxGeometry(1.68, 0.14, 0.92), data.roofMaterial, {
    name: 'cozy_door_canopy',
  });
  canopy.position.set(0, 2.02, frontZ + data.frontSign * 0.36);
  canopy.rotation.x = data.frontSign * 0.08;
  root.add(canopy);
  for (const x of [-0.66, 0.66]) {
    const bracket = makeMesh(new CylinderGeometry(0.035, 0.05, 0.48, 6), mat.cream, {
      name: 'cozy_door_canopy_bracket',
    });
    bracket.position.set(x, 1.82, frontZ + data.frontSign * 0.18);
    bracket.rotation.x = data.frontSign * 0.42;
    root.add(bracket);
  }

  const step = makeMesh(new CylinderGeometry(0.72, 0.82, 0.2, 12, 1, false, 0, Math.PI), mat.stoneLight, {
    name: 'cozy_door_step',
  });
  step.rotation.y = data.frontSign > 0 ? Math.PI / 2 : -Math.PI / 2;
  step.position.set(0, 0.1, data.frontSign * (data.size.z * 0.5 + 0.5));
  root.add(step);

  const sign = createCottageSign(data);
  sign.position.set(
    data.size.x * 0.29,
    Math.min(data.size.y - 0.55, 2.65),
    frontZ + data.frontSign * 0.22,
  );
  if (data.frontSign < 0) sign.rotation.y = Math.PI;
  root.add(sign);

  const wallLamp = decorate(new Group());
  wallLamp.name = 'cozy_cottage_wall_lamp';
  wallLamp.position.set(
    -data.size.x * 0.29,
    Math.min(data.size.y - 0.62, 2.3),
    frontZ + data.frontSign * 0.14,
  );
  const lampBack = makeMesh(new CylinderGeometry(0.075, 0.09, 0.42, 7), mat.darkCocoa, {
    name: 'cozy_cottage_wall_lamp_bracket',
  });
  lampBack.rotation.x = Math.PI / 2;
  const lampGlow = makeMesh(new SphereGeometry(0.16, 12, 9), mat.windowGlow, {
    name: 'cozy_cottage_wall_lamp_glow',
  });
  lampGlow.scale.set(0.8, 1.1, 0.8);
  lampGlow.position.z = data.frontSign * 0.2;
  wallLamp.add(lampBack, lampGlow);
  root.add(wallLamp);
  animator.registerSway(lampGlow, {
    speed: 0.62,
    amount: 0.018,
    phase: index * 0.7,
    axis: 'z',
  });

  const windowY = Math.min(2.15, data.size.y * 0.57);
  const windowX = Math.max(1.25, data.size.x * 0.29);
  for (const x of [-windowX, windowX]) {
    const window = createWindow(mat.windowGlow, mat.cream, data.roofMaterial, data.frontSign);
    window.position.set(x, windowY, frontZ);
    root.add(window);

    const flowerBox = createFlowerBox(1.08, data.roofMaterial);
    flowerBox.position.set(x, windowY - 0.57, frontZ + data.frontSign * 0.16);
    root.add(flowerBox);
  }

  const sideSign = -data.frontSign;
  for (const x of [-data.size.x * 0.27, data.size.x * 0.27]) {
    const backWindow = createWindow(mat.windowGlow, mat.cream, data.doorMaterial, sideSign);
    backWindow.scale.setScalar(0.78);
    backWindow.position.set(x, windowY, sideSign * (data.size.z * 0.5 + 0.06));
    root.add(backWindow);
  }

  const chimney = makeMesh(new BoxGeometry(0.48, 1.45, 0.52), mat.darkCocoa, {
    name: 'cozy_cottage_chimney',
  });
  chimney.position.set(-data.size.x * 0.27, data.size.y + roofHeight * 0.58, -data.frontSign * data.size.z * 0.18);
  root.add(chimney);
  const chimneyCap = makeMesh(new BoxGeometry(0.62, 0.16, 0.66), mat.cream, {
    name: 'cozy_cottage_chimney_cap',
  });
  chimneyCap.position.copy(chimney.position);
  chimneyCap.position.y += 0.74;
  root.add(chimneyCap);

  const puffGroup = decorate(new Group());
  puffGroup.name = 'particle_chimney_smoke';
  puffGroup.position.copy(chimney.position);
  puffGroup.position.y += 1.05;
  for (let i = 0; i < 3; i += 1) {
    const puff = makeMesh(new SphereGeometry(0.22 + i * 0.07, 10, 8), mat.smoke, {
      cast: false,
      receive: false,
      name: 'particle_smoke_puff',
    });
    puff.position.set(i * 0.14, i * 0.42, 0);
    puffGroup.add(puff);
  }
  root.add(puffGroup);
  animator.registerBob(puffGroup, { speed: 0.62 + index * 0.08, amount: 0.12, phase: index });
  animator.registerSway(puffGroup, { speed: 0.5, amount: 0.08, phase: index * 1.7 });

  const roofCharm = makeMesh(new SphereGeometry(0.18, 12, 9), mat.vanilla, {
    name: 'cozy_roof_charm',
  });
  roofCharm.position.set(0, data.size.y + roofHeight + 0.08, data.frontSign * (data.size.z * 0.5 + 0.18));
  root.add(roofCharm);

  return root;
}

export function createWelcomeGate(animator, layout = TOWN_LAYOUT) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_welcome_gate';
  root.position.set(layout.gate.x, layout.gate.y, layout.gate.z);

  for (const x of [-2.05, 2.05]) {
    const post = makeMesh(new CylinderGeometry(0.22, 0.3, 2.75, 10), mat.cream, {
      name: 'cozy_gate_post',
    });
    post.position.set(x, 1.38, 0);
    root.add(post);
    const cap = makeMesh(new SphereGeometry(0.34, 14, 10), mat.blush, {
      name: 'cozy_gate_post_cap',
    });
    cap.position.set(x, 2.83, 0);
    root.add(cap);
  }

  const archCurve = new CatmullRomCurve3([
    new Vector3(-2.05, 2.42, 0),
    new Vector3(-1.2, 3.45, 0),
    new Vector3(0, 3.78, 0),
    new Vector3(1.2, 3.45, 0),
    new Vector3(2.05, 2.42, 0),
  ]);
  const arch = makeMesh(new TubeGeometry(archCurve, 28, 0.17, 8, false), mat.cream, {
    name: 'cozy_gate_arch',
  });
  root.add(arch);

  const sign = makeMesh(new BoxGeometry(2.3, 0.66, 0.18), mat.cocoa, {
    name: 'cozy_gate_sign',
  });
  sign.position.set(0, 3.15, 0);
  root.add(sign);

  const heartShape = new Shape();
  heartShape.moveTo(0, -0.36);
  heartShape.bezierCurveTo(-0.9, -0.86, -1.18, 0.35, -0.5, 0.62);
  heartShape.bezierCurveTo(-0.2, 0.74, 0, 0.48, 0, 0.31);
  heartShape.bezierCurveTo(0, 0.48, 0.2, 0.74, 0.5, 0.62);
  heartShape.bezierCurveTo(1.18, 0.35, 0.9, -0.86, 0, -0.36);
  const signHeart = makeMesh(new ShapeGeometry(heartShape), mat.blush, {
    name: 'cozy_gate_heart',
  });
  signHeart.scale.setScalar(0.33);
  signHeart.position.set(0, 3.15, 0.101);
  root.add(signHeart);

  const leafGeo = new IcosahedronGeometry(0.23, 1);
  for (let i = 0; i < 12; i += 1) {
    const t = i / 11;
    const point = archCurve.getPoint(t);
    const leaf = makeMesh(leafGeo, i % 3 ? mat.leaf : mat.leafLight, {
      name: 'particle_gate_leaf',
    });
    leaf.scale.set(1.25, 0.65, 0.55);
    leaf.position.copy(point).add(new Vector3(0, Math.sin(i * 1.8) * 0.13, 0));
    leaf.rotation.z = t * Math.PI * 1.8;
    root.add(leaf);
  }

  animator.registerSway(sign, { speed: 0.6, amount: 0.018, phase: 0.4, axis: 'z' });
  return root;
}

export function getTownMaterials() {
  return materials();
}

function createTree(position, scale, index, animator) {
  const mat = materials();
  const geo = geometry();
  const root = decorate(new Group());
  root.name = 'particle_storybook_tree_' + index;
  root.position.copy(position);
  root.scale.setScalar(scale);

  const trunk = makeMesh(geo.trunk, mat.cocoa, {
    name: 'particle_tree_trunk',
  });
  trunk.position.y = 0.77;
  root.add(trunk);

  const canopyColors = [mat.leaf, mat.leafLight, mat.leafDark];
  const canopyData = [
    [0, 1.85, 0, 1.05],
    [-0.48, 1.72, 0.02, 0.72],
    [0.45, 1.75, 0.12, 0.76],
    [0.08, 2.32, -0.02, 0.7],
  ];
  canopyData.forEach(([x, y, z, size], canopyIndex) => {
    const canopy = makeMesh(geo.canopy, canopyColors[(index + canopyIndex) % canopyColors.length], {
      name: 'particle_tree_canopy',
    });
    canopy.position.set(x, y, z);
    canopy.scale.set(size * 1.05, size, size);
    canopy.rotation.set(index * 0.21, canopyIndex * 0.82, index * 0.08);
    root.add(canopy);
  });

  const fruitCount = index % 3 === 0 ? 5 : 3;
  for (let i = 0; i < fruitCount; i += 1) {
    const fruit = makeMesh(new SphereGeometry(0.105, 9, 7), i % 2 ? mat.blush : mat.vanilla, {
      name: 'particle_tree_fruit',
    });
    const angle = (i / fruitCount) * Math.PI * 2 + index;
    fruit.position.set(Math.cos(angle) * 0.62, 1.82 + (i % 2) * 0.36, Math.sin(angle) * 0.62);
    root.add(fruit);
  }

  animator.registerSway(root, {
    speed: 0.42 + (index % 4) * 0.06,
    amount: 0.012 + (index % 3) * 0.003,
    phase: index * 0.91,
  });
  return root;
}

function createFlowerInstances(animator, layout) {
  const mat = materials();
  const geo = geometry();
  const root = decorate(new Group());
  root.name = 'particle_wildflower_meadow';
  const random = seededRandom(713);
  const clusterData = [
    [-5.2, 13.4, 2.7, 14],
    [5.1, 13.1, 2.6, 14],
    [-10.2, 2.2, 2.7, 14],
    [10.6, 0.2, 2.9, 14],
    [-20.2, 15.8, 2.6, 14],
    [20.5, -8.5, 2.7, 14],
    [-20.5, -5, 2.4, 12],
    [25, 8.5, 2.5, 12],
  ];
  const positions = [];
  for (const [cx, cz, radius, count] of clusterData) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const spread = Math.sqrt(random()) * radius;
      const x = cx + Math.cos(angle) * spread;
      const z = cz + Math.sin(angle) * spread;
      if (pointNearBuilding(x, z, layout, 0.55)) continue;
      positions.push(new Vector3(x, 0, z));
    }
  }

  const stems = decorate(new InstancedMesh(geo.flowerStem, mat.leafDark, positions.length));
  stems.name = 'particle_flower_stems';
  const heads = decorate(new InstancedMesh(geo.flowerHead, mat.blush, positions.length));
  heads.name = 'particle_flower_heads';
  const colors = [
    new Color(TOWN_PALETTE.blush),
    new Color(TOWN_PALETTE.vanilla),
    new Color(TOWN_PALETTE.lavender),
    new Color(TOWN_PALETTE.coral),
    new Color(TOWN_PALETTE.white),
  ];
  const dummy = new Object3D();

  positions.forEach((position, index) => {
    const flowerScale = 0.78 + random() * 0.5;
    dummy.position.set(position.x, 0.17 * flowerScale, position.z);
    dummy.scale.set(flowerScale, flowerScale, flowerScale);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    stems.setMatrixAt(index, dummy.matrix);

    dummy.position.set(position.x, 0.38 * flowerScale, position.z);
    dummy.scale.setScalar(flowerScale);
    dummy.rotation.set(random() * 0.15, random() * Math.PI, random() * 0.15);
    dummy.updateMatrix();
    heads.setMatrixAt(index, dummy.matrix);
    heads.setColorAt(index, colors[index % colors.length]);
  });
  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  root.add(stems, heads);
  return root;
}

function createMushroomInstances() {
  const mat = materials();
  const geo = geometry();
  const root = decorate(new Group());
  root.name = 'particle_mushroom_patches';
  const random = seededRandom(404);
  const positions = [
    [-21.3, -2.5], [-22.1, -1.9], [-20.8, -1.4],
    [22.2, -11.6], [23.1, -11.9], [22.8, -10.8],
    [-20.7, 21.7], [-21.5, 22.2], [-20.3, 22.8],
    [28.6, 14.6], [29.2, 15.3], [28.1, 15.5],
    [2.9, -22.2], [3.7, -22.6], [4.2, -21.8],
  ];
  const stems = decorate(new InstancedMesh(geo.mushroomStem, mat.cream, positions.length));
  stems.name = 'particle_mushroom_stems';
  const caps = decorate(new InstancedMesh(geo.mushroomCap, mat.coral, positions.length));
  caps.name = 'particle_mushroom_caps';
  const capColors = [
    new Color(TOWN_PALETTE.coral),
    new Color(TOWN_PALETTE.blush),
    new Color(TOWN_PALETTE.lavender),
  ];
  const dummy = new Object3D();

  positions.forEach(([x, z], index) => {
    const scale = 0.72 + random() * 0.55;
    dummy.position.set(x, 0.11 * scale, z);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    stems.setMatrixAt(index, dummy.matrix);
    dummy.position.y = 0.2 * scale;
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    caps.setMatrixAt(index, dummy.matrix);
    caps.setColorAt(index, capColors[index % capColors.length]);
  });
  stems.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  root.add(stems, caps);
  return root;
}

function createRockInstances(layout) {
  const mat = materials();
  const geo = geometry();
  const random = seededRandom(9001);
  const root = decorate(new Group());
  root.name = 'particle_rock_accents';
  const positions = [];
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2 + (random() - 0.5) * 0.2;
    const radius = layout.meadowRadius - 11 + random() * 7;
    positions.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  const rocks = decorate(new InstancedMesh(geo.rock, mat.stone, positions.length));
  rocks.name = 'particle_rocks';
  const dummy = new Object3D();
  positions.forEach(([x, z], index) => {
    const scale = 0.45 + random() * 0.8;
    dummy.position.set(x, 0.15 * scale, z);
    dummy.scale.set(scale * 1.25, scale * 0.7, scale);
    dummy.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.25);
    dummy.updateMatrix();
    rocks.setMatrixAt(index, dummy.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  root.add(rocks);
  return root;
}

export function createNature(animator, layout = TOWN_LAYOUT) {
  const root = decorate(new Group());
  root.name = 'cozy_nature';
  const treeData = [
    [-24, -11, 1.25], [-28, -1, 1.5], [-26, 11, 1.18], [-21, 24, 1.42],
    [-10, 28, 1.18], [6, 28, 1.35], [19, 25, 1.24], [30, 16, 1.5],
    [30, 1, 1.25], [25, -14, 1.46], [15, -24, 1.2], [0, -29, 1.4],
    [-17, -25, 1.3], [-9.5, 9.5, 0.85], [9.5, -0.8, 0.92],
    [-23, 7, 1.05], [24, 18, 1.12], [22, -3, 0.95], [-6, -21, 1.05],
  ];
  treeData.forEach(([x, z, scale], index) => {
    if (pointNearBuilding(x, z, layout, 1.8)) return;
    root.add(createTree(new Vector3(x, 0, z), scale, index, animator));
  });
  root.add(createFlowerInstances(animator, layout));
  root.add(createMushroomInstances());
  root.add(createRockInstances(layout));
  return root;
}

function createLilyPad(size, colorMaterial) {
  const padShape = new Shape();
  padShape.absarc(0, 0, size, 0.25, Math.PI * 2 - 0.25, false);
  padShape.lineTo(0, 0);
  padShape.closePath();
  const pad = makeMesh(new ShapeGeometry(padShape), colorMaterial, {
    cast: false,
    name: 'particle_lily_pad',
  });
  pad.rotation.x = -Math.PI / 2;
  return pad;
}

export function createPond(animator, layout = TOWN_LAYOUT) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_pond';
  root.position.set(layout.pond.x, layout.pond.y, layout.pond.z);

  const bank = makeMesh(new CircleGeometry(4.15, 48), mat.pathEdge, {
    cast: false,
    name: 'cozy_pond_bank',
  });
  bank.rotation.x = -Math.PI / 2;
  bank.scale.z = 0.74;
  bank.position.y = 0.028;
  root.add(bank);

  const innerBank = makeMesh(new CircleGeometry(3.82, 48), mat.grassLight, {
    cast: false,
    name: 'cozy_pond_inner_bank',
  });
  innerBank.rotation.x = -Math.PI / 2;
  innerBank.scale.z = 0.74;
  innerBank.position.y = 0.037;
  root.add(innerBank);

  const waterMaterial = new MeshPhysicalMaterial({
    color: TOWN_PALETTE.water,
    emissive: 0x2d8f94,
    emissiveIntensity: 0.08,
    roughness: 0.2,
    metalness: 0.02,
    transparent: true,
    opacity: 0.88,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    side: DoubleSide,
  });
  const water = makeMesh(new CircleGeometry(3.55, 64), waterMaterial, {
    cast: false,
    name: 'particle_pond_water',
  });
  water.rotation.x = -Math.PI / 2;
  water.scale.z = 0.74;
  water.position.y = 0.065;
  root.add(water);

  const rim = makeMesh(new TorusGeometry(3.66, 0.1, 8, 64), mat.stoneLight, {
    name: 'particle_pond_rim',
  });
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.74;
  rim.position.y = 0.075;
  root.add(rim);

  const lilyData = [
    [-1.45, -0.55, 0.46], [0.5, 1.05, 0.38], [1.65, -0.7, 0.52],
    [-0.25, -1.15, 0.32], [1.95, 0.45, 0.3],
  ];
  lilyData.forEach(([x, z, size], index) => {
    const pad = createLilyPad(size, index % 2 ? mat.leaf : mat.leafLight);
    pad.position.set(x, 0.084, z * 0.74);
    pad.rotation.z = index * 1.31;
    root.add(pad);
    animator.registerBob(pad, { speed: 0.7 + index * 0.06, amount: 0.014, phase: index });
    if (index === 1 || index === 3) {
      const bloom = makeMesh(new SphereGeometry(0.13, 10, 8), mat.blush, {
        name: 'particle_lily_bloom',
      });
      bloom.scale.y = 0.65;
      bloom.position.set(x, 0.19, z * 0.74);
      root.add(bloom);
      animator.registerBob(bloom, { speed: 0.7 + index * 0.06, amount: 0.014, phase: index });
    }
  });

  for (let i = 0; i < 3; i += 1) {
    const ringMaterial = new MeshBasicMaterial({
      color: TOWN_PALETTE.waterLight,
      transparent: true,
      opacity: 0.42,
      side: DoubleSide,
      depthWrite: false,
    });
    const ring = makeMesh(new RingGeometry(0.36, 0.41, 32), ringMaterial, {
      cast: false,
      receive: false,
      name: 'particle_water_ripple',
    });
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-0.8 + i * 0.9, 0.098, 0.35 - i * 0.4);
    root.add(ring);
    animator.add((time) => {
      const cycle = (time * 0.22 + i / 3) % 1;
      const scale = 0.65 + cycle * 2.2;
      ring.scale.set(scale, scale, scale);
      ringMaterial.opacity = (1 - cycle) * 0.42;
    });
  }

  const reeds = decorate(new Group());
  reeds.name = 'particle_pond_reeds';
  for (let i = 0; i < 11; i += 1) {
    const angle = -0.7 + i * 0.13;
    const reed = makeMesh(new CylinderGeometry(0.018, 0.026, 0.75 + (i % 3) * 0.12, 5), mat.leafDark, {
      name: 'particle_pond_reed',
    });
    reed.position.set(Math.cos(angle) * 3.25, 0.38, Math.sin(angle) * 2.35);
    reed.rotation.z = (i - 5) * 0.012;
    reeds.add(reed);
  }
  root.add(reeds);
  animator.registerSway(reeds, { speed: 0.8, amount: 0.035, phase: 1.2 });

  animator.add((time, _dt, state) => {
    waterMaterial.opacity = 0.85 + Math.sin(time * 0.75) * 0.025;
    waterMaterial.emissiveIntensity = 0.06 + state.nightMix * 0.28;
    water.rotation.z = Math.sin(time * 0.22) * 0.008;
  });

  return root;
}

function createLantern(position, index) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_lantern_' + index;
  root.position.copy(position);

  const base = makeMesh(new CylinderGeometry(0.2, 0.3, 0.18, 10), mat.stone, {
    name: 'cozy_lantern_base',
  });
  base.position.y = 0.09;
  root.add(base);
  const post = makeMesh(new CylinderGeometry(0.055, 0.08, 2.15, 8), mat.cocoa, {
    name: 'cozy_lantern_post',
  });
  post.position.y = 1.15;
  root.add(post);
  const hook = makeMesh(new TorusGeometry(0.28, 0.045, 7, 18, Math.PI * 1.25), mat.cocoa, {
    name: 'cozy_lantern_hook',
  });
  hook.rotation.z = -Math.PI * 0.12;
  hook.position.set(0.21, 2.15, 0);
  root.add(hook);
  const lamp = makeMesh(new SphereGeometry(0.22, 12, 9), mat.windowGlow, {
    name: 'cozy_lantern_glow',
  });
  lamp.scale.set(0.78, 1.2, 0.78);
  lamp.position.set(0.42, 2.0, 0);
  root.add(lamp);
  const cap = makeMesh(new ConeGeometry(0.29, 0.22, 8), mat.blush, {
    name: 'cozy_lantern_cap',
  });
  cap.position.set(0.42, 2.28, 0);
  root.add(cap);

  const light = new PointLight(TOWN_PALETTE.glow, 0, 5.8, 2);
  light.position.copy(lamp.position);
  light.castShadow = false;
  root.add(light);
  return { root, light };
}

function createBench(position, rotation) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_plaza_bench';
  root.position.copy(position);
  root.rotation.y = rotation;

  const seat = makeMesh(new BoxGeometry(2.25, 0.18, 0.65), mat.cocoa, {
    name: 'cozy_bench_seat',
  });
  seat.position.y = 0.68;
  root.add(seat);
  const back = makeMesh(new BoxGeometry(2.25, 0.68, 0.16), mat.blush, {
    name: 'cozy_bench_back',
  });
  back.position.set(0, 1.08, -0.24);
  back.rotation.x = -0.08;
  root.add(back);
  for (const x of [-0.85, 0.85]) {
    const leg = makeMesh(new CylinderGeometry(0.075, 0.09, 0.7, 7), mat.darkCocoa, {
      name: 'cozy_bench_leg',
    });
    leg.position.set(x, 0.34, 0);
    root.add(leg);
  }
  for (const x of [-0.5, 0.5]) {
    const button = makeMesh(new SphereGeometry(0.075, 9, 7), mat.vanilla, {
      name: 'cozy_bench_button',
    });
    button.position.set(x, 1.12, -0.34);
    root.add(button);
  }
  return root;
}

export function createPlazaFurniture(animator, layout = TOWN_LAYOUT) {
  const root = decorate(new Group());
  root.name = 'cozy_plaza_furniture';
  const px = layout.plaza.x;
  const pz = layout.plaza.z;
  const lanternPositions = [
    new Vector3(px - 4.9, 0, pz - 2.4),
    new Vector3(px + 4.9, 0, pz - 2.4),
    new Vector3(px - 4.6, 0, pz + 3.6),
    new Vector3(px + 4.6, 0, pz + 3.6),
    new Vector3(-8.3, 0, -3.7),
    new Vector3(8.1, 0, -4.4),
    new Vector3(-7.5, 0, 7.7),
    new Vector3(7.6, 0, 7.3),
  ];
  const lights = [];
  lanternPositions.forEach((position, index) => {
    const { root: lantern, light } = createLantern(position, index);
    root.add(lantern);
    lights.push(light);
    animator.registerSway(lantern.children.find((child) => child.name === 'cozy_lantern_glow'), {
      speed: 0.7,
      amount: 0.02,
      phase: index,
      axis: 'z',
    });
  });
  animator.registerGlow(materials().windowGlow, lights, {
    dayIntensity: 0.16,
    nightIntensity: 2.8,
    lightIntensity: 0.82,
    pulse: 0.065,
  });

  root.add(createBench(new Vector3(px - 5.1, 0, pz + 0.4), -Math.PI / 2));
  root.add(createBench(new Vector3(px + 5.1, 0, pz + 0.4), Math.PI / 2));
  root.add(createBench(new Vector3(px, 0, pz - 4.45), 0));
  return root;
}

export function createLedgerLandmark(animator, layout = TOWN_LAYOUT) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_community_ledger';
  root.position.set(
    layout.landmarks.ledger.x,
    0,
    layout.landmarks.ledger.z,
  );

  for (const x of [-0.72, 0.72]) {
    const post = makeMesh(new CylinderGeometry(0.1, 0.14, 1.6, 8), mat.cocoa, {
      name: 'cozy_ledger_post',
    });
    post.position.set(x, 0.8, 0);
    root.add(post);
  }
  const board = makeMesh(new BoxGeometry(1.8, 1.05, 0.16), mat.cream, {
    name: 'cozy_ledger_board',
  });
  board.position.y = 1.35;
  root.add(board);
  const border = makeMesh(new BoxGeometry(2.04, 1.29, 0.1), mat.blush, {
    name: 'cozy_ledger_border',
  });
  border.position.set(0, 1.35, -0.08);
  root.add(border);
  board.position.z = 0.025;

  const paperMaterial = new MeshStandardMaterial({
    color: TOWN_PALETTE.white,
    roughness: 0.9,
    emissive: 0xffdcb8,
    emissiveIntensity: 0.08,
  });
  const noteData = [
    [-0.47, 1.52, 0.33, 0.42, -0.12],
    [0, 1.26, 0.38, 0.48, 0.06],
    [0.5, 1.48, 0.32, 0.4, 0.13],
  ];
  noteData.forEach(([x, y, w, h, rotation], index) => {
    const note = makeMesh(new PlaneGeometry(w, h), index === 1 ? mat.vanilla : paperMaterial, {
      name: 'cozy_ledger_note',
    });
    note.position.set(x, y, 0.112);
    note.rotation.z = rotation;
    root.add(note);
  });

  const roof = makeMesh(new ConeGeometry(1.35, 0.58, 4), mat.lavender, {
    name: 'cozy_ledger_roof',
  });
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.62;
  roof.position.y = 2.08;
  root.add(roof);
  const sparkle = makeMesh(new SphereGeometry(0.1, 10, 8), mat.windowGlow, {
    name: 'cozy_ledger_sparkle',
  });
  sparkle.position.set(0, 1.42, 0.19);
  root.add(sparkle);
  animator.registerBob(sparkle, { speed: 1.25, amount: 0.055, phase: 0.3 });
  return root;
}

export function createBellLandmark(animator, layout = TOWN_LAYOUT) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'cozy_town_bell';
  root.position.set(
    layout.landmarks.bell.x,
    0,
    layout.landmarks.bell.z,
  );

  const base = makeMesh(new CylinderGeometry(0.75, 0.9, 0.28, 12), mat.stoneLight, {
    name: 'cozy_bell_base',
  });
  base.position.y = 0.14;
  root.add(base);
  for (const x of [-0.56, 0.56]) {
    const post = makeMesh(new CylinderGeometry(0.09, 0.13, 2.0, 8), mat.cream, {
      name: 'cozy_bell_post',
    });
    post.position.set(x, 1.16, 0);
    root.add(post);
  }
  const crossbar = makeMesh(new CylinderGeometry(0.1, 0.1, 1.36, 8), mat.cream, {
    name: 'cozy_bell_crossbar',
  });
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.y = 2.08;
  root.add(crossbar);

  const bellPivot = decorate(new Group());
  bellPivot.name = 'particle_bell_pivot';
  bellPivot.position.y = 1.92;
  const bell = makeMesh(new ConeGeometry(0.43, 0.72, 16, 1, true), mat.gold, {
    name: 'cozy_bell_bowl',
  });
  bell.position.y = -0.35;
  bellPivot.add(bell);
  const rim = makeMesh(new TorusGeometry(0.43, 0.065, 8, 20), mat.gold, {
    name: 'cozy_bell_rim',
  });
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.7;
  bellPivot.add(rim);
  const clapper = makeMesh(new SphereGeometry(0.09, 10, 8), mat.darkCocoa, {
    name: 'cozy_bell_clapper',
  });
  clapper.position.y = -0.78;
  bellPivot.add(clapper);
  root.add(bellPivot);

  const bow = makeMesh(new TorusGeometry(0.26, 0.07, 7, 16, Math.PI * 1.5), mat.blush, {
    name: 'cozy_bell_bow',
  });
  bow.rotation.z = Math.PI * 0.25;
  bow.position.set(0, 2.33, 0.05);
  root.add(bow);

  let ringImpulse = 0;
  animator.ringBell = () => {
    ringImpulse = 1;
  };
  animator.add((time, dt) => {
    ringImpulse = MathUtils.damp(ringImpulse, 0, 2.7, dt);
    const idleSwing = Math.sin(time * 0.86 + 0.6) * 0.035;
    const ringing = Math.sin(time * 18.5) * 0.42 * ringImpulse;
    bellPivot.rotation.z = idleSwing + ringing;
  });
  return root;
}

function createCloud(position, scale, index, animator, cloudMaterial) {
  const root = decorate(new Group());
  root.name = 'particle_cloud_' + index;
  root.position.copy(position);
  root.scale.setScalar(scale);
  const puffData = [
    [-1.2, 0, 0, 0.85],
    [-0.5, 0.25, 0.05, 1.05],
    [0.3, 0.32, 0, 1.2],
    [1.2, 0.05, 0.03, 0.88],
    [0.38, -0.12, 0.06, 0.95],
  ];
  puffData.forEach(([x, y, z, size], puffIndex) => {
    const puff = makeMesh(new SphereGeometry(0.72, 14, 10), cloudMaterial, {
      cast: false,
      receive: false,
      name: 'particle_cloud_puff',
    });
    puff.position.set(x, y, z);
    puff.scale.set(size * 1.2, size * 0.72, size);
    root.add(puff);
    animator.registerBob(puff, {
      speed: 0.24 + puffIndex * 0.025,
      amount: 0.035 + puffIndex * 0.004,
      phase: index + puffIndex,
    });
  });
  animator.registerCloud(root, {
    speed: 0.18 + index * 0.055,
    minX: -34 - index * 4,
    maxX: 34 + index * 4,
  });
  return root;
}

function createFireflies(animator, layout) {
  const count = 58;
  const random = seededRandom(1618);
  const positions = new Float32Array(count * 3);
  const origins = [];
  const phases = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 3.5 + random() * Math.min(22, layout.meadowRadius - 8);
    const origin = new Vector3(
      Math.cos(angle) * radius,
      0.55 + random() * 2.35,
      1.5 + Math.sin(angle) * radius,
    );
    origins.push(origin);
    phases.push(random() * Math.PI * 2);
    positions[i * 3] = origin.x;
    positions[i * 3 + 1] = origin.y;
    positions[i * 3 + 2] = origin.z;
  }
  const fireflyGeo = new BufferGeometry();
  fireflyGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const fireflyMaterial = new PointsMaterial({
    color: TOWN_PALETTE.glow,
    size: 0.15,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const fireflies = decorate(new Points(fireflyGeo, fireflyMaterial));
  fireflies.name = 'particle_fireflies';

  animator.add((time, _dt, state) => {
    for (let i = 0; i < count; i += 1) {
      const origin = origins[i];
      const phase = phases[i];
      positions[i * 3] = origin.x + Math.sin(time * 0.52 + phase) * 0.5;
      positions[i * 3 + 1] = origin.y + Math.sin(time * 0.9 + phase * 1.7) * 0.28;
      positions[i * 3 + 2] = origin.z + Math.cos(time * 0.47 + phase) * 0.5;
    }
    fireflyGeo.attributes.position.needsUpdate = true;
    fireflyMaterial.opacity = state.nightMix * (0.58 + Math.sin(time * 2.1) * 0.16);
  });
  return fireflies;
}

function createPetalDrift(animator, layout) {
  const count = 58;
  const random = seededRandom(228);
  const positions = new Float32Array(count * 3);
  const speeds = [];
  const phases = [];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = -layout.meadowRadius * 0.72 + random() * layout.meadowRadius * 1.44;
    positions[i * 3 + 1] = 1 + random() * 8;
    positions[i * 3 + 2] = -layout.meadowRadius * 0.62 + random() * layout.meadowRadius * 1.32;
    speeds.push(0.16 + random() * 0.24);
    phases.push(random() * Math.PI * 2);
  }
  const petalGeo = new BufferGeometry();
  petalGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const petalMaterial = new PointsMaterial({
    color: TOWN_PALETTE.blush,
    size: 0.14,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const petals = decorate(new Points(petalGeo, petalMaterial));
  petals.name = 'particle_floating_petals';

  animator.add((time, dt, state) => {
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] += Math.sin(time * 0.45 + phases[i]) * dt * 0.22;
      positions[i * 3 + 1] -= speeds[i] * dt;
      positions[i * 3 + 2] += Math.cos(time * 0.38 + phases[i]) * dt * 0.18;
      if (positions[i * 3 + 1] < 0.2) {
        positions[i * 3 + 1] = 6 + (i % 5) * 0.65;
      }
    }
    petalGeo.attributes.position.needsUpdate = true;
    petalMaterial.opacity = 0.7 - state.nightMix * 0.28;
  });
  return petals;
}

function createButterflies(animator) {
  const mat = materials();
  const root = decorate(new Group());
  root.name = 'particle_butterflies';
  const wingMaterials = [
    new MeshBasicMaterial({ color: TOWN_PALETTE.blush, side: DoubleSide }),
    new MeshBasicMaterial({ color: TOWN_PALETTE.lavender, side: DoubleSide }),
    new MeshBasicMaterial({ color: TOWN_PALETTE.vanilla, side: DoubleSide }),
  ];
  const centers = [
    [-5.5, 1.3, 10.5],
    [5.1, 1.5, 11.2],
    [-9.5, 1.2, 3.8],
    [9.5, 1.45, -0.3],
    [4.5, 1.35, -8.8],
    [-5, 1.6, -9.5],
  ];
  centers.forEach(([x, y, z], index) => {
    const butterfly = decorate(new Group());
    butterfly.name = 'particle_butterfly_' + index;
    butterfly.position.set(x, y, z);
    const body = makeMesh(new CylinderGeometry(0.025, 0.035, 0.32, 6), mat.darkCocoa, {
      cast: false,
      receive: false,
      name: 'particle_butterfly_body',
    });
    body.rotation.x = Math.PI / 2;
    butterfly.add(body);
    const wingGeo = new PlaneGeometry(0.32, 0.24);
    const leftWing = makeMesh(wingGeo, wingMaterials[index % wingMaterials.length], {
      cast: false,
      receive: false,
      name: 'particle_butterfly_wing',
    });
    const rightWing = makeMesh(wingGeo, wingMaterials[index % wingMaterials.length], {
      cast: false,
      receive: false,
      name: 'particle_butterfly_wing',
    });
    leftWing.position.x = -0.17;
    rightWing.position.x = 0.17;
    butterfly.add(leftWing, rightWing);
    root.add(butterfly);

    const phase = index * 1.17;
    animator.add((time, _dt, state) => {
      const flight = time * (0.32 + index * 0.012) + phase;
      butterfly.position.x = x + Math.sin(flight) * (0.75 + index * 0.06);
      butterfly.position.y = y + Math.sin(flight * 1.7) * 0.22;
      butterfly.position.z = z + Math.cos(flight) * (0.5 + index * 0.04);
      butterfly.rotation.y = -flight + Math.PI * 0.5;
      const flap = Math.sin(time * 11 + phase) * 0.9;
      leftWing.rotation.y = flap;
      rightWing.rotation.y = -flap;
      butterfly.visible = state.nightMix < 0.78;
    });
  });
  return root;
}

export function createAmbientLife(animator, layout = TOWN_LAYOUT) {
  const root = decorate(new Group());
  root.name = 'cozy_ambient_life';
  const cloudMaterial = new MeshStandardMaterial({
    color: TOWN_PALETTE.white,
    roughness: 1,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const cloudData = [
    [-30, 13.5, -18, 1.3],
    [8, 15.2, -28, 1.75],
    [31, 12.8, 1, 1.15],
    [-13, 16.5, 13, 1.45],
  ];
  cloudData.forEach(([x, y, z, scale], index) => {
    root.add(createCloud(new Vector3(x, y, z), scale, index, animator, cloudMaterial));
  });
  animator.add((_time, _dt, state) => {
    cloudMaterial.opacity = 0.88 - state.nightMix * 0.47;
  });

  root.add(createFireflies(animator, layout));
  root.add(createPetalDrift(animator, layout));
  root.add(createButterflies(animator));
  return root;
}
