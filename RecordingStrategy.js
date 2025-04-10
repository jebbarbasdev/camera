//@ts-check

import { CameraEvents, CameraStates } from "./enums.js";

export class CanvasRecordingStrategy {
    constructor(camera) {
        this.camera = camera;
        this.frameRequest = null;
    }

    startRecording() {
        const {
            videoElement,
            canvasForRecording,
            facingMode,
            mediaStream,
            canvasContext: ctx
        } = this.camera;

        if (!ctx) {
            this.camera._handleError('No se pudo obtener el contexto del canvas.');
            return;
        }

        canvasForRecording.width = videoElement.videoWidth;
        canvasForRecording.height = videoElement.videoHeight;

        const canvasStream = canvasForRecording.captureStream();
        const audioTracks = mediaStream?.getAudioTracks?.() || [];
        if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0]);

        const mediaRecorder = new MediaRecorder(canvasStream);
        this.camera.mediaRecorder = mediaRecorder;
        this.camera.recordedChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) this.camera.recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(this.camera.recordedChunks, { type: 'video/webm' });
            this.camera.lastVideoBlob = blob;
            this.camera._resetVideoPreview();
            this.camera.videoPreview.src = URL.createObjectURL(blob);
            this.camera.videoPreview.loop = true;
            this.camera.videoPreview.play().catch(() => {});
            this.camera._setState(CameraStates.PREVIEW_VIDEO);
            this.camera._emit(CameraEvents.STOP_RECORDING, blob);
        };

        mediaRecorder.start();
        this.#startLoop(ctx);
        this.camera._emit(CameraEvents.START_RECORDING);
        this.camera._setState(CameraStates.RECORDING);
    }

    stopRecording() {
        if (this.camera.mediaRecorder?.state === 'recording') {
            this.camera.mediaRecorder.stop();
            this.#cancelLoop();
        }
    }

    #startLoop(ctx) {
        const { canvasForRecording, videoElement, facingMode } = this.camera;

        const draw = () => {
            if (this.camera.state !== CameraStates.RECORDING) return;

            ctx.save();
            if (facingMode === 'user') {
                ctx.translate(canvasForRecording.width, 0);
                ctx.scale(-1, 1);
            } else {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
            }

            ctx.clearRect(0, 0, canvasForRecording.width, canvasForRecording.height);
            ctx.drawImage(videoElement, 0, 0);
            ctx.restore();

            this.frameRequest = requestAnimationFrame(draw);
        };

        this.frameRequest = requestAnimationFrame(draw);
    }

    #cancelLoop() {
        if (this.frameRequest) {
            cancelAnimationFrame(this.frameRequest);
            this.frameRequest = null;
        }
    }
}

export class DirectStreamRecordingStrategy {
    constructor(camera) {
        this.camera = camera;
    }

    startRecording() {
        if (!this.camera.mediaStream) {
            this.camera._handleError("No hay mediaStream activo.");
            return;
        }

        const mediaRecorder = new MediaRecorder(this.camera.mediaStream);
        this.camera.mediaRecorder = mediaRecorder;
        this.camera.recordedChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) this.camera.recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(this.camera.recordedChunks, { type: 'video/webm' });
            this.camera.lastVideoBlob = blob;
            this.camera._resetVideoPreview();
            this.camera.videoPreview.src = URL.createObjectURL(blob);
            this.camera.videoPreview.loop = true;
            this.camera.videoPreview.play().catch(() => {});
            this.camera._setState(CameraStates.PREVIEW_VIDEO);
            this.camera._emit(CameraEvents.STOP_RECORDING, blob);
        };

        mediaRecorder.start();
        this.camera._emit(CameraEvents.START_RECORDING);
        this.camera._setState(CameraStates.RECORDING);
    }

    stopRecording() {
        if (this.camera.mediaRecorder?.state === 'recording') {
            this.camera.mediaRecorder.stop();
        }
    }
}