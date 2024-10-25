const { ipcRenderer } = require('electron');
const Plyr = require('plyr');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment');
const fs = require('fs');
const path = require('path');


const videoPlayer = document.getElementById('video-player');
const videoTitle = document.getElementById('video-title');
const videoMeta = document.getElementById('video-meta');
const descriptionText = document.getElementById('description-text');
const showMoreBtn = document.getElementById('show-more');
const backButton = document.getElementById('back-button');
const themeToggle = document.getElementById('theme-toggle');

// Plyr initialization
const player = new Plyr(videoPlayer, {
    controls: [
        'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
    ],
    settings: ['captions', 'quality', 'speed', 'loop'],
    previewThumbnails: {
        enabled: false,
    }
});

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('dark-theme', document.body.classList.contains('dark-theme'));
}

if (localStorage.getItem('dark-theme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', toggleTheme);

backButton.addEventListener('click', () => {
    ipcRenderer.send('back-to-main');
});

ipcRenderer.on('load-video', async (event, filePath) => {
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
});

function loadVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        // Явно указываем путь к ffprobe
        ffmpeg.setFfprobePath(ffprobe.path);
        
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('Error reading metadata:', err);
                reject(err);
                return;
            }

            try {
                const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
                
                // Безопасное получение заголовка
                const title = path.basename(filePath, path.extname(filePath))
                    .replace(/-\d+$/, '') // Удаляем временную метку
                    .replace(/_/g, ' '); // Заменяем подчеркивания на пробелы

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

showMoreBtn.addEventListener('click', () => {
    const isExpanded = descriptionText.style.maxHeight;
    descriptionText.style.maxHeight = isExpanded ? null : `${descriptionText.scrollHeight}px`;
    showMoreBtn.textContent = isExpanded ? 'Show more' : 'Show less';
});
