import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../game/sound';

interface ScrewState {
  mesh: THREE.Group;
  initialY: number;
  currentY: number;
  rotation: number;
  isUnscrewing: boolean;
  isUnscrewed: boolean;
  colorName: string;
}

export function Hero3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unscrewedCount, setUnscrewedCount] = useState<number>(0);
  const [hintText, setHintText] = useState<string>('CLICK A BOLT TO TEST 3D UNSCREW');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a0f);

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, -1.8, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Lighting setup (Industrial Studio)
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfffbeb, 2.8);
    dirLight1.position.set(5, 8, 8);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.6);
    dirLight2.position.set(-6, -4, 4);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 2.0);
    rimLight.position.set(0, -6, -4);
    scene.add(rimLight);

    // 3. Central Interactive Assembly Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Base Assembly Plate (Titanium Carbon Bevel Plate)
    const plateGeo = new THREE.BoxGeometry(4.6, 2.6, 0.3);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.25,
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.receiveShadow = true;
    plateMesh.castShadow = true;
    rootGroup.add(plateMesh);

    // Gold/Amber Chamfered Rim Frame
    const frameGeo = new THREE.BoxGeometry(4.75, 2.75, 0.2);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.3,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.08;
    rootGroup.add(frameMesh);

    // Upper Overlapping Angled Plate (Showcasing Layering)
    const subPlateGeo = new THREE.BoxGeometry(2.4, 1.6, 0.25);
    const subPlateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.35,
    });
    const subPlateMesh = new THREE.Mesh(subPlateGeo, subPlateMat);
    subPlateMesh.position.set(0.6, 0.2, 0.28);
    subPlateMesh.rotation.z = 0.08;
    subPlateMesh.castShadow = true;
    subPlateMesh.receiveShadow = true;
    rootGroup.add(subPlateMesh);

    // Helper to create detailed 3D Hex Bolt
    function createHexBolt(colorHex: number): THREE.Group {
      const boltGroup = new THREE.Group();

      // Outer hexagonal cap
      const hexGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 6);
      const boltMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.88,
        roughness: 0.2,
      });
      const hexMesh = new THREE.Mesh(hexGeo, boltMat);
      hexMesh.rotation.x = Math.PI / 2;
      hexMesh.castShadow = true;
      boltGroup.add(hexMesh);

      // Inner drive socket (Dark Torx / Hex socket)
      const socketGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 6);
      const socketMat = new THREE.MeshStandardMaterial({
        color: 0x030712,
        metalness: 0.95,
        roughness: 0.1,
      });
      const socketMesh = new THREE.Mesh(socketGeo, socketMat);
      socketMesh.rotation.x = Math.PI / 2;
      socketMesh.position.z = 0.08;
      boltGroup.add(socketMesh);

      // Threaded screw shaft below
      const shaftGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
      const shaftMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.9,
        roughness: 0.3,
      });
      const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
      shaftMesh.rotation.x = Math.PI / 2;
      shaftMesh.position.z = -0.35;
      boltGroup.add(shaftMesh);

      return boltGroup;
    }

    // Three Interactive Screws
    const screwConfigs = [
      { id: 'screw_amber', color: 0xf59e0b, name: 'Amber Forge', pos: [-1.4, 0.5, 0.32] },
      { id: 'screw_cyan', color: 0x06b6d4, name: 'Cyan Cryo', pos: [1.2, 0.4, 0.52] },
      { id: 'screw_rose', color: 0xf43f5e, name: 'Rose Titanium', pos: [0.1, -0.6, 0.45] },
    ];

    const screws: ScrewState[] = [];

    screwConfigs.forEach((cfg) => {
      const mesh = createHexBolt(cfg.color);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.userData = { id: cfg.id, name: cfg.name, colorHex: cfg.color };
      rootGroup.add(mesh);

      screws.push({
        mesh,
        initialY: cfg.pos[2],
        currentY: cfg.pos[2],
        rotation: 0,
        isUnscrewing: false,
        isUnscrewed: false,
        colorName: cfg.name,
      });
    });

    // Initial slight isometric tilt
    rootGroup.rotation.x = 0.35;
    rootGroup.rotation.y = -0.45;

    // 4. Raycasting & Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotX = 0.35;
    let targetRotY = -0.45;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        targetRotY += deltaX * 0.008;
        targetRotX += deltaY * 0.008;

        // Clamp tilt
        targetRotX = Math.max(-0.6, Math.min(0.9, targetRotX));
      }

      // Hover cursor check
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(screws.map((s) => s.mesh), true);
      container.style.cursor = hits.length > 0 ? 'pointer' : isDragging ? 'grabbing' : 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - prevMouseX, e.clientY - prevMouseY);
      isDragging = false;

      // Click detection if not dragged heavily
      if (dist < 8) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(screws.map((s) => s.mesh), true);

        if (hits.length > 0) {
          let topObj: THREE.Object3D | null = hits[0].object;
          while (topObj && !topObj.userData.id && topObj.parent) {
            topObj = topObj.parent;
          }

          if (topObj && topObj.userData.id) {
            const screwId = topObj.userData.id;
            const targetScrew = screws.find((s) => s.mesh.userData.id === screwId);
            if (targetScrew && !targetScrew.isUnscrewing && !targetScrew.isUnscrewed) {
              // Trigger physical audio synthesis!
              try {
                soundEngine.playUnscrew(true, 1);
              } catch {
                // AudioContext initialized on user gesture
              }

              targetScrew.isUnscrewing = true;
              setHintText(`UNSCREWED: ${targetScrew.colorName.toUpperCase()}`);
              setUnscrewedCount((c) => c + 1);
            }
          }
        }
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 5. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Smooth camera orbit damping
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.1;
      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.1;

      // Subtle ambient hover idle bob
      if (!isDragging) {
        targetRotY += 0.0015;
      }

      // Animate screws unscrewing and re-docking
      screws.forEach((screw) => {
        if (screw.isUnscrewing) {
          screw.mesh.position.z += delta * 1.8;
          screw.mesh.rotation.z += delta * 16.0;

          if (screw.mesh.position.z >= screw.initialY + 1.2) {
            screw.isUnscrewing = false;
            screw.isUnscrewed = true;

            // Reset after 2.5 seconds to keep it interactive
            setTimeout(() => {
              const resetInterval = setInterval(() => {
                screw.mesh.position.z -= 0.06;
                screw.mesh.rotation.z -= 0.4;
                if (screw.mesh.position.z <= screw.initialY) {
                  screw.mesh.position.z = screw.initialY;
                  screw.isUnscrewed = false;
                  clearInterval(resetInterval);
                }
              }, 16);
            }, 2000);
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // 6. Responsive resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[360px] md:h-[480px] rounded-2xl overflow-hidden border border-amber-500/30 bg-[#070A0F] shadow-[0_12px_40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(245,158,11,0.2)]">
      {/* 3D Canvas Mount */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive HUD Overlay Badges */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0C131F]/90 border border-amber-500/40 backdrop-blur-md shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs tracking-wider text-amber-300 font-bold uppercase">
            Interactive Three.js Sandbox
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C131F]/90 border border-sky-500/30 backdrop-blur-md">
          <span className="font-mono text-xs text-sky-400 font-medium">Unscrewed:</span>
          <span className="font-mono text-xs text-white font-bold">{unscrewedCount}</span>
        </div>
      </div>

      {/* Bottom Hint Banner */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-none">
        <div className="px-4 py-1.5 rounded-full bg-[#0C131F]/90 border border-slate-700/80 backdrop-blur-md shadow-xl text-center">
          <p className="font-mono text-xs font-semibold text-slate-300 tracking-wide">
            {hintText} <span className="text-amber-400">· DRAG TO ORBIT 360°</span>
          </p>
        </div>
      </div>
    </div>
  );
}
