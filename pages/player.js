

(function() {
    console.log("Player page loaded");
    
    let videoPlayer, videoTitle, videoMeta, descriptionText, showMoreBtn, player;
    const unifiedPlayer = document.getElementById('unified-player');

    async function updateRecommendations() {
        if (!window.currentVideo) return;
    
        // Получаем список всех видео
        ipcRenderer.send('index-videos');
        ipcRenderer.once('video-list', async (event, videos) => {
            const recommendations = await recommendationSystem.getRecommendations(
                window.currentVideo,
                videos
            );
            displayRecommendations(recommendations);
        });
    }

    function displayRecommendations(recommendations) {
        const container = document.getElementById('video-list');
        container.innerHTML = '';
    
        recommendations.forEach(({ videoPath, metadata }) => {
            const recommendationItem = document.createElement('div');
            recommendationItem.className = 'recommendation-item';
    
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'recommendation-thumbnail';
    
            // Загружаем превью
            ipcRenderer.invoke('get-video-thumbnail', videoPath).then(thumbnailPath => {
                const img = document.createElement('img');
                img.src = thumbnailPath;
                thumbnailContainer.appendChild(img);
            });
    
            const infoContainer = document.createElement('div');
            infoContainer.className = 'recommendation-info';
    
            const title = document.createElement('div');
            title.className = 'recommendation-title';
            title.textContent = metadata.title;
    
            const description = document.createElement('div');
            description.className = 'recommendation-description';
            description.textContent = metadata.description.replace(/`n`r/g, '\n');
    
            const views = document.createElement('div');
            views.className = 'recommendation-views';
            views.textContent = `${metadata.views.toLocaleString()} views`;
    
            infoContainer.appendChild(title);
            infoContainer.appendChild(description);
            infoContainer.appendChild(views);
    
            recommendationItem.appendChild(thumbnailContainer);
            recommendationItem.appendChild(infoContainer);
    
            recommendationItem.addEventListener('click', () => {
                window.currentVideo = videoPath;
                window.globalPlayer.source = {
                    type: 'video',
                    sources: [{ src: videoPath, type: 'video/mp4' }]
                };
                window.currentVideoSource = window.currentVideo;
                loadVideoMetadata(videoPath);
                recommendationSystem.updateWatchHistory(videoPath);
                updateRecommendations();
            });
    
            container.appendChild(recommendationItem);
        });
    }

    async function initPlayer() {
        
        // Добавляем класс для страницы плеера
        document.getElementById('page-content').classList.add('player-page');
        
        document.removeEventListener('mousemove', dragPlayer);
        document.removeEventListener('mouseup', dragPlayerEnd);
        

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
                tooltips: { controls: true, seek: true },
                debug: false
            });
        }
        if (window.playerState) {
            window.playerState.isMinimized = false;
        }
        if (window.currentVideo) {
            await updateRecommendations();
            await loadVideoMetadata(window.currentVideo);
            // Проверяем, не совпадает ли текущий источник с новым
            StartGlowAnimation();
            if (window.currentVideoSource === window.currentVideo) {
                console.log('Same video, skipping...');
                return;
            }
            filePath = window.currentVideo;
            try {
                window.globalPlayer.source = {
                    type: 'video',
                    sources: [{ src: filePath, type: 'video/mp4' }],
                };
                window.currentVideoSource = window.currentVideo;
                recommendationSystem.updateWatchHistory(window.currentVideo);
               
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


    // async function loadVideo(filePath) {
    //     videoPlayer.src = filePath;
    //     try {
    //         await loadVideoMetadata(filePath);

    //         player.source = {
    //             type: 'video',
    //             sources: [{ src: filePath, type: 'video/mp4' }],
    //         };
           
    //         player.on('loadedmetadata', () => {
    //             player.play().catch(error => {
    //                 console.error('Error auto-playing video:', error);
    //             });
    //         });

    //     } catch (error) {
    //         console.error('Error loading video:', error);
    //     }
    // }

    function loadVideoMetadata(filePath) {
        return new Promise((resolve, reject) => {
            if(isDevelopment)
                ffmpeg.setFfprobePath(ffprobe.path);
            
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    console.error('Error reading metadata:', err);
                    const fallbackData = {
                        title: path.basename(filePath, path.extname(filePath))
                            .replace(/-\d+$/, '')
                            .replace(/_/g, ' '),
                        format: 'Unknown format',
                        description: 'No description available'
                    };
                    
                    updateVideoInfo(fallbackData);
                    resolve(fallbackData);
                    return;
                }
    
                try {
                    const videoData = {
                        title: metadata.format.tags?.title || path.basename(filePath, path.extname(filePath))
                            .replace(/-\d+$/, '')
                            .replace(/_/g, ' '),
                        format: metadata.format.format_name || 'Unknown format',
                        description: metadata.format.tags?.comment?.replace(/`n`r/g, '\n') || 'No description available'
                    };
    
                    updateVideoInfo(videoData);
                    resolve(videoData);
                } catch (error) {
                    console.error('Error processing metadata:', error);
                    reject(error);
                }
            });
        });
    }
    
    function updateVideoInfo(videoData) {
        videoTitle.textContent = videoData.title;
        videoMeta.textContent = videoData.format;
        
        const descriptionText = document.getElementById('description-text');
        let showMoreButton = document.getElementById('show-more');
        
        // Если кнопка не существует, создаем ее
        if (!showMoreButton) {
            showMoreButton = document.createElement('button');
            showMoreButton.id = 'show-more';
            descriptionText.parentNode.insertBefore(showMoreButton, descriptionText.nextSibling);
        }
        
        const maxHeight = 100; // Максимальная высота в пикселях для сокращенного описания
        
        descriptionText.textContent = videoData.description;
        descriptionText.style.maxHeight = `${maxHeight}px`;
        descriptionText.style.overflow = 'hidden';
        
        showMoreButton.style.display = 'block';
        showMoreButton.textContent = 'Показать больше';
        
        function toggleDescription() {
            if (descriptionText.style.maxHeight) {
                descriptionText.style.maxHeight = null;
                showMoreButton.textContent = 'Показать меньше';
            } else {
                descriptionText.style.maxHeight = `${maxHeight}px`;
                showMoreButton.textContent = 'Показать больше';
            }
        }
        
        showMoreButton.onclick = toggleDescription;
        
        // Проверяем, нужна ли кнопка "Показать больше"
        setTimeout(() => {
            if (descriptionText.scrollHeight <= maxHeight) {
                showMoreButton.style.display = 'none';
            } else {
                showMoreButton.style.display = 'block';
            }
        }, 0);
    }

    function formatBitrate(bitrate) {
        if (!bitrate) return 'Unknown bitrate';
        return `${Math.round(bitrate / 1000)} kbps`;
    }

    // В player.js
    function StartGlowAnimation() {
        const mainPlayer = document.querySelector('.main-player');
        let glowElement = document.querySelector('.video-glow');
        
        if (!glowElement) {
            glowElement = document.createElement('div');
            glowElement.classList.add('video-glow');
            mainPlayer.prepend(glowElement);
        }
    
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
        // Храним предыдущие значения для интерполяции
        const colorHistory = Array(5).fill({ r: 0, g: 0, b: 0, opacity: 0 });
        let prevColors = { r: 0, g: 0, b: 0, opacity: 0 };
        let targetColors = { r: 0, g: 0, b: 0, opacity: 0 };
        let isAnimating = false;
        
        function bezierEasing(t) {
            return t * t * (3 - 2 * t); // Более плавная кривая
        }
    
        // Функция плавной интерполяции
        function smoothLerp(start, end, factor) {
            const t = bezierEasing(factor);
            return start + (end - start) * t;
        }
    
        // Функция для вычисления среднего значения из истории
        function getAverageFromHistory() {
            const sum = colorHistory.reduce((acc, color) => ({
                r: acc.r + color.r,
                g: acc.g + color.g,
                b: acc.b + color.b,
                opacity: acc.opacity + color.opacity
            }), { r: 0, g: 0, b: 0, opacity: 0 });
    
            return {
                r: sum.r / colorHistory.length,
                g: sum.g / colorHistory.length,
                b: sum.b / colorHistory.length,
                opacity: sum.opacity / colorHistory.length
            };
        }

        function analyzeVideo() {
            const video = window.globalPlayer.media;
        
            if (!video || video.readyState < 3) {
                return;
            }
        
            try {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
                // Увеличим область захвата цвета
                const edgeWidth = Math.floor(canvas.width * 0.2); // Увеличили с 0.1 до 0.2
                const edgeHeight = Math.floor(canvas.height * 0.2);
        
                // Берем больше данных с краев и центра
                const centerX = Math.floor(canvas.width / 2 - edgeWidth / 2);
                const centerY = Math.floor(canvas.height / 2 - edgeHeight / 2);
        
                const topData = ctx.getImageData(0, 0, canvas.width, edgeHeight).data;
                const bottomData = ctx.getImageData(0, canvas.height - edgeHeight, canvas.width, edgeHeight).data;
                const leftData = ctx.getImageData(0, 0, edgeWidth, canvas.height).data;
                const rightData = ctx.getImageData(canvas.width - edgeWidth, 0, edgeWidth, canvas.height).data;
                const centerData = ctx.getImageData(centerX, centerY, edgeWidth, edgeHeight).data;
        
                const allData = [...topData, ...bottomData, ...leftData, ...rightData, ...centerData];
        
                let r = 0, g = 0, b = 0, samples = 0;
                let maxBrightness = 0;
        
                // Анализируем каждый восьмой пиксель для оптимизации
                for (let i = 0; i < allData.length; i += 8) {
                    const pixelR = allData[i];
                    const pixelG = allData[i + 1];
                    const pixelB = allData[i + 2];
                    
                    // Усиливаем яркие цвета
                    const pixelBrightness = (pixelR + pixelG + pixelB) / 3;
                    maxBrightness = Math.max(maxBrightness, pixelBrightness);
        
                    r += pixelR;
                    g += pixelG;
                    b += pixelB;
                    samples++;
                }
        
                r = Math.round(r / samples);
                g = Math.round(g / samples);
                b = Math.round(b / samples);
        
                // Усиливаем цвета
                const colorEnhanceFactor = 1.5; // Фактор усиления цвета
                r = Math.min(255, Math.round(r * colorEnhanceFactor));
                g = Math.min(255, Math.round(g * colorEnhanceFactor));
                b = Math.min(255, Math.round(b * colorEnhanceFactor));

                // Рассчитываем яркость и непрозрачность
                const brightness = maxBrightness / 255;
                const opacity = Math.min(Math.max(brightness * 0.8, 0.2), 0.7); // Минимальная прозрачность 0.2, максимальная 0.7
        
                const newColors = { r, g, b, opacity };
        
                colorHistory.shift();
                colorHistory.push(newColors);

                // Обновляем целевые значения
                const averageColors = getAverageFromHistory();
                targetColors = averageColors;
        
                if (!isAnimating) {
                    isAnimating = true;
                    animateGlow();
                }
            } catch (error) {
                console.error('Error in video analysis:', error);
            }
        }
        
        function animateGlow() {
            // Используем очень маленький шаг для максимальной плавности
            const factor = 0.03;
    
            // Применяем сглаженную интерполяцию
            prevColors.r = smoothLerp(prevColors.r, targetColors.r, factor);
            prevColors.g = smoothLerp(prevColors.g, targetColors.g, factor);
            prevColors.b = smoothLerp(prevColors.b, targetColors.b, factor);
            prevColors.opacity = smoothLerp(prevColors.opacity, targetColors.opacity, factor);
    
            // Создаем градиент с промежуточными точками для большей плавности
            glowElement.style.background = `
                linear-gradient(
                    rgba(${Math.round(prevColors.r)},${Math.round(prevColors.g)},${Math.round(prevColors.b)},${prevColors.opacity}) 0%,
                    rgba(${Math.round(prevColors.r)},${Math.round(prevColors.g)},${Math.round(prevColors.b)},${prevColors.opacity * 0.8}) 40%,
                    rgba(${Math.round(prevColors.r)},${Math.round(prevColors.g)},${Math.round(prevColors.b)},${prevColors.opacity * 0.5}) 70%,
                    rgba(${Math.round(prevColors.r)},${Math.round(prevColors.g)},${Math.round(prevColors.b)},0) 100%
                )
            `;
    
            // Проверяем разницу с большей точностью
            const isDifferenceSignificant = 
                Math.abs(prevColors.r - targetColors.r) > 0.05 ||
                Math.abs(prevColors.g - targetColors.g) > 0.05 ||
                Math.abs(prevColors.b - targetColors.b) > 0.05 ||
                Math.abs(prevColors.opacity - targetColors.opacity) > 0.0005;
    
            if (isDifferenceSignificant) {
                requestAnimationFrame(animateGlow);
            } else {
                isAnimating = false;
            }
        }
    
        // Стили для glow эффекта
        const style = document.createElement('style');
        style.textContent = `
            .video-glow {
                position: absolute;
                margin: 20px 20px 20px 6%;
                width: 60vw;
                aspect-ratio: 16/9;
                pointer-events: none;
                z-index: -1;
                filter: blur(70px);
                transition: background 0.3s ease-out;
                transform: scale(1.1) translateY(10%);
            }

            @media (max-width: 1200px) {
                .video-glow {
                    width: calc(100vw - 40px);
                    margin: 20px 20px 20px 10px;
                    transform: scale(1.1) translateY(10%);
                }
            }
        `;
        document.head.appendChild(style);

        function throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
        
        // Создаем throttled версию analyzeVideo
        const throttledAnalyze = throttle(analyzeVideo, 1000);
        
        // Используем requestAnimationFrame более эффективно
        let animationFrameId = null;
let isMinimized = false;

function startAnalysis() {
    // Проверяем все условия перед запуском
    if (animationFrameId || isMinimized) {
        return;
    }

    function analyze() {
        throttledAnalyze();
        animationFrameId = requestAnimationFrame(analyze);
    }

    animationFrameId = requestAnimationFrame(analyze);
}

function stopAnalysis() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Обработчики событий плеера
window.globalPlayer.on('pause ended', stopAnalysis);
window.globalPlayer.on('play', () => {
    if (!isMinimized) {
        startAnalysis();
    }
});

window.customEvents.on('minimizedChanged', (value) => {
    isMinimized = value;
    if (value === true) {
        stopAnalysis();
    } else if (value === false && !window.globalPlayer.paused) {
        // Используем !paused вместо isVideoPlaying
        startAnalysis();
    }
});

// Запускаем анализ только если видео играет и не минимизировано
if (!window.globalPlayer.paused && !isMinimized) {
    startAnalysis();
}

        
        // Функция очистки
        return () => {
            stopAnalysis();
            if (glowElement) {
                glowElement.remove();
            }
        };
    }
    // Инициализация плеера при загрузке страницы
    initPlayer();
    return { cleanup };
})();