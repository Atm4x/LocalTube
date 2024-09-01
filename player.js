const { ipcRenderer } = require('electron');
const Plyr = require('plyr');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfprobePath(ffprobe.path);

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
        await generateThumbnails(filePath);

        player.source = {
            type: 'video',
            sources: [{ src: filePath, type: 'video/mp4' }],
            previewThumbnails: {
                enabled: true,
                src: './thumbnails/output.vtt'
            },
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

            videoTitle.textContent = path.basename(filePath) || 'Unknown title';
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

async function generateThumbnails(videoPath) {
    const thumbnailPrefix = 'thumbs';
    const interval = 8; // Interval between thumbnails in seconds
    const col = 5; // Number of thumbnails per row in the sprite
    const row = 5; // Number of thumbnails per column in the sprite
    const outputDir = path.join(__dirname, 'thumbnails');

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video metadata including resolution
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
        });
    });

    const duration = Math.floor(metadata.format.duration); // Total duration of the video in seconds
    const videoWidth = metadata.streams[0].width; // Video width
    const videoHeight = metadata.streams[0].height; // Video height
    const aspectRatio = videoWidth / videoHeight; // Calculate aspect ratio

    console.log(`Video Resolution: ${videoWidth}x${videoHeight}`);
    console.log(`Aspect Ratio: ${aspectRatio}`);

    // Assume fixed height (e.g., 90px) and calculate width based on aspect ratio
    const height = 100;
    const width = Math.floor(height * aspectRatio);

    console.log(`Thumbnail Resolution: ${width}x${height}`);

    const totalImages = Math.floor(duration / interval); // Total number of thumbnails
    const totalSprites = Math.ceil(totalImages / (row * col));

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
            const layout = generateLayout(col, row, width, height);

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
    
    function generateLayout(col, row, width, height) {
        let layout = [];
        for (let i = 0; i < row; i++) {
            for (let j = 0; j < col; j++) {
                layout.push(`${j * width}_${i * height}`);
            }
        }
        return layout.join('|');
    }
}
