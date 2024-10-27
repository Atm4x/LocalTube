// components/video-player-manager.js
class VideoPlayerManager {
    constructor() {
        this.currentVideo = null;
        this.currentTime = 0;
        this.isPlaying = false;
        this.mainPlayer = null;
        this.floatingPlayer = null;
        this.plyrInstance = null;
    }

    async initMainPlayer(videoElement) {
        try {
            if (this.plyrInstance) {
                this.plyrInstance.destroy();
            }

            this.mainPlayer = videoElement;
            this.plyrInstance = new Plyr(videoElement, {
                controls: [
                ],
                settings: ['captions', 'quality', 'speed', 'loop'],
            });

            this.plyrInstance.on('timeupdate', () => {
                this.currentTime = this.plyrInstance.currentTime;
            });

            if (this.currentVideo) {
                await this.loadVideo(this.currentVideo, this.currentTime);
            }
        } catch (error) {
            console.error('Error initializing main player:', error);
        }
    }

    initFloatingPlayer(videoElement) {
        this.floatingPlayer = videoElement;
        if (this.currentVideo) {
            this.floatingPlayer.src = this.currentVideo;
            this.floatingPlayer.currentTime = this.currentTime;
        }
    }

    async loadVideo(videoPath, startTime = 0) {
        try {
            this.currentVideo = videoPath;
            
            if (this.plyrInstance) {
                this.plyrInstance.source = {
                    type: 'video',
                    sources: [{ src: videoPath, type: 'video/mp4' }]
                };
                
                this.plyrInstance.once('loadedmetadata', () => {
                    this.plyrInstance.currentTime = startTime || this.currentTime;
                    if (this.isPlaying) this.plyrInstance.play();
                });
            }

            if (this.floatingPlayer) {
                this.floatingPlayer.src = videoPath;
                this.floatingPlayer.currentTime = startTime || this.currentTime;
                if (this.isPlaying) this.floatingPlayer.play();
            }
        } catch (error) {
            console.error('Error loading video:', error);
        }
    }

    switchToFloating() {
        if (!this.currentVideo) return;

        if (this.plyrInstance) {
            this.currentTime = this.plyrInstance.currentTime;
            this.isPlaying = !this.plyrInstance.paused;
        }

        const floatingContainer = document.getElementById('floating-player-container');
        if (floatingContainer) {
            floatingContainer.classList.remove('hidden');
            if (this.floatingPlayer) {
                this.floatingPlayer.currentTime = this.currentTime;
                if (this.isPlaying) this.floatingPlayer.play();
            }
        }
    }

    switchToMain() {
        if (!this.currentVideo) return;

        if (this.floatingPlayer) {
            this.currentTime = this.floatingPlayer.currentTime;
            this.isPlaying = !this.floatingPlayer.paused;
            this.floatingPlayer.pause();
        }

        const floatingContainer = document.getElementById('floating-player-container');
        if (floatingContainer) {
            floatingContainer.classList.add('hidden');
        }

        window.appFunctions.loadPage('player');
    }
}

module.exports = VideoPlayerManager;