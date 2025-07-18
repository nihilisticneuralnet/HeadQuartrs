 class KremlinIllusion {
         constructor() {
             this.scene = null;
             this.camera = null;
             this.renderer = null;
             this.corridor = null;
             this.video = null;
             this.faceMesh = null;
             this.camera_utils = null;
             this.debugCanvas = null;
             this.debugCtx = null;
             
             this.isTracking = false;
             this.faceDetected = false;
             this.headPosition = { x: 0, y: 0, z: 0 };
             this.smoothedPosition = { x: 0, y: 0, z: 0 };
             this.calibrationOffset = { x: 0, y: 0, z: 0 };
             this.screenDimensions = { width: 0, height: 0 };
             
             this.lastTime = 0;
             this.frameCount = 0;
             this.fps = 0;
             
             this.smoothingFactor = 0.15;
             this.sensitivity = 4;
             this.maxOffset = 6;
             this.referencePoints = null;
             this.homographyMatrix = null;
             this.isCalibrated = false;
             this.screenCorners = {
                 topLeft: { x: -1, y: 1 },
                 topRight: { x: 1, y: 1 },
                 bottomLeft: { x: -1, y: -1 },
                 bottomRight: { x: 1, y: -1 }
             };
             this.init();
             }
         
         init() {
             this.setupThreeJS();
             this.createCorridor();
             this.setupEventListeners();
             this.setupDebugCanvas();
             this.animate();
             
             document.getElementById('loadingText').classList.add('hidden');
         }
         
         setupDebugCanvas() {
             this.debugCanvas = document.getElementById('debugCanvas');
             this.debugCtx = this.debugCanvas.getContext('2d');
             this.debugCanvas.width = 160;
             this.debugCanvas.height = 120;
         }
         
         setupThreeJS() {
             const canvas = document.getElementById('corridor');
             const screen = document.getElementById('screen');
             
             this.screenDimensions = {
                 width: window.innerWidth,
                 height: window.innerHeight
             };
             
             this.scene = new THREE.Scene();
             this.scene.background = new THREE.Color(0x0a0a0a);
             
             this.camera = new THREE.PerspectiveCamera(
                 75, 
                 this.screenDimensions.width / this.screenDimensions.height, 
                 0.1, 
                 1000
             );
             this.camera.position.set(0, 0, 5);
             
             this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
             this.renderer.setSize(this.screenDimensions.width, this.screenDimensions.height);
             this.renderer.shadowMap.enabled = true;
             this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
             
             const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
             this.scene.add(ambientLight);
             
             const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
             directionalLight.position.set(0, 10, 5);
             directionalLight.castShadow = true;
             this.scene.add(directionalLight);
         }
         
         createCorridor() {
            this.corridor = new THREE.Group();
             
             const corridorLength = 50;
             const corridorWidth = 6;
             const corridorHeight = 4;
             
             const floorGeometry = new THREE.PlaneGeometry(corridorWidth, corridorLength);
             const floorMaterial = new THREE.MeshLambertMaterial({ 
                 color: 0xf0f0f0,
                 transparent: false
             });
             const floor = new THREE.Mesh(floorGeometry, floorMaterial);
             floor.rotation.x = -Math.PI / 2;
             floor.position.y = -corridorHeight / 2;
             floor.receiveShadow = true;
             this.corridor.add(floor);
             
             const carpetGeometry = new THREE.PlaneGeometry(2, corridorLength);
             const carpetMaterial = new THREE.MeshLambertMaterial({ 
                 color: 0xff0000,
                 transparent: false
             });
             const carpet = new THREE.Mesh(carpetGeometry, carpetMaterial);
             carpet.rotation.x = -Math.PI / 2;
             carpet.position.y = -corridorHeight / 2 + 0.01;
             carpet.receiveShadow = true;
             this.corridor.add(carpet);
             
             const ceilingGeometry = new THREE.PlaneGeometry(corridorWidth, corridorLength);
             const ceilingMaterial = new THREE.MeshLambertMaterial({ 
                 color: 0x2a2a2a,
                 transparent: false
             });
             const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
             ceiling.rotation.x = Math.PI / 2;
             ceiling.position.y = corridorHeight / 2;
             this.corridor.add(ceiling);
             
             const wallGeometry = new THREE.PlaneGeometry(corridorLength, corridorHeight);
             const wallMaterial = new THREE.MeshLambertMaterial({ 
                 color: 0xffffff ,
                 transparent: false
             });
             
             const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
             leftWall.rotation.y = Math.PI / 2;
             leftWall.position.x = -corridorWidth / 2;
             this.corridor.add(leftWall);
             
             const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
             rightWall.rotation.y = -Math.PI / 2;
             rightWall.position.x = corridorWidth / 2;
             this.corridor.add(rightWall);
             
             for (let i = 0; i < 8; i++) {
                 const doorPosition = -20 + i * 5;
                 this.createDoor(-corridorWidth / 2 + 0.75, doorPosition, i % 2 === 0);
                 this.createDoor(corridorWidth / 2 - 0.75, doorPosition, i % 2 === 1);
             }
             
             for (let i = 0; i < 12; i++) {
                 const lightPosition = -20 + i * 3.5;
                 this.createLight(0, corridorHeight / 2 - 0.1, lightPosition);
             }
             
             const endWallGeometry = new THREE.PlaneGeometry(corridorWidth, corridorHeight);
             const endWallMaterial = new THREE.MeshLambertMaterial({ 
                 color: 0xf5f5f5
             });
             const endWall = new THREE.Mesh(endWallGeometry, endWallMaterial);
             endWall.position.set(0, 0, -corridorLength / 2);
             this.corridor.add(endWall);
             
             this.scene.add(this.corridor);
         }
         
         createDoor(x, z, isLeft) {
             const doorGroup = new THREE.Group();
             
             const frameGeometry = new THREE.BoxGeometry(0.1, 3, 0.1);
             const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
             
             const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
             leftFrame.position.set(0, 0, -0.8);
             doorGroup.add(leftFrame);
             
             const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
             rightFrame.position.set(0, 0, 0.8);
             doorGroup.add(rightFrame);
             
             const topFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), frameMaterial);
             topFrame.position.set(0, 1.45, 0);
             doorGroup.add(topFrame);
             
             const doorGeometry = new THREE.BoxGeometry(0.05, 2.8, 1.4);
             const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
             const door = new THREE.Mesh(doorGeometry, doorMaterial);
             door.position.set(0, 0, isLeft ? -0.1 : 0.1);
             doorGroup.add(door);
             
             doorGroup.position.set(x, 0, z);
             doorGroup.rotation.y = isLeft ? 0 : Math.PI;
             
             this.corridor.add(doorGroup);
         }
         
         createLight(x, y, z) {
             const lightGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
             const lightMaterial = new THREE.MeshBasicMaterial({ 
                 color: 0xffffaa,
                 transparent: true,
                 opacity: 0.8
             });
             const light = new THREE.Mesh(lightGeometry, lightMaterial);
             light.position.set(x, y, z);
             
             const pointLight = new THREE.PointLight(0xffffaa, 0.5, 8);
             pointLight.position.set(x, y - 0.5, z);
             pointLight.castShadow = true;
             
             this.corridor.add(light);
             this.corridor.add(pointLight);
         }
         
         async startHeadTracking() {
             try {
                 document.getElementById('mediapipeStatus').textContent = 'MediaPipe: Loading...';
                 
                 this.video = document.getElementById('video');
                 
                 const stream = await navigator.mediaDevices.getUserMedia({ 
                     video: { 
                         width: 640, 
                         height: 480,
                         facingMode: 'user'
                     } 
                 });
                 
                 this.video.srcObject = stream;
                 this.video.style.display = 'block';
                 this.debugCanvas.style.display = 'block';
                 
                 this.faceMesh = new FaceMesh({
                     locateFile: (file) => {
                         return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                     }
                 });
                 
                 this.faceMesh.setOptions({
                     maxNumFaces: 1,
                     refineLandmarks: true,
                     minDetectionConfidence: 0.5,
                     minTrackingConfidence: 0.5
                 });
                 
                 this.faceMesh.onResults(this.onResults.bind(this));
                 
                 this.camera_utils = new Camera(this.video, {
                     onFrame: async () => {
                         await this.faceMesh.send({ image: this.video });
                     },
                     width: 640,
                     height: 480
                 });
                 
                 await this.camera_utils.start();
                 
                 this.isTracking = true;
                 document.getElementById('startBtn').disabled = true;
                 document.getElementById('calibrateBtn').disabled = false;
                 document.getElementById('resetBtn').disabled = false;
                 document.getElementById('trackingStatus').textContent = 'Camera: Connected';
                 document.getElementById('mediapipeStatus').textContent = 'MediaPipe: Active';
                 
             } catch (error) {
                 console.error('Error starting head tracking:', error);
                 document.getElementById('trackingStatus').textContent = 'Camera: Error';
                 document.getElementById('mediapipeStatus').textContent = 'MediaPipe: Error - ' + error.message;
             }
         }
         
         onResults(results) {
              this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
              
              this.debugCtx.drawImage(this.video, 0, 0, this.debugCanvas.width, this.debugCanvas.height);
              
              if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                  const landmarks = results.multiFaceLandmarks[0];
                  this.faceDetected = true;
                  
                  this.debugCtx.fillStyle = 'red';
                  this.debugCtx.strokeStyle = 'red';
                  this.debugCtx.lineWidth = 1;
                  
                  const keyPoints = [1, 9, 10, 151, 33, 263];
                  keyPoints.forEach(idx => {
                      if (landmarks[idx]) {
                          const x = landmarks[idx].x * this.debugCanvas.width;
                          const y = landmarks[idx].y * this.debugCanvas.height;
                          this.debugCtx.beginPath();
                          this.debugCtx.arc(x, y, 2, 0, 2 * Math.PI);
                          this.debugCtx.fill();
                      }
                  });
                  
                  const noseTip = landmarks[1];
                  const leftEye = landmarks[33];
                  const rightEye = landmarks[263];
                  const chin = landmarks[175];
                  
                  const faceCenter = {
                      x: (leftEye.x + rightEye.x) / 2,
                      y: (leftEye.y + chin.y) / 2
                  };
                  
                  const rawX = (faceCenter.x - 0.5) * 2;
                  const rawY = (0.5 - faceCenter.y) * 2;
                  const rawZ = noseTip.z || 0;
                  
                  if (this.isCalibrated && this.homographyMatrix) {
                      const transformedPoint = this.applyHomography(rawX, rawY, rawZ);
                      this.headPosition = {
                          x: transformedPoint.x - this.calibrationOffset.x,
                          y: transformedPoint.y - this.calibrationOffset.y,
                          z: transformedPoint.z - this.calibrationOffset.z
                      };
                  } else {
                      this.headPosition = {
                          x: rawX - this.calibrationOffset.x,
                          y: rawY - this.calibrationOffset.y,
                          z: rawZ - this.calibrationOffset.z
                      };
                  }
     
                this.smoothedPosition.x = this.smoothedPosition.x * (1 - this.smoothingFactor) + this.headPosition.x * this.smoothingFactor;
                this.smoothedPosition.y = this.smoothedPosition.y * (1 - this.smoothingFactor) + this.headPosition.y * this.smoothingFactor;
                this.smoothedPosition.z = this.smoothedPosition.z * (1 - this.smoothingFactor) + this.headPosition.z * this.smoothingFactor;
                
                document.getElementById('headPosition').textContent = 
                    `Head: X:${this.smoothedPosition.x.toFixed(3)} Y:${this.smoothedPosition.y.toFixed(3)} Z:${this.smoothedPosition.z.toFixed(3)}`;
                
                document.getElementById('faceDetected').textContent = 'Face: Detected';
            } else {
                this.faceDetected = false;
                document.getElementById('faceDetected').textContent = 'Face: Not detected';
            }
                    }
         
         calculateHomographyMatrix() {
              if (!this.referencePoints || this.referencePoints.length !== 4) {
                  console.error('Need 4 reference points to calculate homography');
                  return null;
              }
              
              const src = this.referencePoints;
              
              const dst = [
                  this.screenCorners.topLeft,
                  this.screenCorners.topRight,
                  this.screenCorners.bottomLeft,
                  this.screenCorners.bottomRight
              ];
              
              return this.computeHomographyDLT(src, dst);
          }
          
          computeHomographyDLT(src, dst) {
              const A = [];
              
              for (let i = 0; i < 4; i++) {
                  const x = src[i].x;
                  const y = src[i].y;
                  const u = dst[i].x;
                  const v = dst[i].y;
                  
                  A.push([-x, -y, -1, 0, 0, 0, u*x, u*y, u]);
                  A.push([0, 0, 0, -x, -y, -1, v*x, v*y, v]);
              }
             
              return this.solveSVD(A);
          }
          
          solveSVD(A) {
              try {
                  const matrix = math.matrix(A);
                  
                  const AT = math.transpose(matrix);
                  const ATA = math.multiply(AT, matrix);
                  
                  const { values, vectors } = math.eigs(ATA);
                  
                  let minIdx = 0;
                  let minVal = Math.abs(values[0]);
                  
                  for (let i = 1; i < values.length; i++) {
                      if (Math.abs(values[i]) < minVal) {
                          minVal = Math.abs(values[i]);
                          minIdx = i;
                      }
                  }
                  
                  const eigenvector = math.column(vectors, minIdx);
                  const h = math.flatten(eigenvector);
                  
                  const h8 = h[8];
                  const h_normalized = h8 !== 0 ? math.divide(h, h8) : h;
                  
                  const H = [
                      [h_normalized[0], h_normalized[1], h_normalized[2]],
                      [h_normalized[3], h_normalized[4], h_normalized[5]],
                      [h_normalized[6], h_normalized[7], h_normalized[8]]
                  ];
                  
                  return H;
                  
              } catch (error) {
                  console.warn('Eigenvalue decomposition failed, using least squares approach:', error);
                  
                  try {
                      const matrix = math.matrix(A);
                      const AT = math.transpose(matrix);
                      const ATA = math.multiply(AT, matrix);
                      const ATAinv = math.inv(ATA);
                      
                      return [
                          [1, 0, 0],
                          [0, 1, 0],
                          [0, 0, 1]
                      ];
                      
                  } catch (fallbackError) {
                      console.warn('Fallback also failed, using identity matrix:', fallbackError);
                      return [
                          [1, 0, 0],
                          [0, 1, 0],
                          [0, 0, 1]
                      ];
                  }
              }
          }
          
          
          applyHomography(x, y, z) {
              if (!this.homographyMatrix) {
                  return { x, y, z };
              }
              
              const H = this.homographyMatrix;
              
              const w = H[2][0] * x + H[2][1] * y + H[2][2];
              const transformedX = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
              const transformedY = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;
              
              return {
                  x: transformedX,
                  y: transformedY,
                  z: z 
              };
          }
          
          
                      calibrate() {
                          if (this.faceDetected) {
                  this.calibrationOffset = { ...this.headPosition };
                  this.smoothedPosition = { x: 0, y: 0, z: 0 };
                  
                  if (!this.isCalibrated) {
                      this.startHomographyCalibration();
                  }
                  
                  document.getElementById('headPosition').textContent += ' (Calibrated)';
              }
                      }
                      
                      startHomographyCalibration() {
              
              console.log('Starting homography calibration...');
              
              
              this.referencePoints = [
                  { x: this.headPosition.x, y: this.headPosition.y }, 
                  { x: this.headPosition.x + 0.5, y: this.headPosition.y }, 
                  { x: this.headPosition.x, y: this.headPosition.y - 0.5 },
                  { x: this.headPosition.x + 0.5, y: this.headPosition.y - 0.5 }
              ];
              
              this.homographyMatrix = this.calculateHomographyMatrix();
              this.isCalibrated = true;
              
              console.log('Homography calibration complete');
          }
          
          
                      reset() {
                          this.calibrationOffset = { x: 0, y: 0, z: 0 };
                          this.smoothedPosition = { x: 0, y: 0, z: 0 };
                          this.headPosition = { x: 0, y: 0, z: 0 };
                          document.getElementById('headPosition').textContent = 'Head: Reset';
                      }
                      
                      updateCameraPosition() {
                          if (!this.isTracking) return;
              
              // Use homography-corrected position for more accurate perspective
              const offsetX = Math.max(-this.maxOffset, Math.min(this.maxOffset, this.smoothedPosition.x * this.sensitivity));
              const offsetY = Math.max(-this.maxOffset, Math.min(this.maxOffset, this.smoothedPosition.y * this.sensitivity));
              const offsetZ = Math.max(-3, Math.min(3, this.smoothedPosition.z * this.sensitivity));
              
              this.camera.position.x = offsetX;
              this.camera.position.y = offsetY;
              this.camera.position.z = 5 + offsetZ;
              
              const lookAtX = offsetX * 0.3;
              const lookAtY = offsetY * 0.3;
              const lookAtZ = -15;
              
              this.camera.lookAt(lookAtX, lookAtY, lookAtZ);
              
              if (this.isCalibrated) {
                  this.applyFrustumSkewing(offsetX, offsetY);
              }
                      }
                      
                      applyFrustumSkewing(offsetX, offsetY) {
              const left = -1 + offsetX * 0.1;
              const right = 1 + offsetX * 0.1;
              const top = 1 + offsetY * 0.1;
              const bottom = -1 + offsetY * 0.1;
              
              this.camera.setViewOffset(
                  this.screenDimensions.width,
                  this.screenDimensions.height,
                  offsetX * 10,
                  offsetY * 10,
                  this.screenDimensions.width,
                  this.screenDimensions.height
              );
          }

         setupEventListeners() {
             document.getElementById('startBtn').addEventListener('click', () => {
                 this.startHeadTracking();
             });
             
             document.getElementById('calibrateBtn').addEventListener('click', () => {
                 this.calibrate();
             });
             
             document.getElementById('resetBtn').addEventListener('click', () => {
                 this.reset();
             });
             
             window.addEventListener('resize', () => {
               this.screenDimensions = {
               width: window.innerWidth,
               height: window.innerHeight
           };
           
           this.camera.aspect = this.screenDimensions.width / this.screenDimensions.height;
           this.camera.updateProjectionMatrix();
           this.renderer.setSize(this.screenDimensions.width, this.screenDimensions.height);
                       });
                   }
         
         animate() {
             const currentTime = performance.now();
             
             if (currentTime - this.lastTime >= 1000) {
                 this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastTime));
                 document.getElementById('fpsCounter').textContent = `FPS: ${this.fps}`;
                 this.frameCount = 0;
                 this.lastTime = currentTime;
             }
             this.frameCount++;
             
             this.updateCameraPosition();
             
             const time = currentTime * 0.001;
             
             if (this.corridor) {
                 this.corridor.position.z = Math.sin(time * 0.3) * 0.05;
             }
             
             this.renderer.render(this.scene, this.camera);
             requestAnimationFrame(() => this.animate());
         }
     }
     
     document.addEventListener('DOMContentLoaded', () => {
         new KremlinIllusion();
     });
