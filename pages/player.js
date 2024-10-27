(function() {
    console.log("Player page loaded");

    let videoPlayer, videoTitle, videoMeta, descriptionText, showMoreBtn, player;
    const unifiedPlayer = document.getElementById('unified-player');
    
    async function initPlayer() {
        
        // Добавляем класс для страницы плеера
        document.getElementById('page-content').classList.add('player-page');
        
        // Настраиваем unified-player для полноэкранного режима
        unifiedPlayer.classList.remove('minimized');
        unifiedPlayer.classList.add('maximized');
        unifiedPlayer.classList.add('visible');

        videoPlayer = document.getElementById('video-player');
        videoTitle = document.getElementById('video-title');
        videoMeta = document.getElementById('video-meta');
        descriptionText = document.getElementById('description-text');
        showMoreBtn = document.getElementById('show-more');

        
        // Проверяем существует ли уже плеер
        if (!window.globalPlayer) {
            // Инициализируем Plyr только если его еще нет
            window.globalPlayer = new Plyr(videoPlayer, {
                controls: [
                    'play-large', 'play', 'progress', 'current-time', 'mute',
                    'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
                ],
                settings: ['captions', 'quality', 'speed', 'loop'],
                tooltips: { controls: true, seek: true }
            });
        }
        window.globalPlayer.on('controlsshown', () => console.log('Controls shown'));
        window.globalPlayer.on('controlshidden', () => console.log('Controls hidden'));
        if (window.currentVideo) {
            // Проверяем, не совпадает ли текущий источник с новым
            if (window.currentVideoSource === window.currentVideo) {
                console.log('Same video, skipping...');
                return;
            }
            filePath = window.currentVideo;
            try {
                loadVideoMetadata(filePath);
                window.globalPlayer.source = {
                    type: 'video',
                    sources: [{ src: filePath, type: 'video/mp4' }],
                };
                
                window.currentVideoSource = window.currentVideo;
               
                window.globalPlayer.on('loadedmetadata', () => {
                    window.globalPlayer.play().catch(error => {
                        console.error('Error auto-playing video:', error);
                    });
                });
            } catch (error) {
                console.error('Error loading video:', error);
            }
        }
    }

    function cleanup() {
        document.getElementById('page-content').classList.remove('player-page');
        if (player) {
            window.currentVideoTime = player.currentTime;
            window.isVideoPlaying = !player.paused;
            player.destroy();
        }
    }


    async function loadVideo(filePath) {
        videoPlayer.src = filePath;
        try {
            await loadVideoMetadata(filePath);

            player.source = {
                type: 'video',
                sources: [{ src: filePath, type: 'video/mp4' }],
            };
           
            player.on('loadedmetadata', () => {
                player.play().catch(error => {
                    console.error('Error auto-playing video:', error);
                });
            });

        } catch (error) {
            console.error('Error loading video:', error);
        }
    }

    function loadVideoMetadata(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.setFfprobePath(ffprobe.path);
            
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    console.error('Error reading metadata:', err);
                    reject(err);
                    return;
                }

                try {
                    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
                    
                    const title = path.basename(filePath, path.extname(filePath))
                        .replace(/-\d+$/, '')
                        .replace(/_/g, ' ');

                    videoTitle.textContent = title;
                    videoMeta.textContent = metadata.format.format_name || 'Unknown format';
                    descriptionText.textContent = 'No description available';

                    resolve({
                        title: title,
                        format: metadata.format.format_name || 'Unknown format'
                    });
                } catch (error) {
                    console.error('Error processing metadata:', error);
                    reject(error);
                }
            });
        });
    }

    function formatBitrate(bitrate) {
        if (!bitrate) return 'Unknown bitrate';
        return `${Math.round(bitrate / 1000)} kbps`;
    }

    // Инициализация плеера при загрузке страницы
    initPlayer();
    return { cleanup };
})();