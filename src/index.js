import "./styles.css";
var jquery = require("jquery");
window.$ = window.jQuery = jquery;

import * as dat from 'dat.gui';
import * as BABYLON from "babylonjs";
import { mediaJSON } from "./videos";
import { vertexShader } from "./vertex-shader";
import { fragmentShader } from "./fragment-shader";

const NTransitions = 27;
const NEffects = 2;
const CameraTransitionDuration = 0.25;

let videosJ = $('#videos')
let menuJ = $('#menu')

let parameters = {
  cameraWidth: 640,
  cameraHeight: 480,
  backgroundColor: [233, 30, 99],
  menuDuration: 5,
  menuMargin: 15,
  menuPosition: 'leftCenter',
  lyrics: {
    threshold: (50/255),
    positionX: 0,
    positionY: -0.25,
    scale: 0.5,
  },
  camera1: {
    threshold: 0.8,
    thresholdColor: [0, 255, 0],
    hue: 0,
    saturation: 0,
    brightness: -0.5,
    contrast: -1,
    applyFilters: false,
    applyThreshold: true,
  },
  camera2: {
    threshold: 0.8,
    thresholdColor: [0, 255, 0],
    hue: 0,
    saturation: 0,
    brightness: -0.5,
    contrast: -1,
    applyFilters: false,
    applyThreshold: true,
  },
  cameraDuration: 10,
  cameraSwitchRatio: 0.2,
  effectDuration: 10,
  effectDurationRatio: 0.2,
  // effectDuration: 10,
  switchCamera: false,
  autoTransitions: true,
  autoEffects: true,
  pause: false
}

let actions = {
  enableEffect: false,
  triggerTransition: triggerTransition,
  changeBackgroundVideo: changeBackgroundVideo,
};

let loadParameters = ()=> {
  let loadedParametersString = localStorage.getItem("doucheBoxParameters")
  if(loadedParametersString) {
    let loadedParameters = JSON.parse(loadedParametersString)
    if(loadedParameters) {
      
      let loadedParametersHaveAllProperties = true
      for(let propertyName in parameters) {
        if(!loadedParameters.hasOwnProperty(propertyName)) {
          console.warn('WARNING: loaded parameters does not have the property: ' + propertyName + ', setting default one: ' + parameters[propertyName])
          loadedParameters[propertyName] = parameters[propertyName]
        }
      }

      parameters = loadedParameters
    }
  }
}

loadParameters()

let saveParameters = ()=> {
  let parametersJSON = JSON.stringify(parameters)
  localStorage.setItem("doucheBoxParameters", parametersJSON)
}

let transitionBeginTimeout = 0;
let transitionEndTimeout = 0;
let beginCameraFadeOutTimeout = 0;
let camera2TranstionDuration = 0;

let effectBeginTimeout = 0;
let effectEndTimeout = 0;

let transitionNumber = 0;
let transitionActive = false;
let cameraSelection = 0;

let plane = null;
let scene = null;
let backgroundVideoTexture = null;

let applyEffect = false;
let effectNumber = 0;

let triggerEffect = ()=> {
  applyEffect = true;
  effectNumber = Math.floor(Math.random() * NEffects);
  startTime = Date.now();
}


let arrayToBabylonColor = (tc)=> {
  return new BABYLON.Vector3(tc[0] / 255, tc[1] / 255, tc[2] / 255)
}

let setBackgroundColor = ()=> {
  let values = parameters.backgroundColor
  scene.clearColor = new BABYLON.Color3(values[0] / 255, values[1] / 255, values[2] / 255)
}

let updateTransitionTimeout = ()=> {

  let duration = parameters.cameraDuration * (0.5 + Math.random() * 0.5) * 1000.0;

  let camera2Duration = duration * parameters.cameraSwitchRatio;
  camera2TranstionDuration = camera2Duration * CameraTransitionDuration;

  transitionEndTimeout = Date.now() + duration;
  transitionBeginTimeout = transitionEndTimeout - camera2Duration;
  beginCameraFadeOutTimeout = transitionEndTimeout - camera2TranstionDuration;

  return transitionEndTimeout;
}

let updateEffectTimeout = ()=> {
  let duration = parameters.effectDuration * (0.5 + Math.random() * 0.5) * 1000.0;
  effectEndTimeout = Date.now() + duration;
  effectBeginTimeout = effectEndTimeout - duration * parameters.effectDurationRatio;
  return effectEndTimeout;
}


let resizeCameraPlane = ()=> {

  let videoRatio = parameters.cameraWidth / parameters.cameraHeight;
  let windowRatio = window.innerWidth / window.innerHeight;

  if (windowRatio > videoRatio) {
    plane.scaling.y = window.innerHeight;
    plane.scaling.x = plane.scaling.y * videoRatio;
  } else {
    plane.scaling.x = window.innerWidth;
    plane.scaling.y = plane.scaling.x / videoRatio;
  }
}
let pauseVideo = (pause)=> {
  if(pause) {
    lyricsVideoTexture.video.pause()
    backgroundVideoTexture.video.pause()
  } else {
    lyricsVideoTexture.video.play()
    backgroundVideoTexture.video.play()
  }
}

let triggerTransition = ()=> {
  
  if(!parameters.autoTransitions) {
    transitionActive = true;

    let duration = parameters.cameraDuration * (0.5 + Math.random() * 0.5) * 1000.0;

    let camera2Duration = duration * parameters.cameraSwitchRatio;
    camera2TranstionDuration = camera2Duration * CameraTransitionDuration;

    if(cameraSelection > 0.5) {
      transitionEndTimeout = Date.now() + camera2TranstionDuration;
    } else {
      transitionEndTimeout = Date.now() + camera2Duration;
    }

    transitionBeginTimeout = transitionEndTimeout - camera2Duration;
    beginCameraFadeOutTimeout = transitionEndTimeout - camera2TranstionDuration;

    transitionNumber = Math.floor(Math.random() * NTransitions);
    
    cameraSelection = 0.0;

  }
}

actions.triggerTransition = triggerTransition


let changeBackgroundVideo = ()=> {
  let backgroundVideoIndex = Math.floor(Math.random() * backgroundVideoNames.length)
  backgroundVideoTexture.updateURL('files/background-videos/' + backgroundVideoNames[backgroundVideoIndex])
}

actions.changeBackgroundVideo = changeBackgroundVideo


let lyricsVideoNames = []
let backgroundVideoNames = []


let selectedVideoIndex = 1
let selectVideoTimeoutID = null

let showMenu = ()=> {
  let lyricsVideoNamesJ = videosJ.find('li')
  let i = 1
  for(let videoNameE of lyricsVideoNamesJ) {
    let videoNameJ = $(videoNameE)
    if(i > selectedVideoIndex - 4 && i < selectedVideoIndex + 4) {
      videoNameJ.show()
    } else {
      videoNameJ.hide()
    }
    videoNameJ.removeClass('highlight')
    if(i == selectedVideoIndex) {
      videoNameJ.addClass('highlight')
    }
    i++
  }

  clearTimeout(selectVideoTimeoutID)
  menuJ.show()
  selectVideoTimeoutID = setTimeout(selectVideo, 1000 * parameters.menuDuration)
}

dat.GUI.DEFAULT_WIDTH = 350;
const gui = new dat.GUI();


let menuPositions = ['center', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'leftCenter', 'topCenter', 'rightCenter', 'bottomCenter']

let setMenuPosition = ()=> {
  let value = parameters.menuPosition
  let margin = parameters.menuMargin + 'px'
  switch(value) {
    case 'center':
      menuJ.css({ top: '50%', left: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)'})
    break;
    case 'topLeft':
      menuJ.css({ top: margin, left: margin, right: 'auto', bottom: 'auto', transform: 'inherit'})
    break;
    case 'topRight':
      menuJ.css({ top: margin, right: margin, left: 'auto', bottom: 'auto', transform: 'inherit'})
    break;
    case 'bottomLeft':
      menuJ.css({ bottom: margin, left: margin, right: 'auto', top: 'auto', transform: 'inherit'})
    break;
    case 'bottomRight':
      menuJ.css({ bottom: margin, right: margin, left: 'auto', top: 'auto', transform: 'inherit'})
    break;
    case 'leftCenter':
      menuJ.css({ top: '50%', left: margin, right: 'auto', bottom: 'auto', transform: 'translate(0, -50%)'})
    break;
    case 'rightCenter':
      menuJ.css({ top: '50%', right: margin, left: 'auto', bottom: 'auto', transform: 'translate(0, -50%)'})
    break;
    case 'topCenter':
      menuJ.css({ top: margin, left: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, 0)'})
    break;
    case 'bottomCenter':
      menuJ.css({ bottom: margin, left: '50%', right: 'auto', top: 'auto', transform: 'translate(-50%, 0)'})
    break;
    default:
    break;
  }
  showMenu()
}

setMenuPosition()

let basicSettingsFolder = gui.addFolder('Basic settings')

basicSettingsFolder.addColor(parameters, 'backgroundColor').name('Background color').onChange(setBackgroundColor).onFinishChange(saveParameters)
basicSettingsFolder.add(parameters, 'menuDuration', 0, 10, 1).name('Menu duration').onFinishChange(saveParameters)
basicSettingsFolder.add(parameters, 'menuMargin', 0, 50, 1).name('Menu margin').onChange(setMenuPosition).onFinishChange(saveParameters)
basicSettingsFolder.add(parameters, 'menuPosition', menuPositions).name('Menu position').onChange(setMenuPosition).onFinishChange(saveParameters)
basicSettingsFolder.add(parameters, 'cameraWidth', 100, 1920, 1).name('Camera Width').onChange(resizeCameraPlane).onFinishChange(saveParameters)
basicSettingsFolder.add(parameters, 'cameraHeight', 100, 1080, 1).name('Camera Height').onChange(resizeCameraPlane).onFinishChange(saveParameters)

let lyricsFolder = gui.addFolder('Lyrics')

lyricsFolder.add(parameters.lyrics, 'threshold', 0, 1, 0.01).name('Threshold').onFinishChange(saveParameters)
lyricsFolder.add(parameters.lyrics, 'scale', 0, 1, 0.01).name('Scale').onFinishChange(saveParameters)
lyricsFolder.add(parameters.lyrics, 'positionX', -0.5, 0.5, 0.01).name('Position X').onFinishChange(saveParameters)
lyricsFolder.add(parameters.lyrics, 'positionY', -0.5, 0.5, 0.01).name('Position Y').onFinishChange(saveParameters)

let camera1Folder = gui.addFolder('Camera 1')

camera1Folder.add(parameters.camera1, 'threshold', 0, 1, 0.01).name('Threshold').onFinishChange(saveParameters)
camera1Folder.addColor(parameters.camera1, 'thresholdColor').name('Threshold color').onFinishChange(saveParameters)
camera1Folder.add(parameters.camera1, 'applyThreshold').name('Apply threshold').onFinishChange(saveParameters)
camera1Folder.add(parameters.camera1, 'hue', -1, 1, 0.01).name('Hue').onFinishChange(saveParameters)
camera1Folder.add(parameters.camera1, 'saturation', -1, 1, 0.01).name('Saturation').onFinishChange(saveParameters)
camera1Folder.add(parameters.camera1, 'brightness', -1, 1, 0.01).name('Brightness').onFinishChange(saveParameters)
camera1Folder.add(parameters.camera1, 'contrast', -1, 1, 0.01).name('Contrast').onFinishChange(saveParameters)
camera1Folder.add(parameters.camera1, 'applyFilters').name('Apply filters').onFinishChange(saveParameters)

let camera2Folder = gui.addFolder('Camera 2')

camera2Folder.add(parameters.camera2, 'threshold', 0, 1, 0.01).name('Threshold').onFinishChange(saveParameters)
camera2Folder.addColor(parameters.camera2, 'thresholdColor').name('Threshold color').onFinishChange(saveParameters)
camera2Folder.add(parameters.camera2, 'applyThreshold').name('Apply threshold').onFinishChange(saveParameters)
camera2Folder.add(parameters.camera2, 'hue', -1, 1, 0.01).name('Hue').onFinishChange(saveParameters)
camera2Folder.add(parameters.camera2, 'saturation', -1, 1, 0.01).name('Saturation').onFinishChange(saveParameters)
camera2Folder.add(parameters.camera2, 'brightness', -1, 1, 0.01).name('Brightness').onFinishChange(saveParameters)
camera2Folder.add(parameters.camera2, 'contrast', -1, 1, 0.01).name('Contrast').onFinishChange(saveParameters)
camera2Folder.add(parameters.camera2, 'applyFilters').name('Apply filters').onFinishChange(saveParameters)

let transitionsFolder = gui.addFolder('Transitions')

transitionsFolder.add(parameters, 'cameraDuration', 0, 60, 0.1).name('Camera duration').onChange(updateTransitionTimeout).onFinishChange(saveParameters)
transitionsFolder.add(parameters, 'cameraSwitchRatio', 0, 1, 0.01).name('Camera switch ratio').onFinishChange(saveParameters)
transitionsFolder.add(parameters, 'autoTransitions').name('Auto transitions').onFinishChange(saveParameters)

let effectFolder = gui.addFolder('Effects')

effectFolder.add(parameters, 'effectDuration', 0, 60, 0.1).name('Effect duration').onChange(updateEffectTimeout).onFinishChange(saveParameters)
effectFolder.add(parameters, 'effectDurationRatio', 0, 1, 0.01).name('Effect duration ratio').onFinishChange(saveParameters)
effectFolder.add(parameters, 'autoEffects').name('Auto effects').onFinishChange(saveParameters)

let actionsFolder = gui.addFolder('Actions')
actionsFolder.add(actions, 'enableEffect').name('Enable effect').onChange((value)=> applyEffect = value)
actionsFolder.add(actions, 'triggerTransition').name('Trigger transition')
actionsFolder.add(actions, 'changeBackgroundVideo').name('Change background')

gui.add(parameters, 'switchCamera').name('Switch camera').onFinishChange(saveParameters)


gui.add(parameters, 'pause').name('Pause').onChange(pauseVideo).onFinishChange(saveParameters)


var canvas = document.getElementById("renderCanvas"); // Get the canvas element
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
var video1 = mediaJSON.videos[0];
var video2 = mediaJSON.videos[1];


let addVideoName = (videosJ, videoName)=> {
  let videoNumber = videosJ.children().length + 1
  let videoNumberString = ('' + videoNumber).padStart(3, '0')
  videosJ.append( $('<li>').text(videoNumberString + '. ' + videoName.substring(0, videoName.length-4 ) ) )
}

let parseFileList = (data)=> {
  let fileList = []
  let parser = new DOMParser(); 
  let doc = parser.parseFromString(data, "text/html")

  $(doc.documentElement).find('#files li a').each((elementIndex, element)=> {

    let fileName = element.getAttribute('title')
    if(fileName != '..') {
      fileList.push(fileName)
    }

  })

  return fileList;
}

$.get( "files/videos/", function(data) {
  lyricsVideoNames = parseFileList(data)

  for(let lyricsVideoName of lyricsVideoNames) {
    addVideoName(videosJ, lyricsVideoName)
  }
  showMenu()
});

$.get( "files/background-videos/", function(data) {
  backgroundVideoNames = parseFileList(data)
});

var jqxhr = $.get( "files/titles.txt", function(data) {


  let lines = data.split('\n');
  for(let videoName of lines) {
      lyricsVideoNames.push(videoName)
      addVideoName(videosJ, videoName.substring(7))
  }
  showMenu()
  

});

var createScene = function() {
  // Setup scene
  var scene = new BABYLON.Scene(engine);
  

  var camera = new BABYLON.FreeCamera(
    "camera1",
    new BABYLON.Vector3(0, 0, -10),
    scene
  );
  camera.setTarget(BABYLON.Vector3.Zero());
  // camera.attachControl(canvas, true);

  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

  camera.orthoTop = window.innerHeight / 2;
  camera.orthoBottom = -window.innerHeight / 2;
  camera.orthoLeft = -window.innerWidth / 2;
  camera.orthoRight = window.innerWidth / 2;

  return scene;
};

scene = createScene(); //Call the createScene function
setBackgroundColor();

// Create a material from the video


backgroundVideoTexture = new BABYLON.VideoTexture(
  "backgroundVideo",
  video1.sources,
  scene,
  false,
  false,
  BABYLON.Texture.TRILINEAR_SAMPLINGMODE
  // { autoPlay: true, autoUpdateTexture: true, loop: true }
);

backgroundVideoTexture.video.muted = true;
backgroundVideoTexture.video.pause()

let lyricsVideoTexture = new BABYLON.VideoTexture(
  "lyricsVideo",
  video2.sources,
  scene,
  false,
  false,
  BABYLON.Texture.TRILINEAR_SAMPLINGMODE
  // { autoPlay: true, autoUpdateTexture: true, loop: true }
);

lyricsVideoTexture.video.pause();


BABYLON.Effect.ShadersStore["customVertexShader"] = vertexShader;

BABYLON.Effect.ShadersStore["customFragmentShader"] = fragmentShader;

var shaderMaterial = new BABYLON.ShaderMaterial(
  "shader",
  scene,
  {
    vertex: "custom",
    fragment: "custom"
  },
  {
    attributes: ["position", "normal", "uv"],
    uniforms: [
      "world",
      "worldView",
      "worldViewProjection",
      "view",
      "projection"
    ]
  }
);

navigator.mediaDevices.enumerateDevices().then((devices)=> {
  
  let webcamIds = [];
  
  for(let device of devices) {
    if(device.kind == "videoinput") {
      webcamIds.push(device.deviceId)
    }
  }

  let constraints1 = { video: { deviceId: { exact: webcamIds[0] } }, audio: false }
  let constraints2 = { video: { deviceId: { exact: webcamIds[1] } }, audio: false }

  let startWebCam = (constraints, name)=> {

    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(mediaStream) {
      var video = document.querySelector('#'+name)
      video.srcObject = mediaStream
      let webcamTexture = new BABYLON.VideoTexture(name, video, scene, false, false)
      
      video.onloadedmetadata = function(e) {
        video.play()
        console.log(name + ' started')
      };

      video.oncanplay = function(e) {
        console.log(name + ' bound')
        console.log(webcamTexture)
        shaderMaterial.setTexture(name + "Texture", webcamTexture)
      }

    })
    .catch(function(err) { console.log(err.name + ": " + err.message); })
  }

  startWebCam(constraints1, 'camera1')
  startWebCam(constraints2, 'camera2')

});


// var refTexture = new BABYLON.Texture("http://i.imgur.com/HP1V7TJ.png", scene);

shaderMaterial.setTexture("backgroundVideoTexture", backgroundVideoTexture);
shaderMaterial.setTexture("lyricsVideoTexture", lyricsVideoTexture);
shaderMaterial.setTexture("camera1Texture", backgroundVideoTexture);
shaderMaterial.setTexture("camera2Texture", backgroundVideoTexture);
shaderMaterial.setFloat("time", 0);
shaderMaterial.backFaceCulling = false;

// Attach the video material the a mesh
plane = BABYLON.Mesh.CreatePlane("plane1", 1, scene);

resizeCameraPlane()

plane.material = shaderMaterial;

let startTime = Date.now()

scene.registerBeforeRender(function() {
  
  let time = Date.now();
  
  if(parameters.autoTransitions || transitionActive) {
    if(time > transitionEndTimeout) {                       // restart
      if(parameters.autoTransitions) {
        updateTransitionTimeout()
        transitionNumber = Math.floor(Math.random() * NTransitions)
      }
      transitionActive = false;
      cameraSelection = 0.0;
    } else if(time > beginCameraFadeOutTimeout) {           // start decrease
      let timeElapsedSinceTimeout = time - beginCameraFadeOutTimeout;
      let t = timeElapsedSinceTimeout / camera2TranstionDuration;
      cameraSelection = Math.max(1.0 - t, 0.0);
    } else if (time > transitionBeginTimeout) {             // start increase
      let timeElapsedSinceTimeout = time - transitionBeginTimeout;
      let t = timeElapsedSinceTimeout / camera2TranstionDuration;
      cameraSelection = Math.min(1.0, t);
    }
  }

  if(parameters.autoEffects) {

    if(time > effectEndTimeout) {
      updateEffectTimeout()
      applyEffect = false
    } else if(time > effectBeginTimeout) {
      if(!applyEffect) {
        triggerEffect()
      }
    }
  }

  // console.log(phase, time, transitionBeginTimeout, beginCameraFadeOutTimeout, transitionEndTimeout, cameraSelection)
  

  shaderMaterial.setFloat("time", (time - startTime) / 1000.0);


  shaderMaterial.setFloat("lyricsThreshold", parameters.lyrics.threshold);
  shaderMaterial.setFloat("lyricsScale", parameters.lyrics.scale);
  shaderMaterial.setFloat("lyricsPositionX", parameters.lyrics.positionX);
  shaderMaterial.setFloat("lyricsPositionY", parameters.lyrics.positionY);

  shaderMaterial.setFloat("camera1Threshold", parameters.camera1.threshold);
  shaderMaterial.setVector3("camera1ThresholdColor", arrayToBabylonColor(parameters.camera1.thresholdColor));
  shaderMaterial.setInt("camera1ApplyThresholdInt", parameters.camera1.applyThreshold);

  shaderMaterial.setFloat("camera1Hue", parameters.camera1.hue);
  shaderMaterial.setFloat("camera1Saturation", parameters.camera1.saturation);
  shaderMaterial.setFloat("camera1Brightness", parameters.camera1.brightness);
  shaderMaterial.setFloat("camera1Contrast", parameters.camera1.contrast);

  shaderMaterial.setInt("camera1ApplyFiltersInt", parameters.camera1.applyFilters);

  shaderMaterial.setFloat("camera2Threshold", parameters.camera2.threshold);
  shaderMaterial.setVector3("camera2ThresholdColor", arrayToBabylonColor(parameters.camera2.thresholdColor));
  shaderMaterial.setInt("camera2ApplyThresholdInt", parameters.camera2.applyThreshold);

  shaderMaterial.setFloat("camera2Hue", parameters.camera2.hue);
  shaderMaterial.setFloat("camera2Saturation", parameters.camera2.saturation);
  shaderMaterial.setFloat("camera2Brightness", parameters.camera2.brightness);
  shaderMaterial.setFloat("camera2Contrast", parameters.camera2.contrast);

  shaderMaterial.setInt("camera2ApplyFiltersInt", parameters.camera2.applyFilters);


  shaderMaterial.setInt("transitionNumber", transitionNumber);
  shaderMaterial.setFloat("cameraSelection", parameters.switchCamera ? 1.0 - cameraSelection : cameraSelection);

  shaderMaterial.setInt("applyEffectInt", applyEffect);
  shaderMaterial.setInt("effectNumber", effectNumber);
});

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function() {
  scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function() {
  engine.resize();
});

window.lyricsVideoNames = lyricsVideoNames
window.selectedVideoIndex = selectedVideoIndex

let selectVideo = ()=> {
  lyricsVideoTexture.updateURL('files/videos/' + lyricsVideoNames[selectedVideoIndex-1])
  changeBackgroundVideo()
  menuJ.hide()
  clearTimeout(selectVideoTimeoutID)
}

document.onkeydown = (event) => {

  let typeVideoNumberJ = $('input[name="video-number"]')
  let typedVideoNumber = '' + (parseInt(typeVideoNumberJ.val()) || 0)     // to remove leading 0s
  let typeVideoNumberChanged = false;

  if(event.keyCode >= 48 && event.keyCode <= 57) {                 // digits
    
    if(typedVideoNumber.length < 3) {
      typedVideoNumber += event.key
    }
    typeVideoNumberChanged = true

  }

  if(event.keyCode == 8 && typedVideoNumber.length > 0) {          // delete key
    typedVideoNumber = typedVideoNumber.substring(0, typedVideoNumber.length - 1)
    typeVideoNumberChanged = true
  }

  if(typeVideoNumberChanged) {
    console.log(typedVideoNumber)
    console.log(typedVideoNumber.padStart(3, '0'))
    typeVideoNumberJ.val(typedVideoNumber.padStart(3, '0'))

    let newVideoNumber = typedVideoNumber.length > 0 ? parseInt(typedVideoNumber) : 1;
    if(newVideoNumber <= lyricsVideoNames.length) {
        selectedVideoIndex = newVideoNumber
    }
  }

  let numberOrArrow = typeVideoNumberChanged || [37, 38, 39, 40].indexOf(event.keyCode) >= 0;

  switch (event.keyCode) {
    case 37:
      // console.log('left arrow')
      break; 
    case 39:
      // console.log('right arrow')
      break; 
    case 38:
      // console.log('up arrow')
      selectedVideoIndex--
      if(selectedVideoIndex <= 0) {
        selectedVideoIndex = lyricsVideoNames.length
      }
      typeVideoNumberJ.val(('' + selectedVideoIndex).padStart(3, '0'))
      break; 
    case 40:
      // console.log('down arrow')
      selectedVideoIndex++
      if(selectedVideoIndex > lyricsVideoNames.length) {
        selectedVideoIndex = 1
      }
      typeVideoNumberJ.val(('' + selectedVideoIndex).padStart(3, '0'))
      break;
    default:
      break;
  }

  if(event.key == 'e' && !parameters.autoEffects && !applyEffect) {
    triggerEffect()
  }

  if(event.key == 'b') {
    changeBackgroundVideo()
  }

  if(event.key == 't') {
    triggerTransition()
  }

  if(numberOrArrow) {
    showMenu()
  }

  if(event.key == ' ' || event.key == 'Enter' || event.keyCode == 32 || event.keyCode == 13) {
    selectVideo()
  }

  if(event.key == 'p') {
    pauseVideo(!lyricsVideoTexture.video.paused)
  }

}

document.onkeyup = (event) => {


  if(event.key == 'e' && !parameters.autoEffects) {
    applyEffect = false;
  }
}

window.backgroundVideoTexture = backgroundVideoTexture;