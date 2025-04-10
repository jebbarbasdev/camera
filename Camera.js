//@ts-check

import { CameraEvents, CameraStates, PerformanceModes } from "./enums.js";
import { CanvasRecordingStrategy, DirectStreamRecordingStrategy } from "./RecordingStrategy.js";

export default class Camera {
    constructor(selector, options = {}) {
        this.container = document.querySelector(selector);
        if (!this.container) throw new Error("Contenedor no encontrado.");

        const {
            facingMode = 'environment',
            autostart = false,
            performanceMode = PerformanceModes.AUTO
        } = options;

        this.facingMode = facingMode;
        this.autostart = autostart;
        this.performanceMode = performanceMode;
        this.currentPerformanceMode = PerformanceModes.LOW;

        this.state = CameraStates.OFF;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.lastPhotoBlob = null;
        this.lastVideoBlob = null;
        this.permissionsGranted = false;

        this.strategy = null;

        this.eventHandlers = {};
        Object.values(CameraEvents).forEach(e => this.eventHandlers[e] = new Set());

        this.videoElement = document.createElement('video');
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;

        this.imagePreview = document.createElement('img');
        this.videoPreview = document.createElement('video');
        this.videoPreview.controls = true;

        this.canvasForRecording = document.createElement('canvas');
        this.canvasContext = this.canvasForRecording.getContext('2d');

        this.#hideAll();
        this.container.append(this.videoElement, this.imagePreview, this.videoPreview);

        if (this.autostart) this.start();
    }

    async start() {
        try {
            if (!this.permissionsGranted) {
                const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                temp.getTracks().forEach(t => t.stop());
                this.permissionsGranted = true;
            }

            await this.#init();
            this._emit(CameraEvents.CAMERA_ON);
        } catch (e) {
            this._handleError('Error al iniciar cámara: ' + e.message);
        }
    }

    stop() {
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.videoElement.srcObject = null;
        this.mediaStream = null;
        this._resetImagePreview();
        this._resetVideoPreview();
        this._setState(CameraStates.OFF);
        this._emit(CameraEvents.CAMERA_OFF);
    }

    async toggleCamera() {
        if (this.state !== CameraStates.IDLE) {
            this._handleWarning('Solo puedes cambiar de cámara en estado IDLE.');
            return;
        }

        const prev = this.facingMode;
        this.facingMode = prev === 'user' ? 'environment' : 'user';

        try {
            await this.#init();
            this._emit(CameraEvents.TOGGLE_CAMERA, this.facingMode);
        } catch (err) {
            this._handleWarning(`No se pudo cambiar de cámara: ${err.message}`);
            this.facingMode = prev;
            await this.#init();
        }
    }

    takeImage() {
        if (this.state !== CameraStates.IDLE) return;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return this._handleError('No se pudo obtener contexto de canvas.');

        if (this.#shouldMirror()) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(this.videoElement, 0, 0);
        canvas.toBlob(blob => {
            if (blob) {
                this._resetImagePreview();
                this.imagePreview.src = URL.createObjectURL(blob);
                this.lastPhotoBlob = blob;
                this._setState(CameraStates.PREVIEW_IMAGE);
                this._emit(CameraEvents.TAKE_IMAGE, blob);
            }
        }, 'image/png');
    }

    retakeImage() {
        if (this.state !== CameraStates.PREVIEW_IMAGE) return;
        this._resetImagePreview();
        this._setState(CameraStates.IDLE);
        this._emit(CameraEvents.RETAKE_IMAGE);
    }

    confirmImage() {
        if (this.state !== CameraStates.PREVIEW_IMAGE || !this.lastPhotoBlob) return;
        this._emit(CameraEvents.CONFIRM_IMAGE, this.lastPhotoBlob);
        this._resetImagePreview();
        this.lastPhotoBlob = null;
        this._setState(CameraStates.IDLE);
    }

    startVideo() {
        if (this.state !== CameraStates.IDLE) {
            this._handleWarning(`No se puede iniciar grabación en estado '${this.state}'`);
            return;
        }

        this.recordedChunks = [];

        if (!this.strategy) {
            this._handleError('Estrategia de grabación no definida.');
            return;
        }

        this.strategy.startRecording();
    }

    stopVideo() {
        if (this.state !== CameraStates.RECORDING) return;
        this.strategy?.stopRecording();
    }

    retakeVideo() {
        if (this.state !== CameraStates.PREVIEW_VIDEO) return;
        this._resetVideoPreview();
        this._setState(CameraStates.IDLE);
        this._emit(CameraEvents.RETAKE_VIDEO);
    }

    confirmVideo() {
        if (this.state !== CameraStates.PREVIEW_VIDEO || !this.lastVideoBlob) return;
        this._emit(CameraEvents.CONFIRM_VIDEO, this.lastVideoBlob);
        this._resetVideoPreview();
        this.lastVideoBlob = null;
        this._setState(CameraStates.IDLE);
    }

    async #init() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.videoElement.srcObject = null;
            this.mediaStream = null;
        }

        const fallback = this.facingMode === 'user' ? 'environment' : 'user';

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.facingMode },
                audio: true
            });
        } catch {
            this._handleWarning(`No se pudo acceder a '${this.facingMode}', probando '${fallback}'...`);
            try {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: fallback },
                    audio: true
                });
                this.facingMode = fallback;
            } catch (err) {
                this._handleError('No se pudo acceder a la cámara: ' + err.message);
                return;
            }
        }

        const track = this.mediaStream.getVideoTracks()[0];
        const realFacing = track?.getSettings?.()?.facingMode;
        if (realFacing === 'user' || realFacing === 'environment') {
            this.facingMode = realFacing;
        }

        this.videoElement.srcObject = this.mediaStream;
        this.videoElement.onloadedmetadata = () => this.#applyMirror();
        this.videoElement.play().catch(() => {});

        this.#selectStrategy();
        this._setState(CameraStates.IDLE);
    }

    #selectStrategy() {
        const isLow = Camera.isLowPowerDevice();
        const selectedMode = this.performanceMode === PerformanceModes.AUTO
            ? (isLow ? PerformanceModes.LOW : PerformanceModes.HIGH)
            : this.performanceMode;

        this.currentPerformanceMode = selectedMode;

        this.strategy = selectedMode === PerformanceModes.HIGH
            ? new CanvasRecordingStrategy(this)
            : new DirectStreamRecordingStrategy(this);

        this._emit(CameraEvents.PERFORMANCE_MODE_SELECTED, selectedMode);
    }

    #shouldMirror() {
        return this.currentPerformanceMode === PerformanceModes.HIGH && this.facingMode === 'user';
    }

    #applyMirror() {
        this.videoElement.style.transform = this.#shouldMirror() ? 'scaleX(-1)' : 'scaleX(1)';
        this.imagePreview.style.transform = 'scaleX(1)';
        this.videoPreview.style.transform = 'scaleX(1)';
    }

    _resetImagePreview() {
        if (this.imagePreview.src) URL.revokeObjectURL(this.imagePreview.src);
        this.imagePreview.src = '';
    }

    _resetVideoPreview() {
        this.videoPreview.pause();
        this.videoPreview.currentTime = 0;
        if (this.videoPreview.src) URL.revokeObjectURL(this.videoPreview.src);
        this.videoPreview.src = '';
    }

    #hideAll() {
        this.videoElement.style.display = 'none';
        this.imagePreview.style.display = 'none';
        this.videoPreview.style.display = 'none';
    }

    #updateUI() {
        this.#hideAll();
        if ([CameraStates.IDLE, CameraStates.RECORDING].includes(this.state)) {
            this.videoElement.style.display = 'block';
        } else if (this.state === CameraStates.PREVIEW_IMAGE) {
            this.imagePreview.style.display = 'block';
        } else if (this.state === CameraStates.PREVIEW_VIDEO) {
            this.videoPreview.style.display = 'block';
        }
    }

    _setState(newState) {
        this.state = newState;
        this.#updateUI();
        this._emit(CameraEvents.STATE_CHANGE, newState);
    }

    _emit(event, data) {
        this.eventHandlers[event]?.forEach(cb => cb(data));
    }

    addEventListener(event, cb) {
        this.eventHandlers[event]?.add(cb);
    }

    removeEventListener(event, cb) {
        this.eventHandlers[event]?.delete(cb);
    }

    _handleError(msg) {
        console.error('[Camera Error]', msg);
        this._emit(CameraEvents.ERROR, msg);
    }

    _handleWarning(msg) {
        console.warn('[Camera Warning]', msg);
        this._emit(CameraEvents.WARNING, msg);
    }

    static isLowPowerDevice() {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        const memory = navigator.deviceMemory || 1;
        const cores = navigator.hardwareConcurrency || 2;
        return isMobile && (memory <= 2 || cores <= 2);
    }
}
