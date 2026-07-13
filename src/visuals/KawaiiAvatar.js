import {
  BackSide,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  RGBAFormat,
  SphereGeometry,
  TorusGeometry,
  UnsignedByteType,
} from 'three';

let toonRamp;

function getToonRamp() {
  if (toonRamp) return toonRamp;
  const data = new Uint8Array([
    92, 92, 105, 255,
    158, 158, 172, 255,
    222, 222, 230, 255,
    255, 255, 255, 255,
  ]);
  toonRamp = new DataTexture(data, 4, 1, RGBAFormat, UnsignedByteType);
  toonRamp.needsUpdate = true;
  return toonRamp;
}

function toon(color, options = {}) {
  return new MeshToonMaterial({
    color: new Color(color),
    gradientMap: getToonRamp(),
    ...options,
  });
}

function mesh(geometry, material, name, castShadow = true) {
  const value = new Mesh(geometry, material);
  value.name = name;
  value.castShadow = castShadow;
  value.receiveShadow = true;
  return value;
}

function addOutlined(parent, geometry, material, name, scale = 1.045) {
  const value = mesh(geometry, material, name);
  parent.add(value);

  const outline = mesh(
    geometry,
    new MeshBasicMaterial({ color: 0x5c4359, side: BackSide }),
    `${name}_outline`,
    false,
  );
  outline.scale.setScalar(scale);
  outline.renderOrder = -1;
  parent.add(outline);
  return value;
}

function createFlower() {
  const flower = new Group();
  flower.name = 'flowerAccessory';
  const stem = mesh(new CylinderGeometry(0.018, 0.025, 0.45, 8), toon(0x65a85e), 'flowerStem');
  stem.position.y = 0.16;
  stem.rotation.z = -0.2;
  flower.add(stem);

  const petalMaterial = toon(0xff8fbd);
  for (let i = 0; i < 5; i += 1) {
    const petal = mesh(new SphereGeometry(0.075, 12, 8), petalMaterial, `flowerPetal_${i}`);
    const angle = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(angle) * 0.085, 0.4 + Math.sin(angle) * 0.085, 0);
    petal.scale.set(1.15, 0.72, 0.5);
    flower.add(petal);
  }
  const center = mesh(new SphereGeometry(0.055, 12, 8), toon(0xffd569), 'flowerCenter');
  center.position.y = 0.4;
  center.position.z = 0.035;
  flower.add(center);
  return flower;
}

/**
 * A deterministic code-native avatar used only after fRiENDSiES loading is
 * exhausted. It deliberately has no model, decoder, texture, or network path.
 * Named limb groups are intentionally exposed for PlayerAnimator.
 */
export function createKawaiiAvatar() {
  const avatar = new Group();
  avatar.name = 'KawaiiAvatar';
  avatar.userData.isKawaiiAvatar = true;

  const skin = toon(0xffdcc9);
  const hair = toon(0x7a536f);
  const hairHighlight = toon(0xb578a0);
  const dress = toon(0x8d7bdc);
  const dressLight = toon(0xc4b6ff);
  const cream = toon(0xfff5df);
  const shoe = toon(0x6f557c);
  const gold = toon(0xffcd68, { emissive: 0x3a2108, emissiveIntensity: 0.18 });
  const eye = new MeshBasicMaterial({ color: 0x4b384b });
  const blush = new MeshBasicMaterial({ color: 0xff90ab, transparent: true, opacity: 0.78 });

  const body = new Group();
  body.name = 'body';
  avatar.add(body);

  const torso = addOutlined(body, new SphereGeometry(0.33, 20, 14), dress, 'torso', 1.035);
  torso.position.y = 0.82;
  torso.scale.set(0.82, 1.05, 0.68);

  const skirt = addOutlined(body, new ConeGeometry(0.44, 0.62, 20), dressLight, 'skirt', 1.028);
  skirt.position.y = 0.52;
  const skirtBand = mesh(new TorusGeometry(0.37, 0.035, 8, 24), cream, 'skirtBand');
  skirtBand.position.y = 0.39;
  skirtBand.rotation.x = Math.PI / 2;
  body.add(skirtBand);

  const collar = mesh(new TorusGeometry(0.18, 0.045, 8, 24, Math.PI * 1.35), cream, 'collar');
  collar.position.set(0, 1.04, 0.09);
  collar.rotation.set(Math.PI / 2, 0, 0.48);
  body.add(collar);

  const bow = new Group();
  bow.name = 'bow';
  bow.position.set(0, 0.91, -0.31);
  const bowMat = toon(0xff88b8);
  const bowLeft = mesh(new SphereGeometry(0.15, 12, 8), bowMat, 'bowLeft');
  bowLeft.scale.set(1.25, 0.7, 0.45);
  bowLeft.position.x = -0.12;
  const bowRight = bowLeft.clone();
  bowRight.name = 'bowRight';
  bowRight.position.x = 0.12;
  const bowCenter = mesh(new SphereGeometry(0.07, 12, 8), gold, 'bowCenter');
  bow.add(bowLeft, bowRight, bowCenter);
  body.add(bow);

  const head = new Group();
  head.name = 'head';
  head.position.y = 1.37;
  avatar.add(head);

  addOutlined(head, new SphereGeometry(0.45, 24, 18), skin, 'face', 1.027);

  const hairCap = mesh(
    new SphereGeometry(0.47, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hair,
    'hairCap',
  );
  hairCap.position.y = 0.03;
  head.add(hairCap);

  const fringeMaterial = hairHighlight;
  [-0.2, -0.07, 0.07, 0.2].forEach((x, index) => {
    const fringe = mesh(new SphereGeometry(0.16, 14, 10), fringeMaterial, `fringe_${index}`);
    fringe.position.set(x, 0.2 - Math.abs(x) * 0.28, 0.37);
    fringe.scale.set(0.75, 1.05, 0.35);
    head.add(fringe);
  });

  [-1, 1].forEach((side) => {
    const bun = addOutlined(head, new SphereGeometry(0.19, 16, 12), hair, `hairBun_${side}`, 1.04);
    bun.position.set(side * 0.39, 0.15, -0.03);
    const star = mesh(new SphereGeometry(0.055, 10, 8), gold, `bunCharm_${side}`);
    star.position.set(side * 0.5, 0.16, 0.05);
    head.add(star);
  });

  [-1, 1].forEach((side) => {
    const eyeMesh = mesh(new SphereGeometry(0.048, 12, 8), eye, `eye_${side}`, false);
    eyeMesh.position.set(side * 0.145, 0.015, 0.428);
    eyeMesh.scale.set(0.78, 1.25, 0.42);
    head.add(eyeMesh);

    const sparkle = mesh(new SphereGeometry(0.013, 8, 6), new MeshBasicMaterial({ color: 0xffffff }), `eyeSparkle_${side}`, false);
    sparkle.position.set(side * 0.13, 0.037, 0.469);
    head.add(sparkle);

    const cheek = mesh(new SphereGeometry(0.07, 12, 8), blush, `cheek_${side}`, false);
    cheek.position.set(side * 0.26, -0.09, 0.4);
    cheek.scale.set(1.1, 0.45, 0.28);
    head.add(cheek);
  });

  const mouth = mesh(new TorusGeometry(0.04, 0.008, 6, 16, Math.PI), eye, 'mouth', false);
  mouth.position.set(0, -0.095, 0.452);
  mouth.rotation.z = Math.PI;
  head.add(mouth);

  const legGeometry = new CapsuleGeometry(0.09, 0.2, 6, 10);
  const footGeometry = new SphereGeometry(0.14, 14, 10);
  [-1, 1].forEach((side) => {
    const leg = new Group();
    leg.name = side < 0 ? 'legL' : 'legR';
    leg.position.set(side * 0.17, 0.28, 0);
    const legMesh = mesh(legGeometry, cream, `legMesh_${side}`);
    legMesh.position.y = -0.12;
    const foot = mesh(footGeometry, shoe, `shoe_${side}`);
    foot.position.set(0, -0.31, 0.075);
    foot.scale.set(1.0, 0.62, 1.35);
    leg.add(legMesh, foot);
    avatar.add(leg);
  });

  const armGeometry = new CapsuleGeometry(0.075, 0.3, 6, 10);
  [-1, 1].forEach((side) => {
    const arm = new Group();
    arm.name = side < 0 ? 'armL' : 'armR';
    arm.position.set(side * 0.34, 0.92, 0);
    arm.rotation.z = side * -0.18;
    const sleeve = mesh(new SphereGeometry(0.13, 12, 8), dressLight, `sleeve_${side}`);
    const armMesh = mesh(armGeometry, skin, `armMesh_${side}`);
    armMesh.position.y = -0.21;
    const hand = mesh(new SphereGeometry(0.085, 12, 8), skin, `hand_${side}`);
    hand.position.y = -0.43;
    arm.add(sleeve, armMesh, hand);
    avatar.add(arm);

    if (side > 0) {
      const flower = createFlower();
      flower.position.set(0, -0.55, 0.06);
      flower.rotation.z = 0.45;
      arm.add(flower);
    }
  });

  const shadow = mesh(
    new PlaneGeometry(0.9, 0.62),
    new MeshBasicMaterial({ color: 0x563c62, transparent: true, opacity: 0.18, depthWrite: false, side: DoubleSide }),
    'avatarShadow',
    false,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  shadow.renderOrder = -2;
  avatar.add(shadow);

  avatar.traverse((object) => {
    if (object.isMesh) object.frustumCulled = true;
  });

  avatar.scale.setScalar(0.92);
  return avatar;
}
