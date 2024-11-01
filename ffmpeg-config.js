const ffmpeg = require('fluent-ffmpeg');

const setFFmpegPaths = () => {
    try {

        ffmpeg.setFfmpegPath(path.join(process.resourcesPath, 'ffmpeg.exe'));
        ffmpeg.setFfprobePath(path.join(process.resourcesPath, 'ffprobe.exe'));

        console.log('FFmpeg paths set successfully');
    } catch (error) {
        console.error('Error setting FFmpeg paths:', error);
    }
};

module.exports = {
    setFFmpegPaths,
    ffmpeg
};