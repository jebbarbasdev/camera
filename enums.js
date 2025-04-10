//@ts-check

// Tipos de estado y eventos
export const CameraStates = {
    OFF: 'off',
    IDLE: 'idle',
    RECORDING: 'recording',
    PREVIEW_IMAGE: 'preview_image',
    PREVIEW_VIDEO: 'preview_video'
};

export const CameraEvents = {
    TAKE_IMAGE: 'take_image',
    START_RECORDING: 'start_recording',
    STOP_RECORDING: 'stop_recording',
    RETAKE_IMAGE: 'retake_image',
    RETAKE_VIDEO: 'retake_video',
    CONFIRM_IMAGE: 'confirm_image',
    CONFIRM_VIDEO: 'confirm_video',
    CAMERA_ON: 'camera_on',
    CAMERA_OFF: 'camera_off',
    STATE_CHANGE: 'statechange',
    ERROR: 'error',
    WARNING: 'warning',
    TOGGLE_CAMERA: 'toggle_camera',
    PERFORMANCE_MODE_SELECTED: 'performance_mode_selected'
};

export const PerformanceModes = {
    HIGH: 'HIGH_PERFORMANCE',
    LOW: 'LOW_PERFORMANCE',
    AUTO: 'AUTO'
};