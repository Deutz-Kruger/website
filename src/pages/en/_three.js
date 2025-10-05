import lottie from "lottie-web";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uLottieTexture;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uLottieTexture, vUv);
  }
`;

const container = document.getElementById("lottie-1");

async function init() {
  if (!container) return;

  const response = await fetch("/documents/lottie/gradmob.json");
  const data = await response.json();
  const animationAspect = data.w / data.h;

  const finalWidth = window.innerWidth / 2;
  const finalHeight = 400;

  container.style.width = `${finalWidth}px`;
  container.style.height = `${finalHeight}px`;

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(finalWidth, finalHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(
    -0.5 * animationAspect,
    0.5 * animationAspect,
    0.5,
    -0.5,
    0.1,
    10,
  );
  camera.position.z = 1;

  const lottieTextureResolution = 1024;
  const lottieContainer = document.createElement("div");
  lottieContainer.style.width = lottieTextureResolution + "px";
  lottieContainer.style.height =
    lottieTextureResolution / animationAspect + "px";
  lottieContainer.style.position = "absolute";
  lottieContainer.style.top = "-99999px";
  document.body.appendChild(lottieContainer);

  const texture = new THREE.CanvasTexture();
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  const animation = lottie.loadAnimation({
    container: lottieContainer,
    animType: "canvas",
    loop: true, // We will control the loop manually
    autoplay: false,
    animationData: data,
  });

  texture.image = animation.container;

  let endFrame;

  animation.addEventListener("DOMLoaded", function () {
    const framesToCut = 9; // You can adjust this value
    endFrame = animation.totalFrames - framesToCut;
    animation.setSpeed(0.5);
    // Start the animation playing forward
    animation.play();
  });

  animation.addEventListener("enterFrame", () => {
    texture.needsUpdate = true;

    // More robust ping-pong loop logic
    if (endFrame) {
      // If playing forward and we reach the end of our segment...
      if (animation.direction === 1 && animation.currentFrame >= endFrame) {
        // ...reverse direction and play from the end frame.
        animation.setDirection(-1);
        animation.goToAndPlay(endFrame, true);
      }
      // If playing backward and we reach the beginning...
      else if (animation.direction === -1 && animation.currentFrame <= 0) {
        // ...play forward from frame 0 again.
        animation.setDirection(1);
        animation.goToAndPlay(0, true);
      }
    }
  });

  lottieContainer.style.display = "none";

  const geometry = new THREE.PlaneGeometry(1 * animationAspect, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLottieTexture: { value: texture },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

init();
