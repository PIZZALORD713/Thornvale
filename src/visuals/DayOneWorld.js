import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { TOWN_LAYOUT } from '../config/town.js';
import { DAY_ONE_V01 } from '../content/day-one-v01.js';

export const DAY_ONE_WORLD_INTERACTIONS = Object.freeze([
  Object.freeze({
    id: DAY_ONE_V01.ids.woodlot,
    site: 'woodlot',
    radius: 2.35,
    prompt: 'Split a little fallen wood',
  }),
  Object.freeze({
    id: DAY_ONE_V01.ids.fishingSpot,
    site: 'fishingSpot',
    radius: 2.25,
    prompt: 'Fish at the quiet pond',
  }),
  Object.freeze({
    id: DAY_ONE_V01.ids.campfire,
    site: 'campfire',
    radius: 2.1,
    prompt: 'Tend the campfire',
  }),
  Object.freeze({
    id: DAY_ONE_V01.ids.garden,
    site: 'garden',
    radius: 2.25,
    prompt: 'Tend the little garden bed',
  }),
  Object.freeze({
    id: DAY_ONE_V01.ids.shelter,
    site: 'shelter',
    radius: 2.4,
    prompt: 'Inspect the provisional shelter',
  }),
]);

const PALETTE = Object.freeze({
  canvas: 0xf2d3a6,
  canvasShade: 0xd99e79,
  patch: 0xa8cdb0,
  blanket: 0xb7a7df,
  pillow: 0xffead3,
  wood: 0x8a5e45,
  woodDark: 0x5d423c,
  bark: 0x725044,
  cutWood: 0xd7a56b,
  stone: 0xb8aaa4,
  stoneLight: 0xd8c9be,
  soil: 0x8a604c,
  wetSoil: 0x5f463e,
  leaf: 0x63a96d,
  water: 0x91e3db,
  fire: 0xff8e55,
  fireInner: 0xffdf79,
  fish: 0x87bdd0,
  fishLight: 0xc7e4e0,
  cream: 0xfff2dc,
});

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stateValue(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

/**
 * Code-native presentation for the bounded Day One proof.
 *
 * This class deliberately owns no gameplay rules. It projects a supplied
 * snapshot into obvious physical changes and exposes stable interaction
 * anchors for whichever authoritative director is composing the day.
 */
export class DayOneWorld {
  constructor({ layout = TOWN_LAYOUT, reducedMotion = false } = {}) {
    this.layout = layout;
    this.reducedMotion = Boolean(reducedMotion);
    this.root = new Group();
    this.root.name = 'day_one_provisional_camp_world';
    this.root.userData.cameraCollision = false;
    this.root.userData.physicsCollision = false;

    this.interactables = [];
    this.initialized = false;
    this.disposed = false;
    this.time = 0;
    this._geometries = new Set();
    this._materials = new Set();
    this._soilMeshes = [];
    this._woodPieces = [];
    this._state = null;
    this._actionCue = null;
    this._actionTransforms = new Map();
  }

  init() {
    if (this.initialized) return this;
    if (this.disposed) throw new Error('DayOneWorld has been disposed');
    if (!this.layout?.dayOne) throw new Error('DayOneWorld requires layout.dayOne anchors');

    this._createCampClearing();
    this._createShelter();
    this._createCampfire();
    this._createGarden();
    this._createWoodlot();
    this._createFishingSpot();
    this._createInteractables();
    this.initialized = true;
    this.setState(null);
    return this;
  }

  _material(name, color, options = {}) {
    const config = {
      name,
      color,
      roughness: options.roughness ?? 0.88,
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
    if (options.depthWrite !== undefined) config.depthWrite = options.depthWrite;
    const material = new MeshStandardMaterial(config);
    this._materials.add(material);
    return material;
  }

  _mesh(name, geometry, material, { cast = true, receive = true } = {}) {
    this._geometries.add(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.userData.cameraCollision = false;
    mesh.userData.physicsCollision = false;
    return mesh;
  }

  _group(name, site = null) {
    const group = new Group();
    group.name = name;
    group.userData.cameraCollision = false;
    group.userData.physicsCollision = false;
    if (site) {
      const anchor = this.layout.dayOne[site];
      // Authored Y values belong to the proximity target. The procedural camp
      // itself is grounded on Thornvale's flat meadow plane.
      group.position.set(anchor.x, 0, anchor.z);
      group.userData.dayOneSite = site;
    }
    return group;
  }

  _rememberActionTransform(name, object) {
    this._actionTransforms.set(name, {
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
    });
    return object;
  }

  _restoreActionTransforms() {
    for (const { object, position, quaternion, scale } of this._actionTransforms.values()) {
      object.position.copy(position);
      object.quaternion.copy(quaternion);
      object.scale.copy(scale);
    }
  }

  _createCampClearing() {
    const group = this._group('day_one_camp_identity', 'camp');
    const matWood = this._material('day_one_sign_wood', PALETTE.wood);
    const matCream = this._material('day_one_sign_cream', PALETTE.cream);
    const post = this._mesh(
      'day_one_plot_sign_post',
      new CylinderGeometry(0.055, 0.075, 1.25, 7),
      matWood,
    );
    post.position.set(0.7, 0.62, -1.25);
    const sign = this._mesh(
      'day_one_plot_sign_board',
      new BoxGeometry(0.88, 0.42, 0.10),
      matCream,
    );
    sign.position.set(0.7, 1.0, -1.22);
    sign.rotation.z = -0.045;
    const knot = this._mesh(
      'day_one_plot_sign_knot',
      new SphereGeometry(0.075, 9, 6),
      matWood,
    );
    knot.scale.set(1.45, 0.55, 0.25);
    knot.position.set(0.7, 1.0, -1.16);
    group.add(post, sign, knot);
    this.root.add(group);
  }

  _createShelter() {
    const group = this._group('day_one_shelter_visual', 'shelter');
    group.rotation.y = 0.23;
    this.shelterVisual = group;
    const canvas = this._material('day_one_tent_canvas', PALETTE.canvas, {
      roughness: 1,
      side: DoubleSide,
    });
    const shade = this._material('day_one_tent_canvas_shade', PALETTE.canvasShade, {
      roughness: 1,
      side: DoubleSide,
    });
    const wood = this._material('day_one_tent_poles', PALETTE.woodDark);
    const blanket = this._material('day_one_bedroll_blanket', PALETTE.blanket);
    const cream = this._material('day_one_bedroll_pillow', PALETTE.pillow);
    const patch = this._material('day_one_tent_repair_patch', PALETTE.patch, {
      roughness: 0.95,
      side: DoubleSide,
    });

    this.shelterCollapsed = this._group('day_one_shelter_collapsed');
    const canvasBundle = this._mesh(
      'day_one_collapsed_canvas_bundle',
      new BoxGeometry(2.2, 0.14, 1.62),
      shade,
    );
    canvasBundle.position.set(0, 0.14, 0);
    canvasBundle.rotation.set(0.04, -0.12, 0.035);
    const canvasFold = this._mesh(
      'day_one_collapsed_canvas_fold',
      new BoxGeometry(1.45, 0.1, 0.78),
      canvas,
    );
    canvasFold.position.set(-0.18, 0.25, 0.14);
    canvasFold.rotation.y = 0.17;
    const fallenRidge = this._mesh(
      'day_one_collapsed_ridge_pole',
      new CylinderGeometry(0.045, 0.055, 2.95, 7),
      wood,
    );
    fallenRidge.rotation.x = Math.PI / 2;
    fallenRidge.position.set(0.32, 0.12, -0.08);
    const fallenSupport = this._mesh(
      'day_one_collapsed_support_pole',
      new CylinderGeometry(0.035, 0.055, 1.7, 7),
      wood,
    );
    fallenSupport.rotation.z = Math.PI / 2;
    fallenSupport.position.set(-0.18, 0.13, 0.32);
    const rolledBedroll = this._mesh(
      'day_one_collapsed_bedroll',
      new CylinderGeometry(0.18, 0.18, 1.4, 12),
      blanket,
    );
    rolledBedroll.rotation.z = Math.PI / 2;
    rolledBedroll.position.set(-0.12, 0.26, -0.5);

    this.shelterTear = this._mesh(
      'day_one_shelter_torn_flap',
      new PlaneGeometry(0.54, 0.66),
      shade,
      { cast: false },
    );
    this.shelterTear.position.set(0.38, 0.29, -0.14);
    this.shelterTear.rotation.set(-Math.PI / 2, 0, -0.24);
    this._rememberActionTransform('shelter-tear', this.shelterTear);
    this.shelterCollapsed.add(
      canvasBundle,
      canvasFold,
      fallenRidge,
      fallenSupport,
      rolledBedroll,
      this.shelterTear,
    );
    group.add(this.shelterCollapsed);

    this.shelterErected = this._group('day_one_shelter_erected');

    for (const side of [-1, 1]) {
      const panel = this._mesh(
        `day_one_tent_canvas_${side < 0 ? 'left' : 'right'}`,
        new BoxGeometry(1.45, 0.07, 2.55),
        side < 0 ? shade : canvas,
      );
      panel.position.set(side * 0.55, 0.83, 0);
      panel.rotation.z = side * -0.69;
      this.shelterErected.add(panel);
    }

    const ridge = this._mesh(
      'day_one_tent_ridge_pole',
      new CylinderGeometry(0.045, 0.055, 2.95, 7),
      wood,
    );
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = 1.39;
    this.shelterErected.add(ridge);
    for (const z of [-1.36, 1.36]) {
      for (const side of [-1, 1]) {
        const support = this._mesh(
          'day_one_tent_support',
          new CylinderGeometry(0.035, 0.055, 1.7, 7),
          wood,
        );
        support.position.set(side * 0.55, 0.68, z);
        support.rotation.z = side * -0.7;
        this.shelterErected.add(support);
      }
    }

    const bedroll = this._mesh(
      'day_one_bedroll',
      new BoxGeometry(1.28, 0.16, 1.9),
      blanket,
    );
    bedroll.position.set(0, 0.13, 0.1);
    const pillow = this._mesh(
      'day_one_bedroll_pillow',
      new SphereGeometry(0.36, 14, 8),
      cream,
    );
    pillow.scale.set(1.3, 0.35, 0.72);
    pillow.position.set(0, 0.29, 0.72);
    this.shelterErected.add(bedroll, pillow);

    this.shelterRepair = this._group('day_one_shelter_repair_visible');
    const patchMesh = this._mesh(
      'day_one_shelter_mended_patch',
      new PlaneGeometry(0.66, 0.76),
      patch,
      { cast: false },
    );
    patchMesh.position.set(0.82, 0.75, -0.28);
    patchMesh.rotation.set(0.18, -0.04, -0.69);
    const tie = this._mesh(
      'day_one_shelter_new_tie',
      new CylinderGeometry(0.025, 0.025, 1.0, 6),
      patch,
    );
    tie.position.set(-0.96, 0.55, -1.18);
    tie.rotation.z = -0.12;
    this.shelterRepair.add(patchMesh, tie);
    this._rememberActionTransform('shelter-repair', this.shelterRepair);
    this.shelterErected.add(this.shelterRepair);
    group.add(this.shelterErected);
    this._rememberActionTransform('shelter', group);
    this.root.add(group);
  }

  _createCampfire() {
    const group = this._group('day_one_campfire_visual', 'campfire');
    this.campfireVisual = group;
    const stone = this._material('day_one_fire_stone', PALETTE.stone, {
      flatShading: true,
      roughness: 1,
    });
    const wood = this._material('day_one_firewood', PALETTE.woodDark);
    const flame = this._material('day_one_flame_outer', PALETTE.fire, {
      emissive: PALETTE.fire,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const flameInner = this._material('day_one_flame_inner', PALETTE.fireInner, {
      emissive: PALETTE.fireInner,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const fish = this._material('day_one_cooked_fish', PALETTE.fishLight);

    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2;
      const rock = this._mesh(
        'day_one_fire_ring_stone',
        new IcosahedronGeometry(0.18 + (index % 2) * 0.025, 0),
        stone,
      );
      rock.scale.y = 0.68;
      rock.position.set(Math.cos(angle) * 0.49, 0.13, Math.sin(angle) * 0.49);
      rock.rotation.set(index * 0.17, index * 0.31, 0);
      group.add(rock);
    }
    for (const rotation of [-0.72, 0.72]) {
      const log = this._mesh(
        'day_one_fire_laid_log',
        new CylinderGeometry(0.11, 0.13, 0.94, 7),
        wood,
      );
      log.rotation.set(0, 0, Math.PI / 2);
      log.rotation.y = rotation;
      log.position.y = 0.19;
      group.add(log);
    }

    this.fireFlame = this._group('day_one_fire_flame');
    const outer = this._mesh(
      'day_one_fire_flame_outer',
      new ConeGeometry(0.28, 0.72, 9),
      flame,
      { receive: false },
    );
    outer.position.y = 0.58;
    const inner = this._mesh(
      'day_one_fire_flame_inner',
      new ConeGeometry(0.15, 0.43, 8),
      flameInner,
      { receive: false },
    );
    inner.position.set(0.025, 0.48, 0.02);
    this.fireLight = new PointLight(PALETTE.fireInner, 1.2, 5.5, 2);
    this.fireLight.name = 'day_one_fire_light';
    this.fireLight.position.y = 0.85;
    this.fireLight.castShadow = false;
    this.fireFlame.add(outer, inner, this.fireLight);
    group.add(this.fireFlame);

    this.cookedFishVisual = this._group('day_one_cooked_fish_on_spit');
    for (const x of [-0.64, 0.64]) {
      const support = this._mesh(
        'day_one_cooking_spit_support',
        new CylinderGeometry(0.025, 0.035, 1.05, 6),
        wood,
      );
      support.position.set(x, 0.5, 0);
      support.rotation.z = x < 0 ? -0.23 : 0.23;
      this.cookedFishVisual.add(support);
    }
    const spit = this._mesh(
      'day_one_cooking_spit',
      new CylinderGeometry(0.025, 0.025, 1.55, 6),
      wood,
    );
    spit.rotation.z = Math.PI / 2;
    const meal = this._mesh(
      'day_one_cooked_fish_meal',
      new SphereGeometry(0.19, 11, 7),
      fish,
    );
    meal.scale.set(1.5, 0.62, 0.34);
    meal.position.y = 0.01;
    this.fishRotor = this._group('day_one_fish_rotor');
    this.fishRotor.position.y = 0.72;
    this.fishRotor.add(spit, meal);
    this.cookedFishVisual.add(this.fishRotor);
    this._rememberActionTransform('cooked-fish', this.cookedFishVisual);
    this._rememberActionTransform('fish-rotor', this.fishRotor);
    group.add(this.cookedFishVisual);
    this._rememberActionTransform('campfire', group);
    this.root.add(group);
  }

  _createGarden() {
    const group = this._group('day_one_garden_visual', 'garden');
    group.rotation.y = -0.18;
    this.gardenVisual = group;
    this.drySoilMaterial = this._material('day_one_garden_dry_soil', PALETTE.soil, {
      roughness: 1,
    });
    this.wetSoilMaterial = this._material('day_one_garden_wet_soil', PALETTE.wetSoil, {
      roughness: 0.72,
    });
    const wood = this._material('day_one_garden_border', PALETTE.cutWood);
    const seed = this._material('day_one_garden_seed_mound', 0x6f4a3c, { roughness: 1 });
    const water = this._material('day_one_garden_water_glint', PALETTE.water, {
      emissive: PALETTE.water,
      emissiveIntensity: 0.24,
      transparent: true,
      opacity: 0.78,
      side: DoubleSide,
      depthWrite: false,
    });

    for (const x of [-0.52, 0, 0.52]) {
      const soil = this._mesh(
        'day_one_garden_soil_row',
        new BoxGeometry(0.42, 0.10, 2.15),
        this.drySoilMaterial,
        { cast: false },
      );
      soil.position.set(x, 0.08, 0);
      this._soilMeshes.push(soil);
      group.add(soil);
    }
    for (const x of [-0.91, 0.91]) {
      const rail = this._mesh(
        'day_one_garden_border_rail',
        new BoxGeometry(0.10, 0.15, 2.55),
        wood,
      );
      rail.position.set(x, 0.12, 0);
      group.add(rail);
    }
    for (const z of [-1.23, 1.23]) {
      const rail = this._mesh(
        'day_one_garden_border_rail',
        new BoxGeometry(1.9, 0.15, 0.10),
        wood,
      );
      rail.position.set(0, 0.12, z);
      group.add(rail);
    }

    this.plantedSeeds = this._group('day_one_garden_planted_seeds');
    this.wateredGlints = this._group('day_one_garden_watered_glints');
    for (let index = 0; index < 9; index += 1) {
      const x = [-0.52, 0, 0.52][index % 3];
      const z = [-0.72, 0, 0.72][Math.floor(index / 3)];
      const mound = this._mesh(
        'day_one_garden_seed_mound',
        new SphereGeometry(0.12, 9, 5),
        seed,
        { cast: false },
      );
      mound.scale.set(1, 0.28, 1.25);
      mound.position.set(x, 0.17, z);
      this.plantedSeeds.add(mound);

      const glint = this._mesh(
        'day_one_garden_water_glint',
        new CircleGeometry(0.10, 12),
        water,
        { cast: false, receive: false },
      );
      glint.rotation.x = -Math.PI / 2;
      glint.position.set(x + 0.04, 0.19, z - 0.03);
      this.wateredGlints.add(glint);
    }
    group.add(this.plantedSeeds, this.wateredGlints);
    this._rememberActionTransform('garden', group);
    this.root.add(group);
  }

  _createWoodlot() {
    const group = this._group('day_one_woodlot_visual', 'woodlot');
    group.rotation.y = -0.32;
    const bark = this._material('day_one_woodlot_bark', PALETTE.bark, {
      flatShading: true,
      roughness: 1,
    });
    const cut = this._material('day_one_woodlot_cut', PALETTE.cutWood, {
      roughness: 1,
    });
    const metal = this._material('day_one_axe_head', 0x81909a, {
      roughness: 0.46,
      metalness: 0.35,
    });

    const stump = this._mesh(
      'day_one_chopping_stump',
      new CylinderGeometry(0.46, 0.56, 0.62, 10),
      bark,
    );
    stump.position.set(0, 0.31, 0);
    const stumpTop = this._mesh(
      'day_one_chopping_stump_cut',
      new CylinderGeometry(0.43, 0.43, 0.025, 12),
      cut,
    );
    stumpTop.position.set(0, 0.63, 0);
    group.add(stump, stumpTop);

    const placements = [
      [-0.82, 0.19, -0.46, 0.1],
      [-0.94, 0.42, 0.15, -0.15],
      [-0.72, 0.19, 0.66, 0.28],
      [0.78, 0.19, 0.58, -0.18],
      [0.88, 0.19, -0.58, 0.22],
    ];
    for (const [x, y, z, yaw] of placements) {
      const piece = this._group('day_one_gatherable_log');
      piece.position.set(x, y, z);
      piece.rotation.set(0, yaw, Math.PI / 2);
      const log = this._mesh(
        'day_one_gatherable_log_bark',
        new CylinderGeometry(0.15, 0.17, 0.92, 8),
        bark,
      );
      const end = this._mesh(
        'day_one_gatherable_log_cut',
        new CylinderGeometry(0.14, 0.14, 0.018, 9),
        cut,
      );
      end.position.y = 0.47;
      piece.add(log, end);
      this._woodPieces.push(piece);
      group.add(piece);
    }

    const axe = this._group('day_one_woodlot_axe');
    const handle = this._mesh(
      'day_one_axe_handle',
      new CylinderGeometry(0.035, 0.045, 0.92, 7),
      cut,
    );
    const head = this._mesh(
      'day_one_axe_head',
      new BoxGeometry(0.34, 0.17, 0.11),
      metal,
    );
    head.position.y = 0.43;
    axe.add(handle, head);
    axe.position.set(0.22, 1.03, 0);
    axe.rotation.z = -0.22;
    this.woodlotAxe = axe;
    this._rememberActionTransform('woodlot-axe', axe);
    group.add(axe);
    this.root.add(group);
  }

  _createFishingSpot() {
    const group = this._group('day_one_fishing_spot_visual', 'fishingSpot');
    const wood = this._material('day_one_fishing_planks', PALETTE.wood);
    const woodDark = this._material('day_one_fishing_rod', PALETTE.woodDark);
    const bobber = this._material('day_one_fishing_bobber', 0xff806f, {
      emissive: 0x7b2c22,
      emissiveIntensity: 0.08,
    });
    const fish = this._material('day_one_fish_catch', PALETTE.fish, {
      roughness: 0.62,
    });
    const fishLight = this._material('day_one_fish_belly', PALETTE.fishLight);

    for (let index = 0; index < 4; index += 1) {
      const plank = this._mesh(
        'day_one_fishing_bank_plank',
        new BoxGeometry(0.48, 0.11, 1.18),
        wood,
      );
      plank.position.set(index * 0.43 - 0.25, 0.13 + index * 0.006, 0);
      plank.rotation.y = Math.PI / 2;
      group.add(plank);
    }

    const rod = this._mesh(
      'day_one_fishing_rod',
      new CylinderGeometry(0.025, 0.045, 2.05, 7),
      woodDark,
    );
    rod.position.set(0.16, 0.9, -0.56);
    rod.rotation.z = -0.88;
    this.fishingRod = rod;
    this._rememberActionTransform('fishing-rod', rod);
    group.add(rod);

    this.fishingBobber = this._group('day_one_fishing_bobber_group');
    const float = this._mesh(
      'day_one_fishing_bobber',
      new SphereGeometry(0.10, 10, 7),
      bobber,
      { cast: false },
    );
    float.scale.y = 1.35;
    this.fishingBobber.position.set(1.72, 0.16, 0.08);
    this._rememberActionTransform('fishing-bobber', this.fishingBobber);
    this.fishingBobber.add(float);
    group.add(this.fishingBobber);

    this.fishCatch = this._group('day_one_fish_catch_visible');
    const body = this._mesh(
      'day_one_fish_catch_body',
      new SphereGeometry(0.25, 12, 7),
      fish,
    );
    body.scale.set(1.45, 0.62, 0.35);
    const tail = this._mesh(
      'day_one_fish_catch_tail',
      new ConeGeometry(0.22, 0.35, 3),
      fishLight,
    );
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.46;
    this.fishCatch.add(body, tail);
    this.fishCatch.position.set(-0.55, 0.30, 0.62);
    this.fishCatch.rotation.y = 0.35;
    group.add(this.fishCatch);
    this.root.add(group);
  }

  _createInteractables() {
    this.interactables = DAY_ONE_WORLD_INTERACTIONS.map((contract) => {
      const anchor = this.layout.dayOne[contract.site];
      return {
        id: contract.id,
        position: new Vector3(anchor.x, anchor.y || 0, anchor.z),
        radius: contract.radius,
        prompt: contract.prompt,
      };
    });
  }

  setState(snapshot) {
    const dayOne = snapshot?.dayOne || snapshot || {};
    this._state = dayOne;
    const camp = dayOne.camp || {};
    const garden = dayOne.garden || {};
    const shelter = dayOne.shelter || {};
    const inventory = dayOne.inventory || {};
    const activity = dayOne.activity || dayOne.activities || {};

    const fireLit = Boolean(stateValue(camp.fireLit, dayOne.fireLit, false));
    const shelterRepaired = Boolean(stateValue(
      camp.shelterRepaired,
      shelter.repaired,
      dayOne.shelterRepaired,
      false,
    ));
    const planted = Boolean(stateValue(garden.planted, dayOne.planted, false));
    const watered = Boolean(stateValue(garden.watered, dayOne.watered, false));
    const woodGathered = Math.max(0, numeric(stateValue(
      activity.woodGathered,
      dayOne.woodGathered,
      inventory.wood,
      0,
    )));
    const fishCaught = Math.max(0, numeric(stateValue(
      activity.fishCaught,
      dayOne.fishCaught,
      inventory.rawFish,
      inventory.fish,
      0,
    )));
    const cookedFish = Math.max(0, numeric(stateValue(
      inventory.cookedFish,
      inventory.fishCooked,
      dayOne.cookedFish,
      0,
    )));

    if (this.fireFlame) this.fireFlame.visible = fireLit;
    if (this.fireLight) this.fireLight.intensity = fireLit ? 1.2 : 0;
    if (this.cookedFishVisual) this.cookedFishVisual.visible = fireLit && cookedFish > 0;
    if (this.shelterCollapsed) this.shelterCollapsed.visible = !shelterRepaired;
    if (this.shelterErected) this.shelterErected.visible = shelterRepaired;
    if (this.shelterRepair) this.shelterRepair.visible = shelterRepaired;
    if (this.shelterTear) this.shelterTear.visible = !shelterRepaired;
    if (this.plantedSeeds) this.plantedSeeds.visible = planted;
    if (this.wateredGlints) this.wateredGlints.visible = planted && watered;
    for (const soil of this._soilMeshes) {
      soil.material = watered ? this.wetSoilMaterial : this.drySoilMaterial;
    }
    const removedLogs = Math.min(this._woodPieces.length, Math.floor(woodGathered / 2));
    this._woodPieces.forEach((piece, index) => {
      piece.visible = index >= removedLogs;
    });
    if (this.fishingBobber) this.fishingBobber.visible = fishCaught < 1;
    if (this.fishCatch) this.fishCatch.visible = fishCaught > 0;
    return dayOne;
  }

  /** Project transient action-clock events into code-native prop motion. */
  handleAction(event) {
    if (!this.initialized || this.disposed || !event?.id) return false;
    if (event.type === 'start') {
      this._restoreActionTransforms();
      this._actionCue = event;
      return true;
    }
    if (this._actionCue?.id !== event.id) return false;
    if (event.type === 'complete' || event.type === 'cancel' || event.type === 'error') {
      this._actionCue = null;
      this._restoreActionTransforms();
      this.setState(this._state);
      return true;
    }
    this._actionCue = event;
    return true;
  }

  _applyActionCue() {
    const event = this._actionCue;
    if (!event || this.reducedMotion) return;
    this._restoreActionTransforms();
    const progress = Math.min(1, Math.max(0, numeric(event.progress)));
    const contactProgress = Math.min(1, Math.max(
      0.01,
      numeric(event.commitTime, 1) / Math.max(0.01, numeric(event.duration, 1)),
    ));
    const beforeContact = Math.min(1, progress / contactProgress);
    const effort = Math.sin(Math.PI * progress);

    switch (event.action?.worldCue) {
      case 'chop-wood':
        if (this.woodlotAxe) {
          this.woodlotAxe.rotation.z -= Math.sin(beforeContact * Math.PI * 2.5) * 0.62;
          this.woodlotAxe.position.y += effort * 0.08;
        }
        break;
      case 'catch-fish':
        if (this.fishingRod) this.fishingRod.rotation.z += effort * 0.28;
        if (this.fishingBobber?.visible) {
          this.fishingBobber.position.y -= Math.sin(beforeContact * Math.PI) * 0.11;
        }
        break;
      case 'light-fire':
        if (this.campfireVisual) {
          const pulse = 1 + effort * 0.035;
          this.campfireVisual.scale.setScalar(pulse);
        }
        break;
      case 'cook-fish':
        if (this.fishRotor) {
          this.cookedFishVisual.visible = true;
          this.fishRotor.rotation.x += progress * Math.PI * 2;
        }
        break;
      case 'eat-fish':
        if (this.cookedFishVisual?.visible) {
          this.cookedFishVisual.scale.multiplyScalar(Math.max(0.28, 1 - beforeContact * 0.68));
          this.cookedFishVisual.position.y += effort * 0.1;
        }
        break;
      case 'plant-seed':
      case 'water-seed':
        if (this.gardenVisual) {
          const settle = 1 - effort * 0.018;
          this.gardenVisual.scale.set(settle, 1 + effort * 0.025, settle);
        }
        break;
      case 'repair-shelter':
        if (this.shelterTear?.visible) this.shelterTear.rotation.z += effort * 0.16;
        if (this.shelterVisual) this.shelterVisual.rotation.z += Math.sin(progress * Math.PI * 4) * 0.018;
        break;
      default:
        break;
    }
  }

  update(dt) {
    if (!this.initialized || this.disposed) return;
    if (this.reducedMotion) return;
    this.time += Math.min(Math.max(numeric(dt), 0), 0.1);
    if (this.fireFlame?.visible) {
      const flicker = 1 + Math.sin(this.time * 15.5) * 0.06;
      this.fireFlame.scale.set(flicker, 0.97 + Math.sin(this.time * 18.3) * 0.08, flicker);
      this.fireLight.intensity = 1.12 + Math.sin(this.time * 19.1) * 0.13;
    }
    if (this.fishingBobber?.visible) {
      this.fishingBobber.position.y = 0.16 + Math.sin(this.time * 2.2) * 0.025;
    }
    if (this.wateredGlints?.visible) {
      this.wateredGlints.rotation.y = Math.sin(this.time * 0.8) * 0.06;
    }
    // The committed chore pose wins over ambient prop motion for this frame.
    this._applyActionCue();
  }

  dispose() {
    if (this.disposed) return;
    this._restoreActionTransforms();
    this.setState(this._state);
    this._actionCue = null;
    this.disposed = true;
    this.root.removeFromParent();
    for (const geometry of this._geometries) geometry.dispose();
    for (const material of this._materials) material.dispose();
    this._geometries.clear();
    this._materials.clear();
    this._actionTransforms.clear();
    this.interactables.length = 0;
  }
}

export function createDayOneWorld(options) {
  return new DayOneWorld(options).init();
}
