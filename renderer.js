const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');


const ffmpeg = require('fluent-ffmpeg');

const videoGrid = document.getElementById('video-grid');
const settingsButton = document.getElementById('settings-button');
const indexButton = document.getElementById('index-button');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search');


const downloadModal = document.getElementById('download-modal');
const closeBtn = document.querySelector('.close');
const videoUrlInput = document.getElementById('video-url');
const qualitySelect = document.getElementById('quality-select');
const qualitySection = document.getElementById('quality-section');
const checkUrlBtn = document.getElementById('check-url');
const startDownloadBtn = document.getElementById('start-download');
const downloadStatus = document.getElementById('download-status');
const downloadButton = document.getElementById('download-button');

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('dark-theme', document.body.classList.contains('dark-theme'));
}

if (localStorage.getItem('dark-theme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', toggleTheme);

settingsButton.addEventListener('click', () => {
    ipcRenderer.send('open-settings');
});

indexButton.addEventListener('click', () => {
    ipcRenderer.send('index-videos');
});

let allVideos = [];
const downloadPath = path.join(process.cwd(), 'downloads');

ipcRenderer.on('video-list', (event, videos) => {
    allVideos = videos.filter(video => fs.existsSync(video));
    displayVideos(allVideos);
});

function displayVideos(videos) {
    videoGrid.innerHTML = '';
    if (videos.length === 0) {
        videoGrid.innerHTML = '<p>No videos found in the downloads folder.</p>';
        return;
    }
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'grid-wrapper';
    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';

        const videoElement = document.createElement('video');
        videoElement.src = `file://${video}`;
        videoElement.preload = 'metadata';
        videoElement.className = 'video-thumbnail';

        // Set poster image to middle of video
        videoElement.addEventListener('loadedmetadata', () => {
            videoElement.currentTime = videoElement.duration / 3;
        });

        videoElement.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            canvas.getContext('2d').drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            videoElement.poster = canvas.toDataURL();
        });

        const videoInfo = document.createElement('div');
        videoInfo.className = 'video-card-info';
        videoInfo.innerHTML = `
            <div class="video-card-title">${path.basename(video)}</div>
            <div class="video-card-meta">${path.dirname(video)}</div>
        `;

        videoCard.appendChild(videoElement);
        videoCard.appendChild(videoInfo);

        videoCard.addEventListener('click', () => {
            ipcRenderer.send('open-video', video);
        });
        gridWrapper.appendChild(videoCard);
    });
    videoGrid.appendChild(gridWrapper);
}

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredVideos = allVideos.filter(video => 
        path.basename(video).toLowerCase().includes(searchTerm)
    );
    displayVideos(filteredVideos);
});


downloadButton.addEventListener('click', async () => {
    const url = prompt('Enter YouTube URL:');
    if (!url) return;

    try {
        const videoInfo = await ipcRenderer.invoke('get-video-info', url);
        
        // Create quality selection dialog
        const qualities = videoInfo.qualities.video;
        const qualityOptions = Object.entries(qualities)
            .map(([id, info]) => ({
                id,
                label: `${info.height}p${info.fps > 30 ? info.fps : ''} ${info.dynamic_range}`
            }))
            .sort((a, b) => parseInt(b.label) - parseInt(a.label));

        const quality = prompt(
            `Select quality:\n${qualityOptions.map((q, i) => `${i + 1}: ${q.label}`).join('\n')}`,
            '1'
        );

        if (!quality) return;

        const selectedQuality = qualityOptions[parseInt(quality) - 1];
        if (!selectedQuality) return;

        // Start download
        const result = await ipcRenderer.invoke('download-video', {
            videoUrl: url,
            videoFormat: selectedQuality.id,
            audioFormat: 'bestaudio'
        });

        alert(`Download completed!\nSaved to: ${result.path}`);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// Запрос списка видео при загрузке страницы
ipcRenderer.send('index-videos');


function updateVideoList() {
    ipcRenderer.send('index-videos');
}


downloadButton.addEventListener('click', () => {
    downloadModal.style.display = 'block';
    videoUrlInput.focus();
});

closeBtn.addEventListener('click', () => {
    downloadModal.style.display = 'none';
    resetModal();
});

window.addEventListener('click', (event) => {
    if (event.target === downloadModal) {
        downloadModal.style.display = 'none';
        resetModal();
    }
});

function resetModal() {
    videoUrlInput.value = '';
    qualitySection.style.display = 'none';
    startDownloadBtn.style.display = 'none';
    checkUrlBtn.style.display = 'block';
    downloadStatus.innerHTML = '';
    downloadStatus.className = '';
}

checkUrlBtn.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
        showStatus('Please enter a valid YouTube URL', 'error');
        return;
    }

    try {
        showStatus('Checking video information...', 'info');
        checkUrlBtn.disabled = true;
        
        const videoInfo = await ipcRenderer.invoke('get-video-info', url);
        
        // Populate quality select
        qualitySelect.innerHTML = '';
        const qualities = videoInfo.qualities.video;
        Object.entries(qualities)
            .map(([id, info]) => ({
                id,
                label: `${info.height}p${info.fps > 30 ? info.fps : ''} ${info.dynamic_range}`,
                height: info.height
            }))
            .sort((a, b) => b.height - a.height)
            .forEach(quality => {
                const option = document.createElement('option');
                option.value = quality.id;
                option.textContent = quality.label;
                qualitySelect.appendChild(option);
            });

        qualitySection.style.display = 'block';
        startDownloadBtn.style.display = 'block';
        checkUrlBtn.style.display = 'none';
        showStatus('Select video quality and click Download', 'success');
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        checkUrlBtn.disabled = false;
    }
});

startDownloadBtn.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    const selectedQuality = qualitySelect.value;

    try {
        showStatus('Downloading video...', 'info');
        startDownloadBtn.disabled = true;
        
        const result = await ipcRenderer.invoke('download-video', {
            videoUrl: url,
            videoFormat: selectedQuality,
            audioFormat: 'bestaudio'
        });

        showStatus('Download completed!', 'success');
        
        updateVideoList();
        
        // Close modal and open player
        setTimeout(() => {
            downloadModal.style.display = 'none';
            resetModal();
            ipcRenderer.send('open-video', result.path);
        }, 1500);
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        startDownloadBtn.disabled = false;
    }
});

function showStatus(message, type) {
    downloadStatus.innerHTML = type === 'info' 
        ? `<div class="loading-spinner"></div>${message}`
        : message;
    downloadStatus.className = `status-${type}`;
}