let scene, camera, renderer;
let room, targets = [];

let faceMesh;
let videoElement;
let cameraUtils;
let isCalibrated = false;
let calibrationData = {
    centerX: 0,
    centerY: 0,
    baseDistance: 0
};

let smoothedX = 0;
let smoothedY = 0;
let smoothedDistance = 0;
const smoothingFactor = 0.05;

const screenWidth = 30;
const screenHeight = 20;
const maxTrackingDistance = 150;

async function init() {
    await setupCamera();
    await setupFaceTracking();
    setup3DScene();
    animate();
}

async function setupCamera() {
    try {
        videoElement = document.getElementById('video');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'user'
            }
        });
        videoElement.srcObject = stream;
        
        videoElement.onloadedmetadata = () => {
            document.getElementById('cameraStatus').textContent = 'Camera: Ready';
            document.getElementById('cameraStatus').className = 'status good';
        };
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        document.getElementById('cameraStatus').textContent = 'Camera: Error';
        document.getElementById('cameraStatus').className = 'status bad';
    }
}

async function setupFaceTracking() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    faceMesh.onResults(onFaceResults);
    
    if (videoElement) {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceMesh.send({image: videoElement});
            },
            width: 640,
            height: 480
        });
        camera.start();
    }
}

function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        
        const noseTip = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        
        const headX = (leftEye.x + rightEye.x) / 2;
        const headY = (leftEye.y + rightEye.y) / 2;
        
        const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) + 
            Math.pow(rightEye.y - leftEye.y, 2)
        );
        
        if (isCalibrated) {
            updateHeadTracking(headX, headY, eyeDistance);
            document.getElementById('trackingStatus').textContent = 'Tracking: Active';
            document.getElementById('trackingStatus').className = 'status good';
        } else {
            document.getElementById('trackingStatus').textContent = 'Tracking: Need Calibration';
            document.getElementById('trackingStatus').className = 'status bad';
        }
    } else {
        document.getElementById('trackingStatus').textContent = 'Tracking: No Face Detected';
        document.getElementById('trackingStatus').className = 'status bad';
    }
}
        

function updateHeadTracking(headX, headY, eyeDistance) {
    const deltaX = headX - calibrationData.centerX;
    const deltaY = headY - calibrationData.centerY;
    const deltaDistance = eyeDistance - calibrationData.baseDistance;
    
    const mappedX = (deltaX * maxTrackingDistance) * 0.8;
    const mappedY = -(deltaY * maxTrackingDistance) * 0.8;
    const mappedDistance = deltaDistance * 800;
    
    const dynamicSmoothing = Math.max(0.1, smoothingFactor * (1 - Math.abs(deltaDistance) / 100));
    smoothedX = smoothedX * (1 - dynamicSmoothing) + mappedX * dynamicSmoothing;
    smoothedY = smoothedY * (1 - dynamicSmoothing) + mappedY * dynamicSmoothing;
    smoothedDistance = smoothedDistance * (1 - smoothingFactor * 0.7) + mappedDistance * (smoothingFactor * 0.7);
    
    updateCameraPosition(smoothedX, smoothedY, smoothedDistance);
    
    document.getElementById('headX').textContent = smoothedX.toFixed(1);
    document.getElementById('headY').textContent = smoothedY.toFixed(1);
    document.getElementById('distance').textContent = smoothedDistance.toFixed(1);
}


function updateCameraPosition(x, y, distance) {
    const baseDistance = 25;
    const cameraX = x * 0.05;
    const cameraY = y * 0.05;
    
    camera.position.set(cameraX, cameraY, baseDistance);
    camera.lookAt(0, 0, 0);
    
    updateRoomProjection(x, y);
    
    updateDartPositions(x, y, distance);
}

function updateRoomProjection(offsetX, offsetY) {
    if (!room.userData.originalProjection) {
        room.userData.originalProjection = true;
    }
    
    const roomParallaxScale = 0.002;
    room.position.set(
        -offsetX * roomParallaxScale,
        offsetY * roomParallaxScale,
        0
    );
}
function updateDartPositions(offsetX, offsetY, distance) {
    targets.forEach((target, index) => {
        if (!target.userData.originalPosition) {
            target.userData.originalPosition = {
                x: target.position.x,
                y: target.position.y,
                z: target.position.z
            };
        }
        
        const originalPos = target.userData.originalPosition;
        
        const maxZ = -2;
        const minZ = -50;
        const normalizedDepth = (originalPos.z - minZ) / (maxZ - minZ);
        
        const parallaxMultiplier = 1 + (normalizedDepth * 3);
        
        const parallaxScale = 0.15;
        const newDartX = originalPos.x + (offsetX * parallaxScale * parallaxMultiplier);
        const newDartY = originalPos.y - (offsetY * parallaxScale * parallaxMultiplier);
        
        const depthScale = 0.08; // adjust this to control zooming sensitivity
        const depthMovement = distance * depthScale;
        
        const depthMultiplier = Math.max(0.1, 1 - Math.abs(originalPos.z) / 50);
        const newDartZ = originalPos.z + (depthMovement * depthMultiplier);
        
        target.position.set(newDartX, newDartY, newDartZ);
        target.lookAt(camera.position.x, camera.position.y, 25);
        
        if (dartLines[index]) {
            const dartLine = dartLines[index];
            const userData = dartLine.userData;
            
            const startX = newDartX;
            const startY = newDartY;
            const startZ = newDartZ;
            
            const endX = userData.fixedEndpointX;
            const endY = userData.fixedEndpointY;
            const endZ = userData.fixedEndpointZ;
            
            const newPoints = [
                startX, startY, startZ,
                endX, endY, endZ
            ];
            
            dartLine.geometry.setAttribute('position', 
                new THREE.Float32BufferAttribute(newPoints, 3));
            dartLine.geometry.attributes.position.needsUpdate = true;
        }
    });
}

function updateFOVZoom(distance) {
    const baseFOV = 60;
    const zoomFactor = Math.max(0.3, Math.min(2.0, 1 + (distance * 0.001)));    
    const newFOV = baseFOV / zoomFactor;
    
    const clampedFOV = Math.max(15, Math.min(120, newFOV));
    
    camera.fov = clampedFOV;
    camera.updateProjectionMatrix();
}

function updateTargetZoom(distance) {
    const zoomFactor = Math.max(0.5, Math.min(2.0, 1 + (distance * 0.003)));
    
    targets.forEach(target => {
        target.scale.set(zoomFactor, zoomFactor, zoomFactor);
    });
}

function updateOffAxisProjection(offsetX, offsetY) {
    const aspect = window.innerWidth / window.innerHeight;
    const fov = camera.fov; 
    const near = 0.1;
    const far = 1000;
    
    const fovRad = fov * Math.PI / 180;
    const top = near * Math.tan(fovRad / 2);
    const bottom = -top;
    const right = top * aspect;
    const left = -right;
    
    const offsetScale = 0.002;
    const leftOffset = left + offsetX * offsetScale;
    const rightOffset = right + offsetX * offsetScale;
    const topOffset = top - offsetY * offsetScale;
    const bottomOffset = bottom - offsetY * offsetScale;
    
    camera.projectionMatrix.makePerspective(
        leftOffset, rightOffset, topOffset, bottomOffset, near, far
    );
}


function setup3DScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 30, 200); 
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 25);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('canvas'), 
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    createInfiniteRoom();
    createTargets();

    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(10, 10, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    window.addEventListener('resize', onWindowResize);
}

function createInfiniteRoom() {
    const roomGroup = new THREE.Group();
    
    const width = 150;
    const height = 100;
    const depth = 200;
    const gridSpacing = 8;
    
    const createLineMaterial = (baseOpacity = 0.6) => {
        return new THREE.LineBasicMaterial({ 
            color: 0x666666,
            transparent: true,
            opacity: baseOpacity
        });
    };
    
    const floorGeometry = new THREE.BufferGeometry();
    const floorPoints = [];
    
    for (let z = -10; z >= -depth; z -= gridSpacing) {
        const opacity = Math.max(0.1, 1 - Math.abs(z) / depth);
        floorPoints.push(-width/2, -height/2, z);
        floorPoints.push(width/2, -height/2, z);
    }
    
    for (let x = -width/2; x <= width/2; x += gridSpacing) {
        floorPoints.push(x, -height/2, -10);
        floorPoints.push(x, -height/2, -depth);
    }
    
    floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(floorPoints, 3));
    const floorGrid = new THREE.LineSegments(floorGeometry, createLineMaterial(0.8));
    roomGroup.add(floorGrid);
    
    const ceilingGeometry = new THREE.BufferGeometry();
    const ceilingPoints = [];
    
    for (let z = -10; z >= -depth; z -= gridSpacing) {
        ceilingPoints.push(-width/2, height/2, z);
        ceilingPoints.push(width/2, height/2, z);
    }
    
    for (let x = -width/2; x <= width/2; x += gridSpacing) {
        ceilingPoints.push(x, height/2, -10);
        ceilingPoints.push(x, height/2, -depth);
    }
    
    ceilingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ceilingPoints, 3));
    const ceilingGrid = new THREE.LineSegments(ceilingGeometry, createLineMaterial(0.6));
    roomGroup.add(ceilingGrid);
    
    const leftWallGeometry = new THREE.BufferGeometry();
    const leftWallPoints = [];
    
    for (let z = -10; z >= -depth; z -= gridSpacing) {
        leftWallPoints.push(-width/2, -height/2, z);
        leftWallPoints.push(-width/2, height/2, z);
    }
    
    for (let y = -height/2; y <= height/2; y += gridSpacing) {
        leftWallPoints.push(-width/2, y, -10);
        leftWallPoints.push(-width/2, y, -depth);
    }
    
    leftWallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leftWallPoints, 3));
    const leftWallGrid = new THREE.LineSegments(leftWallGeometry, createLineMaterial(0.5));
    roomGroup.add(leftWallGrid);
    
    const rightWallGeometry = new THREE.BufferGeometry();
    const rightWallPoints = [];
    
    for (let z = -10; z >= -depth; z -= gridSpacing) {
        rightWallPoints.push(width/2, -height/2, z);
        rightWallPoints.push(width/2, height/2, z);
    }
    
    for (let y = -height/2; y <= height/2; y += gridSpacing) {
        rightWallPoints.push(width/2, y, -10);
        rightWallPoints.push(width/2, y, -depth);
    }
    
    rightWallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rightWallPoints, 3));
    const rightWallGrid = new THREE.LineSegments(rightWallGeometry, createLineMaterial(0.5));
    roomGroup.add(rightWallGrid);
    
    scene.add(roomGroup);
    room = roomGroup;
}
        
let dartLines = [];
function createTargets() {
    const positions = [
        {x: -8, y: 3, z: -5},     // close to screen
        {x: 5, y: 8, z: -8},      // medium distance
        {x: -12, y: -2, z: -7},   // medium distance
        {x: 10, y: -5, z: -11},   // medium distance
        {x: 0, y: 6, z: -15},     // far
        {x: -12, y: -8, z: -30},  // very far
        {x: 8, y: 2, z: -14},     // far
        {x: -20, y: 10, z: -50},  // extremely far
        {x: 15, y: -3, z: -2},    // very close to screen
        {x: -5, y: -10, z: -25},  // very far
        {x: 12, y: 12, z: -3},    // very close to screen
        {x: -25, y: 0, z: -40}    // extremely far
    ];

    positions.forEach((pos, index) => {
        const targetGroup = new THREE.Group();

        const scale = 1.0;

        const maxDistance = 50;
        const currentDistance = Math.abs(pos.z);
        const darkenFactor = Math.min(currentDistance / maxDistance, 0.6);

        const ringData = [
            { innerRadius: 0, outerRadius: 0.6 * scale, color: 0xff0000 },
            { innerRadius: 0.6 * scale, outerRadius: 1.2 * scale, color: 0xffffff },
            { innerRadius: 1.2 * scale, outerRadius: 1.8 * scale, color: 0xff0000 },
            { innerRadius: 1.8 * scale, outerRadius: 2.4 * scale, color: 0xffffff },
            { innerRadius: 2.4 * scale, outerRadius: 3.0 * scale, color: 0xff0000 }
        ];

        ringData.forEach(ring => {
            const ringGeometry = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius, 64);
            const baseColor = new THREE.Color(ring.color);
            const darkenedColor = baseColor.clone().multiplyScalar(1 - darkenFactor);
            
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: darkenedColor,
                transparent: false,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            targetGroup.add(ringMesh);
        });

        const dotGeometry = new THREE.CircleGeometry(0.2 * scale, 16);
        const baseDotColor = new THREE.Color(0xff0000);
        const darkenedDotColor = baseDotColor.clone().multiplyScalar(1 - darkenFactor);
        
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: darkenedDotColor,
            transparent: false,
            opacity: 1.0
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.z = 0.01;
        targetGroup.add(dot);

        targetGroup.position.set(pos.x, pos.y, pos.z);
        targetGroup.lookAt(0, 0, 25);

        targetGroup.userData.originalPosition = {
            x: pos.x,
            y: pos.y,
            z: pos.z
        };

        const lineLength = 80;
        const fixedEndpointZ = pos.z - lineLength;
        
        const lineGeometry = new THREE.BufferGeometry();
        const linePoints = [
            pos.x, pos.y, pos.z,             
            pos.x, pos.y, fixedEndpointZ     
        ];
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));

        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });

        const dartLine = new THREE.Line(lineGeometry, lineMaterial);
        
        dartLine.userData = {
            originalDartX: pos.x,
            originalDartY: pos.y,
            originalDartZ: pos.z,
            fixedEndpointX: pos.x,
            fixedEndpointY: pos.y,
            fixedEndpointZ: fixedEndpointZ,
            targetIndex: index
        };
        
        scene.add(dartLine);
        
        dartLines.push(dartLine);

        scene.add(targetGroup);
        targets.push(targetGroup);
    });
}


function generateAnchorPoints(numDarts, backPlaneZ) {
    const anchorPoints = [];
    
    const gridSize = Math.ceil(Math.sqrt(numDarts));
    const spacing = 20; 
    const offsetX = -(gridSize - 1) * spacing / 2;
    const offsetY = -(gridSize - 1) * spacing / 2;
    
    for (let i = 0; i < numDarts; i++) {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        
        const randomOffsetX = (Math.random() - 0.5) * 5;
        const randomOffsetY = (Math.random() - 0.5) * 5;
        
        anchorPoints.push({
            x: offsetX + col * spacing + randomOffsetX,
            y: offsetY + row * spacing + randomOffsetY,
            z: backPlaneZ
        });
    }
    
    return anchorPoints;
}


function startCalibration() {
    document.getElementById('calibration').style.display = 'block';
}

function calibrateCenter() {
    calibrationData.centerX = 0.5;
    calibrationData.centerY = 0.5;
    calibrationData.baseDistance = 0.1;
    
    isCalibrated = true;
    document.getElementById('calibration').style.display = 'none';
    
    smoothedX = 0;
    smoothedY = 0;
    smoothedDistance = 0;
}

function cancelCalibration() {
    document.getElementById('calibration').style.display = 'none';
}
        
 
function resetTracking() {
    isCalibrated = false;
    smoothedX = 0;
    smoothedY = 0;
    smoothedDistance = 0;
    camera.position.set(0, 0, 25);
    camera.lookAt(0, 0, 0);
    
    if (room) {
        room.position.set(0, 0, 0);
    }
    
    targets.forEach((target, index) => {
        if (target.userData.originalPosition) {
            const originalPos = target.userData.originalPosition;
            target.position.set(originalPos.x, originalPos.y, originalPos.z);
            target.lookAt(0, 0, 25);
        }
        
        if (dartLines[index]) {
            const dartLine = dartLines[index];
            const userData = dartLine.userData;
            const originalPoints = [
                userData.originalDartX, userData.originalDartY, userData.originalDartZ,
                userData.fixedEndpointX, userData.fixedEndpointY, userData.fixedEndpointZ
            ];
            
            dartLine.geometry.setAttribute('position', 
                new THREE.Float32BufferAttribute(originalPoints, 3));
            dartLine.geometry.attributes.position.needsUpdate = true;
        }
    });
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.addEventListener('load', init);
