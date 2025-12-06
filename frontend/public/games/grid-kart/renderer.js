
// Ensure TILE constants match those used in generator.js and engine.js
import { TILE } from './generator.js';

// We will assume THREE is available globally via CDN in index.html

export class Renderer {
    constructor(canvasId) {
        console.log('Renderer: Initializing...');
        this.container = document.getElementById('game-container');

        // Remove old canvas if it exists in a way we don't want, but actually
        // Three.js renderer can append its own, or use existing.
        // The index.html has <canvas id="gameCanvas">.
        const existingCanvas = document.getElementById(canvasId);

        if (!existingCanvas) {
            console.error('Renderer: Canvas not found!');
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510); // Deep space/grid blue
        this.scene.fog = new THREE.FogExp2(0x050510, 0.035);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

        this.renderer = new THREE.WebGLRenderer({
            canvas: existingCanvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffd700, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        // Default shadow map size is 512x512, which is fine.
        // Removing explicit access to .width to avoid potential issues in some environments.

        this.scene.add(dirLight);

        // Materials
        this.materials = {
            road: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }),
            wall: new THREE.MeshStandardMaterial({
                color: 0x00bcd4,
                emissive: 0x00bcd4,
                emissiveIntensity: 0.2,
                roughness: 0.2
            }),
            grass: new THREE.MeshStandardMaterial({ color: 0x004d40, roughness: 0.9 }),
            mud: new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0 }),
            boost: new THREE.MeshStandardMaterial({
                color: 0xffea00,
                emissive: 0xffea00,
                emissiveIntensity: 0.8
            }),
            start: new THREE.MeshStandardMaterial({ color: 0xffffff }), // Checkerboard shader ideally
            jump: new THREE.MeshStandardMaterial({ color: 0xff5722 })
        };

        this.meshes = [];
        this.kartMesh = null;
        this.kartGroup = null;
        this.wheels = [];
        console.log('Renderer: Initialized.');
    }

    buildMap(mapData) {
        console.log('Renderer: Building Map...');
        const geometryBox = new THREE.BoxGeometry(1, 0.5, 1); // Walls
        const geometryPlane = new THREE.PlaneGeometry(1, 1);  // Floor

        for(let y=0; y<mapData.rows; y++) {
            for(let x=0; x<mapData.cols; x++) {
                const type = mapData.grid[y][x];

                // Floor
                let mat = this.materials.road;
                if (type === TILE.GRASS) mat = this.materials.grass;
                if (type === TILE.MUD) mat = this.materials.mud;
                if (type === TILE.BOOST) mat = this.materials.boost;
                if (type === TILE.START) mat = this.materials.start;
                if (type === TILE.JUMP) mat = this.materials.jump;
                if (type === TILE.WALL) mat = this.materials.wall;

                // Draw Floor Tile (except for walls, they are tall blocks)
                if (type !== TILE.WALL) {
                    const floor = new THREE.Mesh(geometryPlane, mat);
                    floor.rotation.x = -Math.PI / 2;
                    floor.position.set(x + 0.5, 0, y + 0.5); // Center in tile
                    floor.receiveShadow = true;
                    this.scene.add(floor);
                } else {
                    // Wall
                    const wall = new THREE.Mesh(geometryBox, this.materials.wall);
                    wall.position.set(x + 0.5, 0.25, y + 0.5);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    this.scene.add(wall);
                }
            }
        }

        // Add a giant floor plane below everything for "Abyss"
        const abyssGeo = new THREE.PlaneGeometry(1000, 1000);
        const abyssMat = new THREE.MeshBasicMaterial({ color: 0x001010 });
        const abyss = new THREE.Mesh(abyssGeo, abyssMat);
        abyss.rotation.x = -Math.PI / 2;
        abyss.position.y = -0.1;
        this.scene.add(abyss);
        console.log('Renderer: Map Built.');
    }

    createKart() {
        console.log('Renderer: Creating Kart...');
        this.kartGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe91e63, roughness: 0.3 }); // Pink/Red
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.2;
        body.castShadow = true;
        this.kartGroup.add(body);

        // Head/Driver
        const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 0.4, -0.05);
        this.kartGroup.add(head);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        const positions = [
            { x: -0.25, z: 0.2, name: 'FL' },
            { x: 0.25,  z: 0.2, name: 'FR' },
            { x: -0.25, z: -0.2, name: 'BL' },
            { x: 0.25,  z: -0.2, name: 'BR' },
        ];

        positions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(pos.x, 0.1, pos.z);
            this.wheels.push(wheel); // Store for animation
            this.kartGroup.add(wheel);
        });

        // Engine Glow / Trail emitter point
        const glowGeo = new THREE.SphereGeometry(0.05);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(0, 0.2, 0.3); // Back
        this.kartGroup.add(glow);
        this.exhaust = glow;

        this.scene.add(this.kartGroup);
    }

    update(kart, dt) {
        if (!this.kartGroup) return;

        // 1. Sync Position
        this.kartGroup.position.set(kart.x, kart.z, kart.y);

        // 2. Sync Rotation
        this.kartGroup.rotation.set(0, kart.angle, 0);

        // 2b. Visual Visuals (Tilt/Roll)
        const lean = kart.steerValue * 0.2;
        this.kartGroup.rotation.z = -lean; // Roll

        let pitch = 0;
        if (kart.vz > 0) pitch = -0.2; // Nose up
        this.kartGroup.rotation.x = pitch;

        // Wheel Rotation
        const speed = Math.hypot(kart.vx, kart.vy);
        this.wheels.forEach(w => {
            w.rotation.x += speed * 2; // Spin
        });

        // Front wheels turn
        this.wheels[0].rotation.y = kart.steerValue * 0.5;
        this.wheels[1].rotation.y = kart.steerValue * 0.5;


        // 3. Camera Chase
        const dist = 3.5;
        const height = 2.0;

        const camTargetX = kart.x - Math.cos(kart.angle) * dist;
        const camTargetZ = kart.y - Math.sin(kart.angle) * dist;
        const camTargetY = kart.z + height;

        this.camera.position.x += (camTargetX - this.camera.position.x) * 0.1;
        this.camera.position.z += (camTargetZ - this.camera.position.z) * 0.1;
        this.camera.position.y += (camTargetY - this.camera.position.y) * 0.1;

        this.camera.lookAt(kart.x, kart.z + 0.5, kart.y);

        // 4. Effects
        if (kart.driftLevel === 1) this.exhaust.material.color.setHex(0x00e5ff); // Blue
        else if (kart.driftLevel === 2) this.exhaust.material.color.setHex(0xff3d00); // Red
        else this.exhaust.material.color.setHex(0x00e676); // Green (Normal)

        this.renderer.render(this.scene, this.camera);
    }
}
