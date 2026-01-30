/**
 * PhysicsWorld - Manages the Rapier physics simulation
 * 
 * Responsibilities:
 * - Initialize Rapier WASM
 * - Create and step the physics world
 * - Manage colliders and rigidbodies
 * - Debug rendering
 */

import * as THREE from 'three';

export class PhysicsWorld {
  constructor() {
    /** @type {import('@dimforge/rapier3d-compat').World} */
    this.world = null;
    
    /** @type {import('@dimforge/rapier3d-compat')} */
    this.RAPIER = null;
    
    // Fixed timestep accumulator
    this.fixedDt = 1 / 60;
    this.accumulator = 0;
    this.maxSubSteps = 5;
    
    // Debug rendering
    this.debugLines = null;
    this.debugEnabled = false;

    // Tracked kinematic platform visuals
    this.kinematicVisuals = [];
    
    // Collision groups
    this.GROUPS = {
      GROUND: 0x0001,
      PLAYER: 0x0002,
      DYNAMIC: 0x0004,
      PLATFORM: 0x0008,
      ALL: 0xFFFF,
    };
  }

  /**
   * Initialize Rapier WASM and create world
   */
  async init() {
    // Dynamic import for Rapier
    const RAPIER = await import('@dimforge/rapier3d-compat');
    await RAPIER.init();
    
    this.RAPIER = RAPIER;
    
    // Create world with gravity
    const gravity = { x: 0, y: -20, z: 0 };
    this.world = new RAPIER.World(gravity);
    
    console.log('[PhysicsWorld] Rapier initialized');
    return this;
  }

  /**
   * Step the physics simulation with fixed timestep
   * @param {number} dt - Delta time in seconds
   */
  step(dt) {
    if (!this.world) return;
    
    this.accumulator += dt;
    
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSubSteps) {
      this.world.step();
      this.accumulator -= this.fixedDt;
      steps++;
    }
    
    // Prevent spiral of death
    if (this.accumulator > this.fixedDt * 2) {
      this.accumulator = 0;
    }
  }

  /**
   * Create a static ground plane
   * @param {number} size - Size of the ground plane
   * @param {THREE.Scene} scene - Three.js scene for visual mesh
   */
  createGround(size = 50, scene) {
    const { RAPIER } = this;
    
    // Rapier collider - thin box as ground
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, -0.1, 0);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(size, 0.1, size)
      .setCollisionGroups(this.makeCollisionGroups(this.GROUPS.GROUND, this.GROUPS.ALL));
    this.world.createCollider(groundColliderDesc, groundBody);
    
    // Three.js visual
    if (scene) {
      const groundGeo = new THREE.BoxGeometry(size * 2, 0.2, size * 2);
      const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x90EE90,
        roughness: 0.8,
      });
      const groundMesh = new THREE.Mesh(groundGeo, groundMat);
      groundMesh.position.y = -0.1;
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);
    }
    
    return groundBody;
  }

  /**
   * Create a static box collider with optional visual mesh
   */
  createStaticBox(position, size = { x: 1, y: 1, z: 1 }, scene, options = {}) {
    const { RAPIER } = this;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setFriction(options.friction ?? 0.9)
      .setCollisionGroups(
        this.makeCollisionGroups(this.GROUPS.GROUND, this.GROUPS.ALL)
      );
    const collider = this.world.createCollider(colliderDesc, body);

    let mesh = null;
    if (scene) {
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mat = new THREE.MeshStandardMaterial({
        color: options.color ?? 0x8b8b8b,
        roughness: 0.9,
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(position.x, position.y, position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    return { body, collider, mesh };
  }

  /**
   * Create a dynamic box
   */
  createDynamicBox(position, size = { x: 1, y: 1, z: 1 }, scene) {
    const { RAPIER } = this;
    
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setDensity(1.0)
      .setFriction(0.5)
      .setRestitution(0.2)
      .setCollisionGroups(this.makeCollisionGroups(this.GROUPS.DYNAMIC, this.GROUPS.ALL));
    this.world.createCollider(colliderDesc, body);
    
    // Visual
    let mesh = null;
    if (scene) {
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0xFF6B35,
        roughness: 0.4,
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    
    return { body, mesh };
  }

  /**
   * Create a dynamic sphere
   */
  createDynamicSphere(position, radius = 0.5, scene) {
    const { RAPIER } = this;
    
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setDensity(1.0)
      .setFriction(0.3)
      .setRestitution(0.5)
      .setCollisionGroups(this.makeCollisionGroups(this.GROUPS.DYNAMIC, this.GROUPS.ALL));
    this.world.createCollider(colliderDesc, body);
    
    // Visual
    let mesh = null;
    if (scene) {
      const geo = new THREE.SphereGeometry(radius, 24, 16);
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0x4ECDC4,
        roughness: 0.3,
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    
    return { body, mesh };
  }

  /**
   * Create a kinematic platform
   */
  createKinematicPlatform(position, size = { x: 4, y: 0.5, z: 4 }, scene) {
    const { RAPIER } = this;
    
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setFriction(0.8)
      .setCollisionGroups(this.makeCollisionGroups(this.GROUPS.PLATFORM, this.GROUPS.ALL));
    const collider = this.world.createCollider(colliderDesc, body);
    
    // Visual
    let mesh = null;
    if (scene) {
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mat = new THREE.MeshStandardMaterial({ 
        color: 0x9B59B6,
        roughness: 0.5,
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.syncMeshToBody(body, mesh);
      this.kinematicVisuals.push({ body, mesh });
    }
    
    return { body, collider, mesh };
  }

  /**
   * Sync a visual mesh transform to a rigid body
   */
  syncMeshToBody(body, mesh) {
    if (!body || !mesh) return;
    const pos = body.translation();
    const rot = body.rotation();
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }

  /**
   * Keep kinematic platform visuals aligned with their rigid bodies
   */
  syncKinematicVisuals() {
    if (this.kinematicVisuals.length === 0) return;
    for (const { body, mesh } of this.kinematicVisuals) {
      this.syncMeshToBody(body, mesh);
    }
  }

  /**
   * Helper to create collision group bitmask
   */
  makeCollisionGroups(membership, filter) {
    // Rapier uses 32-bit: high 16 bits = membership, low 16 bits = filter
    return (membership << 16) | filter;
  }

  /**
   * Update debug line rendering
   */
  updateDebugRender(scene) {
    if (!this.debugEnabled || !this.world) {
      if (this.debugLines) {
        scene.remove(this.debugLines);
        this.debugLines.geometry.dispose();
        this.debugLines.material.dispose();
        this.debugLines = null;
      }
      return;
    }
    
    // Remove old lines
    if (this.debugLines) {
      scene.remove(this.debugLines);
      this.debugLines.geometry.dispose();
      this.debugLines.material.dispose();
    }
    
    // Get debug render data from Rapier
    const { vertices, colors } = this.world.debugRender();
    
    if (vertices.length === 0) return;
    
    // Create line geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    
    const material = new THREE.LineBasicMaterial({ 
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });
    
    this.debugLines = new THREE.LineSegments(geometry, material);
    this.debugLines.frustumCulled = false;
    scene.add(this.debugLines);
  }

  /**
   * Toggle debug rendering
   */
  setDebugEnabled(enabled) {
    this.debugEnabled = enabled;
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}
