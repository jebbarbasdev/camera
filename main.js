//@ts-check
import Camera from "./Camera.js";

// Enums importados por separado si es modular
import { CameraEvents } from './enums.js'; // O donde los tengas definidos

const camera = new Camera('#camera-wrapper');

Object.assign(window, { camera, Camera });

const $ = id => document.getElementById(id);

// Funciones de UI
function updateButtonVisibility(cameraState) {
    document.querySelectorAll('[data-camera-state]').forEach(div => {
        const expected = div.getAttribute('data-camera-state');
        div.style.display = expected === cameraState ? 'flex' : 'none';
    });
}

function showNotification(id, text) {
    const box = $(id);
    const textSpan = box.querySelector('.message-text');
    if (textSpan) textSpan.textContent = text;
    box.classList.remove('is-hidden');
}

function hideNotification(id) {
    $(id).classList.add('is-hidden');
}

// Listeners de botones
$('startCamera').addEventListener('click', () => camera.start());
$('stopCamera').addEventListener('click', () => camera.stop());
$('toggleCamera').addEventListener('click', () => camera.toggleCamera());

$('takePhoto').addEventListener('click', () => camera.takeImage());
$('retakePhoto').addEventListener('click', () => camera.retakeImage());
$('sendPhoto').addEventListener('click', () => camera.confirmImage());

$('startRecording').addEventListener('click', () => camera.startVideo());
$('stopRecording').addEventListener('click', () => camera.stopVideo());
$('retakeVideo').addEventListener('click', () => camera.retakeVideo());
$('sendVideo').addEventListener('click', () => camera.confirmVideo());

// Listeners de eventos de cámara
camera.addEventListener(CameraEvents.STATE_CHANGE, newState => {
    $('states').querySelector('strong').innerText = newState;
    updateButtonVisibility(newState);
    hideNotification('errors');
    hideNotification('warnings');
});

camera.addEventListener(CameraEvents.PERFORMANCE_MODE_SELECTED, mode => {
    $('performanceDiv').querySelector('strong').innerText = mode;
});

camera.addEventListener(CameraEvents.ERROR, msg => {
    showNotification('errors', msg);
});

camera.addEventListener(CameraEvents.WARNING, msg => {
    showNotification('warnings', msg);
});

camera.addEventListener(CameraEvents.CONFIRM_IMAGE, imageBlob => {
    console.log('✅ Imagen confirmada:', imageBlob);
});

camera.addEventListener(CameraEvents.CONFIRM_VIDEO, videoBlob => {
    console.log('🎥 Video confirmado:', videoBlob);
});

camera.addEventListener(CameraEvents.START_RECORDING, () => {
    console.log('▶️ Grabando...');
});

camera.addEventListener(CameraEvents.STOP_RECORDING, () => {
    console.log('⏹ Grabación finalizada');
});

updateButtonVisibility('off'); // Ocultar todo al arrancar