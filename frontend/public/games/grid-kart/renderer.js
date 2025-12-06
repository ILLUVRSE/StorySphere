
import { TILE } from './generator.js';

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Renderer {
    constructor(canvasId) {
        console.log('Renderer: Initializing (Synthwave Mode)...');
        this.container = document.getElementById('game-container');
        const existingCanvas = document.getElementById(canvasId);

        if (!existingCanvas) {
            console.error('Renderer: Canvas not found!');
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510); // Deep space
        this.scene.fog = new THREE.FogExp2(0x050510, 0.035);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

        this.renderer = new THREE.WebGLRenderer({
            canvas: existingCanvas,
            antialias: false, // Antialias off for post-processing usually
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Post Processing - BLOOM
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Resolution, strength, radius, threshold
        const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
        bloomPass.threshold = 0.2;
        bloomPass.strength = 0.8; // Neon Intensity
        bloomPass.radius = 0.5;
        this.composer.addPass(bloomPass);

        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambient);

        // Synthwave Sun (Directional)
        const dirLight = new THREE.DirectionalLight(0xff00ff, 0.8); // Magenta tint
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        this.scene.add(dirLight);

        // Materials (Neon Style)
        this.materials = {
            road: new THREE.MeshStandardMaterial({
                color: 0x1a1a2e,
                roughness: 0.4,
                emissive: 0x0f0f3e,
                emissiveIntensity: 0.2
            }),
            wall: new THREE.MeshStandardMaterial({
                color: 0x00bcd4,
                emissive: 0x00bcd4,
                emissiveIntensity: 0.8, // Glowing walls
                roughness: 0.1,
                transparent: true,
                opacity: 0.8
            }),
            grass: new THREE.MeshStandardMaterial({
                color: 0x000000,
                emissive: 0x120024, // Dark purple grid floor
                roughness: 0.1,
                wireframe: false
            }),
            // We'll use a GridHelper for the "grass" to make it look like Tron
            mud: new THREE.MeshStandardMaterial({
                color: 0x5d4037,
                roughness: 1.0
            }),
            boost: new THREE.MeshStandardMaterial({
                color: 0xffea00,
                emissive: 0xffea00,
                emissiveIntensity: 2.0 // Blinding yellow
            }),
            start: new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 0.5
            }),
            jump: new THREE.MeshStandardMaterial({
                color: 0xff5722,
                emissive: 0xff5722,
                emissiveIntensity: 1.5
            }),
            itemBox: new THREE.MeshStandardMaterial({
                color: 0x00e5ff,
                emissive: 0x00e5ff,
                emissiveIntensity: 1.5,
                transparent: true,
                opacity: 0.8
            }),
            projectile: new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 2.0
            }),
            mine: new THREE.MeshStandardMaterial({
                color: 0xffaa00,
                emissive: 0xff3300,
                emissiveIntensity: 1.0
            })
        };

        this.meshes = [];
        this.kartGroups = new Map(); // Store by kart object
        this.projectiles = new Map();
        this.items = new Map();
    }

    buildMap(mapData) {
        // Clear
        while(this.scene.children.length > 0){
            this.scene.remove(this.scene.children[0]);
        }
        // Re-add lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xd500f9, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        console.log('Renderer: Building Map...');
        const geometryBox = new THREE.BoxGeometry(1, 0.5, 1);
        const geometryPlane = new THREE.PlaneGeometry(1, 1);

        // Item Box Geometry
        this.itemBoxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        // Projectile Geometry
        this.projectileGeo = new THREE.SphereGeometry(0.3);
        // Mine Geometry
        this.mineGeo = new THREE.ConeGeometry(0.3, 0.3, 8);

        for(let y=0; y<mapData.rows; y++) {
            for(let x=0; x<mapData.cols; x++) {
                const type = mapData.grid[y][x];

                // Floor
                let mat = this.materials.road;
                let isWall = false;
                let isFloor = true;

                if (type === TILE.GRASS) {
                    // Don't render grass tiles, we'll use a big grid instead for performance/style
                    isFloor = false;
                }
                if (type === TILE.MUD) mat = this.materials.mud;
                if (type === TILE.BOOST) mat = this.materials.boost;
                if (type === TILE.START) mat = this.materials.start;
                if (type === TILE.JUMP) mat = this.materials.jump;
                if (type === TILE.WALL) {
                    mat = this.materials.wall;
                    isWall = true;
                }

                if (isWall) {
                    const wall = new THREE.Mesh(geometryBox, mat);
                    wall.position.set(x + 0.5, 0.25, y + 0.5);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    this.scene.add(wall);

                    // Add neon edge
                    const edges = new THREE.EdgesGeometry(geometryBox);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ffff }));
                    wall.add(line);
                } else if (isFloor) {
                    const floor = new THREE.Mesh(geometryPlane, mat);
                    floor.rotation.x = -Math.PI / 2;
                    floor.position.set(x + 0.5, 0, y + 0.5);
                    floor.receiveShadow = true;
                    this.scene.add(floor);
                }
            }
        }

        // Giant Grid Floor
        const gridHelper = new THREE.GridHelper(200, 200, 0x9c27b0, 0x212121);
        gridHelper.position.set(mapData.cols/2, -0.05, mapData.rows/2);
        this.scene.add(gridHelper);

        // "Abyss" Plane
        const abyssGeo = new THREE.PlaneGeometry(1000, 1000);
        const abyssMat = new THREE.MeshBasicMaterial({ color: 0x050510 });
        const abyss = new THREE.Mesh(abyssGeo, abyssMat);
        abyss.rotation.x = -Math.PI / 2;
        abyss.position.y = -0.1;
        this.scene.add(abyss);
    }

    createKartMesh(colorHex) {
        const group = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.3,
            emissive: colorHex,
            emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.2;
        body.castShadow = true;
        group.add(body);

        // Engine Glow
        const engineGeo = new THREE.BoxGeometry(0.3, 0.1, 0.1);
        const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Cyan Trail
        const engine = new THREE.Mesh(engineGeo, engineMat);
        engine.position.set(0, 0.2, 0.3);
        group.add(engine);

        // Wheels (Neon Rings)
        const wheelGeo = new THREE.TorusGeometry(0.1, 0.05, 8, 16);
        const wheelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const positions = [
            { x: -0.25, z: 0.2 }, { x: 0.25, z: 0.2 },
            { x: -0.25, z: -0.2 }, { x: 0.25, z: -0.2 },
        ];

        const wheels = [];
        positions.forEach(pos => {
            const wGroup = new THREE.Group();
            const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wGroup.position.set(pos.x, 0.1, pos.z);
            wGroup.rotation.y = Math.PI / 2; // Face out
            wGroup.add(wMesh);
            group.add(wGroup);
            wheels.push(wGroup);
        });

        group.userData = { wheels, engine };
        return group;
    }

    update(playerKart, allKarts, items, projectiles, dt) {

        // 1. Manage Karts
        allKarts.forEach((kart, index) => {
            let group = this.kartGroups.get(kart);
            if (!group) {
                // Create new
                // Player is index 0 (Pink), AI are others (Green, Blue, Orange)
                const colors = [0xd500f9, 0x00e676, 0x2979ff, 0xff9100];
                group = this.createKartMesh(colors[index % colors.length]);
                this.scene.add(group);
                this.kartGroups.set(kart, group);
            }

            // Sync
            group.position.set(kart.x, kart.z, kart.y);
            group.rotation.set(0, kart.angle, 0);

            // Tilt
            const lean = kart.steerValue * 0.3;
            group.rotation.z = -lean;

            // Jump Pitch
            if (kart.vz > 0) group.rotation.x = -0.3;
            else group.rotation.x = 0;

            // Wheels
            group.userData.wheels[0].rotation.y = kart.steerValue * 0.5 + (Math.PI/2);
            group.userData.wheels[1].rotation.y = kart.steerValue * 0.5 + (Math.PI/2);

            // Spin effect if hit
            if(kart.spinoutTimer > 0) {
                 group.rotation.y += (Date.now() / 100);
            }
        });

        // 2. Manage Items (Boxes)
        // Simple reconciliation: clear and redraw is slow, let's track IDs or just pool
        // For simplicity in this step, we'll clear/add if count mismatch, or just move existing
        // Actually, items are static until picked up.

        // Remove picked up items
        this.items.forEach((mesh, itemObj) => {
            if (itemObj.active === false) {
                this.scene.remove(mesh);
                this.items.delete(itemObj);
            } else {
                mesh.rotation.y += 2 * dt;
                mesh.rotation.x += 1 * dt;
            }
        });

        // Add new items
        items.forEach(item => {
            if (!item.active) return;
            if (!this.items.has(item)) {
                let mesh;
                if(item.type === 'BOX') {
                    mesh = new THREE.Mesh(this.itemBoxGeo, this.materials.itemBox);
                } else if (item.type === 'MINE') {
                    mesh = new THREE.Mesh(this.mineGeo, this.materials.mine);
                }

                if(mesh) {
                    mesh.position.set(item.x, 0.5, item.y);
                    this.scene.add(mesh);
                    this.items.set(item, mesh);
                }
            }
        });

        // 3. Projectiles
        // Remove dead
        this.projectiles.forEach((mesh, proj) => {
            if (!proj.active) {
                this.scene.remove(mesh);
                this.projectiles.delete(proj);
            } else {
                mesh.position.set(proj.x, 0.5, proj.y);
            }
        });

        // Add new
        projectiles.forEach(proj => {
            if (proj.active && !this.projectiles.has(proj)) {
                const mesh = new THREE.Mesh(this.projectileGeo, this.materials.projectile);
                mesh.position.set(proj.x, 0.5, proj.y);
                this.scene.add(mesh);
                this.projectiles.set(proj, mesh);
            }
        });


        // 4. Camera Chase (Player Only)
        const dist = 4.0;
        const height = 2.5;

        const camTargetX = playerKart.x - Math.cos(playerKart.angle) * dist;
        const camTargetZ = playerKart.y - Math.sin(playerKart.angle) * dist; // Map Y is Scene Z
        const camTargetY = playerKart.z + height;

        this.camera.position.x += (camTargetX - this.camera.position.x) * 0.1;
        this.camera.position.z += (camTargetZ - this.camera.position.z) * 0.1;
        this.camera.position.y += (camTargetY - this.camera.position.y) * 0.1;

        this.camera.lookAt(playerKart.x, playerKart.z + 0.5, playerKart.y);

        // Render via Composer
        this.composer.render();
    }
}
