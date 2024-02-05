<script setup>
import { ref, inject, onMounted } from 'vue';

import { Raycaster, Vector2, MeshBasicMaterial, Scene, PointLight, WebGLRenderer, Box3, SphereGeometry, Sphere, Mesh, Group, PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const abortController = new AbortController();

const originalFetch = window.fetch;
window.fetch = async function (url, options) {
  return originalFetch(url, {
    signal: abortController.signal,
    ...options
  })
}

const REF_DISTANCE = 2.0;

const models = inject('models');

const modelName = ref("");
const numberOfModels = ref(models.length);
const modelIndex = ref(0);

const isLoadingModel = ref(false);
const isDisplayingModels = ref(false);
const loadingProgress = ref(0);

const gltfMap = new Map();

function showPreviousModel() {
  if (modelIndex.value === 0) {
    modelIndex.value = numberOfModels.value - 1;
  }
  else {
    modelIndex.value--;
  }
  loadModel(modelIndex.value);
}

function showNextModel() {
  modelIndex.value = (modelIndex.value + 1) % numberOfModels.value;
  loadModel(modelIndex.value);

}

function selectModel(modelIdx) {
  abortController.abort();
  modelIndex.value = modelIdx;
  loadModel(modelIdx);
}

function toggleModelList() {
  isDisplayingModels.value = !isDisplayingModels.value;
}

function resetModelZoom() {
  const raycaster = new Raycaster();
  const pointer = new Vector2(0, 0);
  raycaster.setFromCamera(pointer, camera);

  const children = scene.children;
  const sphere = children[children.length - 1].children[1];

  const intersects = raycaster.intersectObjects(scene.children);
  const sphereIntersect = intersects.filter((intersect) => intersect.object === sphere);
  const spherePoint = sphereIntersect[0].point.clone().multiplyScalar(1.75);

  camera.position.set(spherePoint.x, spherePoint.y, spherePoint.z);
}

function downloadModel() {
  const model = models[modelIndex.value];
  fetch(`models/${model.priority}_${model.name}`).then(async (res) => {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.style.display = 'none';

    link.href = url;
    link.download = model.name;
    document.body.appendChild(link);

    link.click();
    window.URL.revokeObjectURL(url);
  });
}

const scene = new Scene();
scene.background = null;

const pLight1 = new PointLight(0xffffff, 0.5);
pLight1.position.set(0, 0, -0.5);
scene.add(pLight1);

const pLight2 = new PointLight(0xffffff, 0.1);
pLight2.position.set(0, 0.1, 0);
scene.add(pLight2);

const pLight3 = new PointLight(0xfffffff, 0.1);
pLight3.position.set(0, -0.5, 0);
scene.add(pLight3);

const pLight4 = new PointLight(0xfffffff, 0.1);
pLight4.position.set(0, 0, 0.5);
scene.add(pLight4);

const pLight5 = new PointLight(0xfffffff, 0.1);
pLight5.position.set(0.5, 0, 0);
scene.add(pLight5);

const pLight6 = new PointLight(0xfffffff, 0.1);
pLight6.position.set(-0.5, 0, 0);
scene.add(pLight6);

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new WebGLRenderer({
  alpha: true,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableRotate = true;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 30;

const modelContainer = ref(null);

onMounted(() => {
  modelContainer.value.appendChild(renderer.domElement);
});

let animationId = null;
let group = null;

const gltfLoader = new GLTFLoader();

function loadModel(modelIdx) {

  const name = models[modelIdx].name;
  const priority = models[modelIdx].priority;

  loadingProgress.value = 0;

  scene.remove(group);
  cancelAnimationFrame(animationId);

  if (!gltfMap.has(name)) {

    isLoadingModel.value = true;

    function onProgress(xhr) {
      loadingProgress.value = parseInt((xhr.loaded / xhr.total) * 100);
    }

    gltfLoader.loadAsync(`models/${priority}_${name}`, onProgress).then((gltf) => {
      const model = gltf.scene;

      const boundingBox = new Box3().setFromObject(model);
      const center = {
        x: (boundingBox.max.x + boundingBox.min.x) / 2,
        y: (boundingBox.max.y + boundingBox.min.y) / 2,
        z: (boundingBox.max.z + boundingBox.min.z) / 2
      };

      model.translateX(-center.x);
      model.translateY(-center.y);
      model.translateZ(-center.z);

      const sphereBoundingBox = new Box3().setFromObject(model);
      const boundingSphere = new Sphere();
      sphereBoundingBox.getBoundingSphere(boundingSphere);

      const refDistance = REF_DISTANCE * boundingSphere.radius;

      camera.position.set(
        refDistance,
        refDistance,
        refDistance
      );

      controls.minDistance = Math.sqrt(
        (refDistance * refDistance) +
        (refDistance * refDistance)
      );

      const sphereGeometry = new SphereGeometry(refDistance);
      const sphere = new Mesh(sphereGeometry, new MeshBasicMaterial({
        transparent: true,
        opacity: 0.0
      }));

      group = new Group();
      group.add(model);
      group.add(sphere);

      scene.add(group);
      gltfMap.set(name, { group, refDistance });

      isLoadingModel.value = false;

      animate();
    }).catch((err) => {
      console.log("Signal aborted...")
    });
  }
  else {
    const gltf = gltfMap.get(name);

    group = gltf.group;
    const refDistance = gltf.refDistance;

    camera.position.set(refDistance, refDistance, refDistance);
    controls.minDistance = Math.sqrt(
      (refDistance * refDistance) +
      (refDistance * refDistance));

    scene.add(group);
    animate();
  }

  const [filename, extension] = name.split(".");
  modelName.value = `${filename.toUpperCase()}.${extension}`;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
});

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

loadModel(0);
</script>

<template>
  <div ref="modelContainer" id="model-container"></div>
  <div v-if="isLoadingModel" id="loading-container">
    <span>{{ loadingProgress }}%</span>
  </div>
  <div v-if="isDisplayingModels" @click="toggleModelList" id="model-list-container">
    <article>
      <button v-for="(_, modelIdx) in models" v-bind:key="modelIdx" @click="selectModel(modelIdx)"
        :class="modelIndex == modelIdx ? 'current-model' : ''">{{ models[modelIdx].name }}</button>
    </article>
  </div>
  <aside id="left-chevron">
    <button :disabled="isLoadingModel" @click="showPreviousModel">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  </aside>
  <aside id="right-chevron">
    <button :disabled="isLoadingModel" @click="showNextModel">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  </aside>
  <header>
    <button :class="isDisplayingModels ? 'showing-model-list' : ''" @click="toggleModelList">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
        <path d="M160-200v-80h400v80H160Zm0-160v-80h640v80H160Zm0-160v-80h640v80H160Zm0-160v-80h640v80H160Z" />
      </svg>
    </button>
    <section>
      <h1>{{ modelName }}</h1>
    </section>
    <a href="https://github.com/RunItBack1127" target="_blank" rel="noopener noreferrer">
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-github" viewBox="0 0 16 16">
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
      </svg>
    </a>
  </header>
  <footer>
    <button :disabled="isLoadingModel" @click="resetModelZoom">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path
          d="m22.4 39.65-11-6.45q-.7-.4-1.075-1.1-.375-.7-.375-1.5V17.75q0-.8.375-1.5t1.075-1.1L22.45 8.6q.7-.4 1.55-.4.85 0 1.55.4l11.05 6.55q.7.4 1.075 1.1.375.7.375 1.5V30.6q0 .8-.4 1.5t-1.1 1.1L25.4 39.65q-.7.4-1.5.4t-1.5-.4Zm.1-3.45V25L13 19.55V30.5Zm3 0 9.55-5.7V19.55L25.5 25ZM2 11.45V7.6q0-2.35 1.625-3.975T7.6 2h3.85v3H7.6q-1.1 0-1.85.75T5 7.6v3.85ZM7.6 46q-2.35 0-3.975-1.625T2 40.4v-3.85h3v3.85q0 1.1.75 1.85T7.6 43h3.85v3Zm28.95-.2v-3h3.85q1.1 0 1.85-.75T43 40.2v-3.85h3v3.85q0 2.35-1.625 3.975T40.4 45.8ZM43 11.45V7.6q0-1.1-.75-1.85T40.4 5h-3.85V2h3.85q2.35 0 3.975 1.625T46 7.6v3.85ZM24 22.3l9.5-5.5-9.5-5.45-9.5 5.45Zm0 1.25Zm0-1.25Zm1.5 2.7Zm-3 0Z" />
      </svg>
    </button>
    <section>
      <h2>{{ modelIndex + 1 }} / {{ numberOfModels }}</h2>
    </section>
    <button @click="downloadModel">
      <svg xmlns="http://www.w3.org/2000/svg" class="bi bi-download" viewBox="0 0 16 16">
        <path
          d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5" />
        <path
          d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z" />
      </svg>
    </button>
  </footer>
</template>

<style scoped lang="scss">
#model-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}

#loading-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #fff;
  display: flex;
  justify-content: center;
  align-items: center;

  span {
    font-size: 10rem;
  }
}

#model-list-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99999;
  background: #000000aa;
  cursor: pointer;

  article {
    margin-top: 85px;
    height: calc(100vh - 170px);
    width: 100%;
    max-width: 450px;
    background: #fff;
    border-left: 2px solid #000;
    border-right: 2px solid #000;
    overflow-y: visible;

    button {
      width: 100%;
      height: calc(100% / 6);
      border: 2px solid #000;
      font-family: Violet Sans, sans-serif;
      font-size: 2rem;
      background: #fff;

      &.current-model {
        background: #000;
        color: #fff;
      }
    }
  }
}

aside {

  position: absolute;
  top: 85px;
  height: calc(100vh - 170px);

  button {
    width: 150px;
    height: 100%;
    border: none;
    background: #fff;

    svg {
      width: 50px;
      height: 50px;
    }
  }

  &#left-chevron {
    left: 0;

    button {
      svg {
        transform: scaleX(-100%);
      }
    }
  }

  &#right-chevron {
    right: 0;
  }
}

header,
footer {
  display: flex;
  position: absolute;
  left: 0;
  width: 100%;
  height: 85px;
  background: #fff;

  button {
    width: 150px;
    height: 85px;
    background: #fff;
    border: 2px solid #000;

    svg {
      width: 30px;
      height: 30px;
    }

    &:hover {
      background: #000;

      svg {
        filter: invert(1);
      }
    }
  }

  section {
    display: flex;
    justify-content: center;
    align-items: center;
    width: calc(100% - 300px);
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }

  a {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 150px;
    height: 85px;
    background: #fff;
    border: 2px solid #000;
    cursor: pointer;

    svg {
      width: 30px;
      height: 30px;
      pointer-events: none;
    }

    &:hover {
      background: #000;

      svg {
        filter: invert(1);
      }
    }
  }

}

header {
  top: 0;

  button {

    &.showing-model-list {
      position: relative;
      top: 0;
      left: 0;
      z-index: 999999;
      background: #000;

      svg {
        filter: invert(1);
      }
    }
  }

  section {
    h1 {
      font-size: 2.25rem;
      letter-spacing: 0.1em;
      font-weight: 400;
    }
  }
}

footer {
  bottom: 0;

  section {

    h2 {
      font-size: 1.5rem;
      font-weight: 200;
    }
  }
}
</style>
