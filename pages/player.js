(function() {
    console.log("Player page loaded");

    let videoPlayer, videoTitle, videoMeta, descriptionText, showMoreBtn, backButton, player;

    async function initPlayer() {
        videoPlayer = document.getElementById('video-player');
        videoTitle = document.getElementById('video-title');
        videoMeta = document.getElementById('video-meta');
        descriptionText = document.getElementById('description-text');
        showMoreBtn = document.getElementById('show-more');
        backButton = document.getElementById('back-button');

        // Plyr initialization
        player = new Plyr(videoPlayer, {
            controls: [
                'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            previewThumbnails: {
                enabled: false,
            }
        });

        // Загрузка текущего видео
        if (window.currentVideo) {
            filePath = window.currentVideo;
            videoPlayer.src = filePath;
            try {
                loadVideoMetadata(filePath);

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
        } else {
            console.error('No video selected');
            // Можно добавить здесь логику для возврата на главную страницу
        }

        showMoreBtn.addEventListener('click', () => {
            const isExpanded = descriptionText.style.maxHeight;
            descriptionText.style.maxHeight = isExpanded ? null : `${descriptionText.scrollHeight}px`;
            showMoreBtn.textContent = isExpanded ? 'Show more' : 'Show less';
        });

        player.on('destroy', () => {
            videoPlayer.src = '';
            if (window.gc) window.gc();
        });
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
})();