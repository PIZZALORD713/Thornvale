import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from 'three';
import { ARRIVAL_PROLOGUE_V1 } from '../config/arrival-prologue.js';
import { TOWN_LAYOUT } from '../config/town.js';

export const ARRIVAL_TREAD_SIGNATURE = ARRIVAL_PROLOGUE_V1.treadSignature;

function createBootShape({ notched = false } = {}) {
  const shape = new Shape();
  shape.moveTo(-0.13, -0.28);
  if (notched) {
    shape.lineTo(-0.13, -0.17);
    shape.lineTo(-0.025, -0.10);
    shape.lineTo(-0.13, -0.03);
  }
  shape.lineTo(-0.145, 0.14);
  shape.quadraticCurveTo(-0.14, 0.29, 0, 0.34);
  shape.quadraticCurveTo(0.14, 0.29, 0.145, 0.14);
  shape.lineTo(0.13, -0.28);
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function seededSnowPositions(count, field) {
  const width = Number(field?.width) || 54;
  const length = Number(field?.length) || 60;
  const centerX = Number(field?.center?.x) || 0;
  const centerZ = Number(field?.center?.z) || 0;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const phase = index * 12.9898;
    const x = centerX + Math.sin(phase) * width * 0.48;
    const z = centerZ - length * 0.5 + ((index * 7.73) % length);
    const y = 0.45 + ((index * 3.17) % 7.6);
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
  }
  return positions;
}

/**
 * Temporary, presentation-only snow pocket for the arrival tutorial.
 * Authoritative progress remains in GameSession/CoreHookDirector.
 */
export class ArrivalWorld {
  constructor(scene, {
    reducedMotion = false,
    content = ARRIVAL_PROLOGUE_V1,
  } = {}) {
    this.scene = scene;
    this.content = content;
    this.reducedMotion = Boolean(reducedMotion);
    this.root = new Group();
    this.root.name = 'arrival_prologue_world';
    this.root.userData.cameraCollision = false;
    this.rememberedTrail = new Group();
    this.rememberedTrail.name = 'arrival_remembered_footprints';
    this.rememberedTrail.userData.treadSignature = content.treadSignature;
    this.lantern = null;
    this.snow = null;
    this.snowPositions = null;
    this.snowTime = 0;
    this.resources = new Set();
    this.interactables = [];
    this.completed = false;
    this.fogBaseline = null;
    this.foldFx = {
      active: false,
      elapsed: 0,
      pending: false,
      used: false,
    };
  }

  init() {
    if (this.scene?.fog) {
      this.fogBaseline = {
        color: this.scene.fog.color.clone(),
        near: this.scene.fog.near,
        far: this.scene.fog.far,
      };
    }
    this._buildSnowPocket();
    this._buildSnowTracks();
    this._buildDistanceMarkers();
    this._buildDrifts();
    this._addSkirt();
    this._buildCrossroads();
    this._buildFootprints();
    this._addFoldLandmark();
    this._buildOpenGate();
    this._buildWaitingLantern();
    this.scene?.add?.(this.root);
    return this;
  }

  _material(MaterialType, options) {
    const material = new MaterialType(options);
    this.resources.add(material);
    return material;
  }

  _geometry(geometry) {
    this.resources.add(geometry);
    return geometry;
  }

  _buildSnowPocket() {
    const fieldConfig = this.content.environment?.snowField || {};
    const width = Number(fieldConfig.width) || 54;
    const length = Number(fieldConfig.length) || 60;
    const centerX = Number(fieldConfig.center?.x) || 0;
    const centerZ = Number(fieldConfig.center?.z) || 0;
    const field = new Mesh(
      this._geometry(new PlaneGeometry(width, length)),
      this._material(MeshStandardMaterial, {
        color: 0xe8f0f4,
        roughness: 0.98,
        metalness: 0,
        transparent: true,
        opacity: 0.94,
        side: DoubleSide,
        depthWrite: true,
      }),
    );
    field.name = 'arrival_snow_field';
    field.rotation.x = -Math.PI / 2;
    field.position.set(centerX, 0.045, centerZ);
    field.receiveShadow = true;
    field.userData.cameraCollision = false;
    this.root.add(field);

    const count = this.reducedMotion ? 92 : 224;
    this.snowPositions = seededSnowPositions(count, fieldConfig);
    const geometry = this._geometry(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(this.snowPositions, 3));
    const material = this._material(PointsMaterial, {
      color: 0xf8fdff,
      size: this.reducedMotion ? 0.055 : 0.075,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.snow = new Points(geometry, material);
    this.snow.name = 'arrival_whiteout_snow';
    this.snow.frustumCulled = false;
    this.snow.userData.cameraCollision = false;
    this.root.add(this.snow);
  }

  _buildTrack(points, material, prefix, width = 1.65) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const dx = end[0] - start[0];
      const dz = end[2] - start[2];
      const length = Math.hypot(dx, dz);
      if (length <= 0.001) continue;
      const track = new Mesh(
        this._geometry(new BoxGeometry(width, 0.025, length + 0.18)),
        material,
      );
      track.name = `${prefix}_${index}`;
      track.position.set((start[0] + end[0]) * 0.5, 0.068, (start[2] + end[2]) * 0.5);
      track.rotation.y = Math.atan2(dx, dz);
      track.receiveShadow = true;
      track.userData.cameraCollision = false;
      this.root.add(track);
    }
  }

  _buildSnowTracks() {
    const approachMaterial = this._material(MeshStandardMaterial, {
      color: 0xd5e0e5,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const forkMaterial = this._material(MeshStandardMaterial, {
      color: 0xdbe4e8,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this._buildTrack(
      this.content.snowTracks?.approach || [],
      approachMaterial,
      'arrival_approach_track_segment',
      1.75,
    );
    this._buildTrack(
      this.content.snowTracks?.remembered || [],
      forkMaterial,
      'arrival_remembered_track_segment',
    );
    this._buildTrack(
      this.content.snowTracks?.wrongFork || [],
      forkMaterial,
      'arrival_wrong_fork_segment',
    );
  }

  _buildDistanceMarkers() {
    const wood = this._material(MeshStandardMaterial, {
      color: 0x66535a,
      roughness: 0.92,
      metalness: 0,
    });
    const snow = this._material(MeshStandardMaterial, {
      color: 0xf6fafb,
      roughness: 1,
      metalness: 0,
    });
    const poleGeometry = this._geometry(new CylinderGeometry(0.045, 0.065, 1.35, 6));
    const capGeometry = this._geometry(new SphereGeometry(0.095, 8, 6));
    const waypost = this.content.fold?.waypost;
    for (const [index, marker] of (this.content.environment?.distanceMarkers || []).entries()) {
      if (
        waypost
        && Math.hypot(
          (Number(marker.x) || 0) - (Number(waypost.x) || 0),
          (Number(marker.z) || 0) - (Number(waypost.z) || 0),
        ) < 0.35
      ) continue;
      const group = new Group();
      group.name = `arrival_distance_marker_${index}`;
      group.position.set(marker.x, 0, marker.z);
      group.rotation.z = Number(marker.rotation) || 0;
      group.userData.cameraCollision = false;
      const pole = new Mesh(poleGeometry, wood);
      pole.position.y = 0.68;
      pole.castShadow = true;
      const cap = new Mesh(capGeometry, snow);
      cap.position.set(0, 1.37, 0);
      cap.scale.set(1.35, 0.45, 1.05);
      group.add(pole, cap);
      this.root.add(group);
    }
  }

  _buildDrifts() {
    const snow = this._material(MeshStandardMaterial, {
      color: 0xeef4f6,
      roughness: 1,
      metalness: 0,
    });
    const geometry = this._geometry(new SphereGeometry(1, 14, 8));
    for (const [index, drift] of (this.content.environment?.drifts || []).entries()) {
      const mound = new Mesh(geometry, snow);
      mound.name = `arrival_snow_drift_${index}`;
      mound.position.set(drift.x, 0.08, drift.z);
      mound.scale.set(drift.scaleX, 0.32, drift.scaleZ);
      mound.receiveShadow = true;
      mound.userData.cameraCollision = false;
      this.root.add(mound);
    }
  }

  _addSkirt() {
    const skirt = this.content.environment?.skirt;
    if (!skirt) return;
    const material = (color, roughness = 1) => this._material(MeshStandardMaterial, {
      color, roughness, metalness: 0,
    });
    const pineMaterial = material(0x43554f, 0.94);
    const pineGeometry = this._geometry(new CylinderGeometry(0, 1, 1, 7));
    for (const [index, pine] of (skirt.pines || []).entries()) {
      const height = Math.max(2.5, Number(pine.height) || 7.7 + (index % 4) * 0.7);
      const radius = Math.max(0.6, Number(pine.radius) || 2.15 + (index % 3) * 0.22);
      const canopy = new Mesh(pineGeometry, pineMaterial);
      canopy.name = `arrival_skirt_pine_${index}`;
      canopy.position.set(Number(pine.x) || 0, height * 0.5, Number(pine.z) || 0);
      canopy.scale.set(radius, height, radius);
      canopy.rotation.y = Number(pine.rotation) || (index % 2 ? 0.15 : -0.12);
      canopy.castShadow = false;
      this.root.add(canopy);
    }
    const moundGeometry = this._geometry(new SphereGeometry(1, 9, 6));
    for (const [kind, entries, color] of [
      ['brush', skirt.brush || [], 0x697069],
      ['drift', skirt.drifts || [], 0xf0f5f7],
    ]) {
      const moundMaterial = material(color);
      for (const [index, item] of entries.entries()) {
        const brush = kind === 'brush';
        const side = Math.abs(Number(item.x) || 0) > 30 && Number(item.z) < 60;
        const height = Number(brush ? item.scaleY : item.height) || (brush ? 1.15 : 0.6);
        const mound = new Mesh(moundGeometry, moundMaterial);
        mound.name = `arrival_skirt_${kind}_${index}`;
        mound.position.set(Number(item.x) || 0, Math.max(0.04, height * 0.24), Number(item.z) || 0);
        mound.scale.set(
          Math.max(0.4, Number(item.scaleX) || (brush || side ? 3.3 : 6.6)),
          Math.max(0.2, height),
          Math.max(0.4, Number(item.scaleZ) || (brush || !side ? 3 : 6.8)),
        );
        mound.rotation.y = Number(item.rotation) || 0;
        mound.castShadow = false;
        mound.receiveShadow = kind === 'drift';
        this.root.add(mound);
      }
    }
  }

  _buildCrossroads() {
    const anchor = this.content.anchors.crossroads;
    const wood = this._material(MeshStandardMaterial, {
      color: 0x6f5147,
      roughness: 0.88,
      metalness: 0,
    });
    const snow = this._material(MeshStandardMaterial, {
      color: 0xf3f7f8,
      roughness: 0.96,
      metalness: 0,
    });
    const postGeometry = this._geometry(new CylinderGeometry(0.08, 0.11, 2.3, 8));
    const boardGeometry = this._geometry(new BoxGeometry(1.5, 0.38, 0.11));
    const snowGeometry = this._geometry(new BoxGeometry(1.58, 0.09, 0.18));
    const post = new Mesh(postGeometry, wood);
    post.position.set(anchor.x, 1.15, anchor.z);
    post.castShadow = true;
    this.root.add(post);

    for (const sign of [-1, 1]) {
      const board = new Mesh(boardGeometry, wood);
      board.name = `arrival_crossroads_board_${sign < 0 ? 'left' : 'right'}`;
      board.position.set(anchor.x + sign * 0.56, 1.83 + (sign < 0 ? 0.16 : -0.15), anchor.z);
      board.rotation.z = sign * 0.27;
      board.castShadow = true;
      this.root.add(board);

      const cover = new Mesh(snowGeometry, snow);
      cover.name = `${board.name}_snow_cover`;
      cover.position.copy(board.position);
      cover.position.y += 0.22;
      cover.rotation.copy(board.rotation);
      this.root.add(cover);
    }
  }

  _addFootprintTrail(group, points, material, prefix) {
    const leftGeometry = this._geometry(createBootShape({ notched: true }));
    const rightGeometry = this._geometry(createBootShape());
    points.forEach(([x, z], index) => {
      const left = index % 2 === 0;
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next[0] - previous[0];
      const dz = next[1] - previous[1];
      const distance = Math.max(0.001, Math.hypot(dx, dz));
      const sideX = dz / distance;
      const sideZ = -dx / distance;
      const side = left ? -0.12 : 0.12;
      const footprint = new Mesh(left ? leftGeometry : rightGeometry, material);
      footprint.name = `${prefix}_${index}`;
      footprint.position.set(x + sideX * side, 0.084, z + sideZ * side);
      footprint.rotation.y = Math.atan2(dx, dz) + (left ? -0.035 : 0.035);
      footprint.scale.setScalar(0.92);
      footprint.userData.foot = left ? 'left' : 'right';
      footprint.userData.treadSignature = left ? this.content.treadSignature : 'right-boot-v1';
      footprint.userData.cameraCollision = false;
      group.add(footprint);
    });
  }

  _buildFootprints() {
    const freshMaterial = this._material(MeshBasicMaterial, {
      color: 0x66798d,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide,
    });
    const rememberedMaterial = this._material(MeshBasicMaterial, {
      color: 0x596a84,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      side: DoubleSide,
    });
    const freshTrail = new Group();
    freshTrail.name = 'arrival_fresh_footprints';
    freshTrail.userData.treadSignature = this.content.treadSignature;
    this._addFootprintTrail(
      freshTrail,
      this.content.footprints.fresh,
      freshMaterial,
      'arrival_fresh_print',
    );
    this._addFootprintTrail(
      this.rememberedTrail,
      this.content.footprints.remembered,
      rememberedMaterial,
      'arrival_remembered_print',
    );
    this.rememberedTrail.visible = false;
    this.root.add(freshTrail, this.rememberedTrail);
  }

  _addFoldLandmark() {
    const fold = this.content.fold;
    const anchor = fold?.waypost;
    if (!anchor) return;

    const wood = this._material(MeshStandardMaterial, {
      color: 0x5f4b45,
      roughness: 0.96,
      metalness: 0,
    });
    const ribbon = this._material(MeshStandardMaterial, {
      color: Number(anchor.ribbonColor) || 0xc98a4b,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0.82,
      side: DoubleSide,
    });
    const poleGeometry = this._geometry(new CylinderGeometry(0.075, 0.11, 2.25, 7));
    const prongGeometry = this._geometry(new CylinderGeometry(0.045, 0.065, 1, 6));

    const group = new Group();
    group.name = 'arrival_fold_waypost';
    group.position.set(Number(anchor.x) || 0, Number(anchor.y) || 0, Number(anchor.z) || 0);
    group.rotation.z = Number(anchor.rotation) || 0;
    Object.assign(group.userData, {
      cameraCollision: false,
      prongCount: 3,
      snappedProngCount: 1,
    });
    const addPart = (name, geometry, material, x, y, z, scale, rotation = 0) => {
      const part = new Mesh(geometry, material);
      part.name = name;
      part.position.set(x, y, z);
      if (scale) part.scale.set(...scale);
      part.rotation.z = rotation;
      part.castShadow = true;
      group.add(part);
    };
    addPart('arrival_fold_waypost_pole', poleGeometry, wood, 0, 1.12, 0);

    for (let index = 0; index < 3; index += 1) {
      addPart(
        `arrival_fold_waypost_prong_${index}`,
        prongGeometry,
        wood,
        (index - 1) * 0.2,
        2.12,
        0,
        [1, [0.82, 0.68, 0.38][index], 1],
        [-0.58, 0, 0.62][index],
      );
    }
    addPart(
      'arrival_fold_waypost_ribbon',
      this._geometry(new PlaneGeometry(0.62, 0.18)),
      ribbon,
      0.34,
      1.82,
      0.055,
      null,
      -0.22,
    );
    this.root.add(group);

    const prints = Array.isArray(fold.freshPrints) ? fold.freshPrints : [];
    if (prints.length > 0) {
      const material = this._material(MeshBasicMaterial, {
        color: 0x687c90,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        side: DoubleSide,
      });
      const trail = new Group();
      trail.name = 'arrival_fold_fresh_footprints';
      trail.userData.treadSignature = this.content.treadSignature;
      this._addFootprintTrail(
        trail,
        prints,
        material,
        'arrival_fold_fresh_print',
      );
      this.root.add(trail);
    }
  }

  _buildOpenGate() {
    const material = this._material(MeshStandardMaterial, {
      color: 0x7a554b,
      roughness: 0.82,
      metalness: 0,
    });
    const geometry = this._geometry(new BoxGeometry(1.72, 1.68, 0.12));
    for (const sign of [-1, 1]) {
      const door = new Mesh(geometry, material);
      door.name = `arrival_open_gate_${sign < 0 ? 'left' : 'right'}`;
      door.position.set(
        TOWN_LAYOUT.gate.x + sign * 1.22,
        0.92,
        TOWN_LAYOUT.gate.z + 0.38,
      );
      door.rotation.y = sign * 0.82;
      door.castShadow = true;
      door.userData.cameraCollision = false;
      this.root.add(door);
    }
  }

  _buildWaitingLantern() {
    const anchor = this.content.anchors.lantern;
    const frameMaterial = this._material(MeshStandardMaterial, {
      color: 0x624642,
      roughness: 0.7,
      metalness: 0.18,
    });
    const glowMaterial = this._material(MeshStandardMaterial, {
      color: 0xffd78c,
      emissive: 0xff9d4f,
      emissiveIntensity: 2.2,
      roughness: 0.48,
      metalness: 0,
    });
    this.lantern = new Group();
    this.lantern.name = 'arrival_waiting_lantern';
    this.lantern.position.set(anchor.x, anchor.y, anchor.z);
    const body = new Mesh(
      this._geometry(new CylinderGeometry(0.21, 0.25, 0.52, 8)),
      frameMaterial,
    );
    body.castShadow = true;
    const flame = new Mesh(
      this._geometry(new SphereGeometry(0.09, 10, 7)),
      glowMaterial,
    );
    flame.name = 'arrival_lantern_low_flame';
    flame.position.y = 0.03;
    flame.scale.set(0.72, 1.18, 0.72);
    const light = new PointLight(0xffb15d, 1.5, 8, 2);
    light.name = 'arrival_lantern_light';
    light.position.y = 0.1;
    light.castShadow = false;
    light.userData.cameraCollision = false;
    this.lantern.add(body, flame, light);
    this.root.add(this.lantern);

    const shoulderSnow = this._material(MeshStandardMaterial, {
      color: 0xf4f8f9,
      roughness: 0.98,
      metalness: 0,
    });
    const clumpGeometry = this._geometry(new SphereGeometry(0.2, 10, 7));
    for (const sign of [-1, 1]) {
      const clump = new Mesh(clumpGeometry, shoulderSnow);
      clump.name = `arrival_lumen_shoulder_snow_${sign < 0 ? 'left' : 'right'}`;
      clump.position.set(
        this.content.anchors.stewardWelcome.x + sign * 0.32,
        2.08,
        this.content.anchors.stewardWelcome.z + 0.02,
      );
      clump.scale.set(1, 0.34, 0.8);
      this.root.add(clump);
    }

    this.interactables.push({
      id: 'arrival-lantern',
      position: this.lantern.position,
      radius: 1.6,
    });
  }

  revealRememberedTrail() {
    if (this.completed) return false;
    this.rememberedTrail.visible = true;
    return true;
  }

  setLanternTaken(taken) {
    if (this.lantern) this.lantern.visible = !taken;
  }

  setState(snapshot) {
    const events = new Set(snapshot?.eventsSeen || []);
    this.completed = events.has('steward-lumen-met');
    this.root.visible = !this.completed;
    if (this.completed) {
      this.cancelFoldPresentation();
      this._restoreFog();
    }
    this.setLanternTaken(events.has('arrival-lantern-taken'));
    if (!events.has('arrival-crossroads-reached')) this.rememberedTrail.visible = false;
    return this;
  }

  _applyWhiteoutFog() {
    if (!this.scene?.fog) return;
    if (!this.fogBaseline) {
      this.fogBaseline = {
        color: this.scene.fog.color.clone(),
        near: this.scene.fog.near,
        far: this.scene.fog.far,
      };
    }
    this.scene.fog.color.setHex(0xeaf1f5);
    this.scene.fog.near = Number(this.content.environment?.fog?.near) || 2.8;
    this.scene.fog.far = Number(this.content.environment?.fog?.far) || 14.5;
  }

  _restoreFog() {
    if (!this.scene?.fog || !this.fogBaseline) return;
    this.scene.fog.color.copy(this.fogBaseline.color);
    this.scene.fog.near = this.fogBaseline.near;
    this.scene.fog.far = this.fogBaseline.far;
  }

  _foldDuration() {
    return (Number(this.content.fold?.pulseDurationMs) || 250) / 1000;
  }

  _resetFold() {
    this._setSkyWhiteout(0);
    if (this.completed) this._restoreFog();
    else this._applyWhiteoutFog();
  }

  _setSkyWhiteout(value) {
    const uniform = this.scene?.getObjectByName?.('kawaiiSkyDome')
      ?.material?.uniforms?.uWhiteout;
    if (uniform) uniform.value = Number(value) || 0;
  }

  _applyFold(intensity) {
    const safeIntensity = Number(intensity) || 0;
    this._setSkyWhiteout(safeIntensity);
    if (this.scene?.fog) {
      const normalNear = Number(this.content.environment?.fog?.near) || 2.8;
      const normalFar = Number(this.content.environment?.fog?.far) || 14.5;
      this.scene.fog.color.setHex(0xf7fbfd);
      this.scene.fog.near = normalNear + (0.15 - normalNear) * safeIntensity;
      this.scene.fog.far = normalFar + (1.45 - normalFar) * safeIntensity;
    }
  }

  _updateFold(dt) {
    if (!this.foldFx.active) return;
    const duration = this._foldDuration();
    this.foldFx.elapsed = Math.min(
      duration,
      this.foldFx.elapsed + dt,
    );
    const progress = Math.min(1, this.foldFx.elapsed / duration);
    const occluded = progress >= 0.36 && progress <= 0.78;
    if (
      progress >= 0.36
      && !this.foldFx.used
    ) this.foldFx.pending = true;

    const intensity = this.reducedMotion
      ? (occluded ? 0.96 : 0.64)
      : Math.sin(Math.PI * progress);
    this._applyFold(intensity);

    if (progress >= 1) {
      this.foldFx.active = false;
      this._resetFold();
    }
  }

  beginFoldPresentation() {
    if (
      this.completed
      || !this.content.fold?.waypost
      || this.foldFx.active
    ) return false;
    Object.assign(this.foldFx, {
      active: true, elapsed: 0, pending: false, used: false,
    });
    return true;
  }

  getFoldPresentationState() {
    return { active: this.foldFx.active };
  }

  consumeFoldRelocationCue() {
    if (
      !this.foldFx.pending
      || this.foldFx.used
    ) return false;
    this.foldFx.pending = false;
    this.foldFx.used = true;
    return true;
  }

  cancelFoldPresentation() {
    Object.assign(this.foldFx, {
      active: false, elapsed: 0, pending: false, used: false,
    });
    this._resetFold();
  }

  update(dt) {
    if (!this.completed) this._applyWhiteoutFog();
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    this._updateFold(safeDt);
    if (
      this.completed
      || this.reducedMotion
      || !this.snow?.geometry?.attributes?.position
    ) return;
    this.snowTime += safeDt;
    for (let index = 0; index < this.snowPositions.length; index += 3) {
      this.snowPositions[index + 1] -= safeDt * (0.72 + ((index / 3) % 7) * 0.045);
      this.snowPositions[index] += Math.sin(this.snowTime * 1.35 + index) * safeDt * 0.055;
      if (this.snowPositions[index + 1] < 0.22) this.snowPositions[index + 1] += 7.7;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.cancelFoldPresentation();
    this._restoreFog();
    this.scene?.remove?.(this.root);
    for (const resource of this.resources) resource.dispose?.();
    this.resources.clear();
    this.interactables.length = 0;
  }
}

export default ArrivalWorld;
