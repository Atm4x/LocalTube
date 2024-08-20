const { ipcRenderer } = require('electron');
const Plyr = require('plyr');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment');



const fs = require('fs');
const path = require('path');

ffmpeg.setFfprobePath(ffprobe.path);

const videoPlayer = document.getElementById('video-player');
const selectFileBtn = document.getElementById('select-file');
const videoTitle = document.getElementById('video-title');
const videoMeta = document.getElementById('video-meta');
const descriptionText = document.getElementById('description-text');
const showMoreBtn = document.getElementById('show-more');
const themeToggle = document.getElementById('theme-toggle');

// Plyr initialization
const player = new Plyr(videoPlayer, {
    controls: [
        'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
    ],
    settings: ['captions', 'quality', 'speed', 'loop']
});

selectFileBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog');
});

ipcRenderer.on('selected-file', async (event, filePath) => {
    videoPlayer.src = filePath;
    try {
        await loadVideoMetadata(filePath);
        await generateThumbnails(filePath);

        player.source = {
            type: 'video',
            sources: [{ src: filePath, type: 'video/mp4' }],
            previewThumbnails: { src: './thumbnails/output.vtt' },  // Ensure this path is correct relative to your HTML file
        };
        player.play();
    } catch (error) {
        console.error('Error loading video:', error);
    }
});

function loadVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('Error reading metadata:', err);
                reject(err);
                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            const audioStreams = metadata.streams.filter(stream => stream.codec_type === 'audio');

            videoTitle.textContent = metadata.format.filename || 'Unknown title';
            videoMeta.textContent = `${metadata.format.format_name || 'Unknown format'} • ${formatBitrate(metadata.format.bit_rate)}`;
            descriptionText.textContent = metadata.format.tags ? (metadata.format.tags.comment || 'Description unavailable') : 'Description unavailable';

            // Update audio tracks in Plyr
            player.source = {
                type: 'video',
                sources: [{ src: filePath, type: 'video/mp4' }],
                tracks: audioStreams.map((stream, index) => ({
                    kind: 'captions',
                    label: `Audio ${index + 1}`,
                    srclang: stream.tags ? stream.tags.language : 'Unknown',
                    default: index === 0,
                }))
            };

            resolve();
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

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('dark-theme', document.body.classList.contains('dark-theme'));
}

if (localStorage.getItem('dark-theme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', toggleTheme);

async function generateThumbnails(videoPath) {
    const thumbnailPrefix = 'thumbs';
    const width = 160;
    const height = 90;
    const interval = 8; // Interval between thumbnails in seconds
    const col = 5; // Number of thumbnails per row in the sprite
    const row = 5; // Number of thumbnails per column in the sprite
    const outputDir = path.join(__dirname, 'thumbnails');

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video duration
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
        });
    });

    const duration = Math.floor(metadata.format.duration); // Total duration of the video in seconds
    const totalImages = Math.floor(duration / interval); // Total number of thumbnails
    const totalSprites = Math.ceil(totalImages / (row * col)); // Total number of sprite sheets

    let thumbOutput = 'WEBVTT\n\n';
    let startTime = moment('00:00:00', 'HH:mm:ss.SSS');
    let endTime = moment('00:00:00', 'HH:mm:ss.SSS').add(interval, 'seconds');

    for (let k = 0; k < totalSprites; k++) {
        let inputFiles = [];

        for (let i = 0; i < row; i++) {
            for (let j = 0; j < col; j++) {
                const currentImageCount = k * row * col + i * col + j;
                if (currentImageCount >= totalImages) break;

                const outputPath = path.join(outputDir, `${thumbnailPrefix}_${currentImageCount}.jpg`);
                const time = currentImageCount * interval;

                console.log(`Generating thumbnail: ${outputPath} at time: ${time}s`);

                // Generate the thumbnail
                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .screenshots({
                            count: 1,
                            folder: outputDir,
                            filename: `${thumbnailPrefix}_${currentImageCount}.jpg`,
                            size: `${width}x${height}`,
                            timemarks: [time],
                        })
                        .on('end', resolve)
                        .on('error', reject);
                });

                inputFiles.push(outputPath);

                // Update VTT file
                thumbOutput += `${startTime.format('HH:mm:ss.SSS')} --> ${endTime.format('HH:mm:ss.SSS')}\n`;
                thumbOutput += `${thumbnailPrefix}-${String(k + 1).padStart(2, '0')}.png#xywh=${j * width},${i * height},${width},${height}\n\n`;

                startTime.add(interval, 'seconds');
                endTime.add(interval, 'seconds');
            }
        }

        const spritePath = path.join(outputDir, `${thumbnailPrefix}-${String(k + 1).padStart(2, '0')}.png`);

        // Combine individual thumbnails into a sprite sheet
        await new Promise((resolve, reject) => {
            const command = ffmpeg();

            // Add each thumbnail as a separate input
            inputFiles.forEach(file => {
                command.input(file);
            });

            const inputs = inputFiles.map((_, index) => `[${index}:v]`).join('');
const layout = generateLayout(col, row);

command
    .complexFilter([
        `${inputs}xstack=inputs=${inputFiles.length}:layout=${layout}[out]`
    ])
    .outputOptions(['-frames:v', '1', '-map', '[out]']) // Output a single frame and map the output
    .output(spritePath)
    .on('start', commandLine => console.log(`Started FFmpeg with command: ${commandLine}`))
    .on('end', resolve)
    .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', stderr);
        reject(err);
    })
    .run();
        });

        // Clean up individual thumbnails
        inputFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    }

    // Write the VTT file with references to the sprite sheets
    fs.writeFileSync(path.join(outputDir, 'output.vtt'), thumbOutput);

    console.log('Thumbnail generation and VTT creation complete.');
    function generateLayout(col, row) {
        let layout = [];
        for (let i = 0; i < row; i++) {
            for (let j = 0; j < col; j++) {
                layout.push(`${j * width}_${i * height}`);
            }
        }
        return layout.join('|');
    }
}



// Функция для генерации случайных рекомендаций
function generateRecommendations() {
    const recommendations = [
        { title: "Amazing Nature Documentary", channel: "Nature Channel", views: "1.2M views" },
        { title: "Top 10 Travel Destinations", channel: "Travel Guru", views: "800K views" },
        { title: "Easy Cooking Recipes", channel: "Chef's Kitchen", views: "500K views" },
        { title: "Latest Tech Innovations", channel: "Tech Today", views: "2M views" },
        { title: "Relaxing Music Compilation", channel: "Chill Vibes", views: "3.5M views" },
        { title: "Extreme Sports Highlights", channel: "Adrenaline Junkies", views: "1.5M views" }
    ];

    const recommendedVideosContainer = document.getElementById('recommended-videos');
    recommendedVideosContainer.innerHTML = '';

    recommendations.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="https://via.placeholder.com/160x90" alt="${video.title}">
            <div class="video-card-info">
                <div class="video-card-title">${video.title}</div>
                <div class="video-card-meta">${video.channel} • ${video.views}</div>
            </div>
        `;
        recommendedVideosContainer.appendChild(videoCard);
    });
}

// Генерация рекомендаций при загрузке страницы
generateRecommendations();

// Дополнительные обработчики событий для кнопок лайка, дизлайка и поделиться
document.getElementById('like').addEventListener('click', () => {
    console.log('Liked video');
});

document.getElementById('dislike').addEventListener('click', () => {
    console.log('Disliked video');
});

document.getElementById('share').addEventListener('click', () => {
    console.log('Shared video');
});

// Добавляем обработчик событий для клавиатуры
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'ArrowLeft': // Отмотка назад на 5 секунд
            player.currentTime = Math.max(player.currentTime - 5, 0);
            event.preventDefault();
            break;
        case 'ArrowRight': // Прокрутка вперед на 5 секунд
            player.currentTime = Math.min(player.currentTime + 5, player.duration);
            event.preventDefault();
            break;
        case 'Space': // Пауза/запуск воспроизведения
            if (player.playing) {
                player.pause();
            } else {
                player.play();
            }
            event.preventDefault(); // Предотвращает прокрутку страницы при нажатии пробела
            break;
        case 'ArrowUp': // Увеличение громкости
            player.volume = Math.min(player.volume + 0.1, 1);
            event.preventDefault();
            break;
        case 'ArrowDown': // Уменьшение громкости
            player.volume = Math.max(player.volume - 0.1, 0);
            event.preventDefault();
            break;
        default:
            break;
    }
});