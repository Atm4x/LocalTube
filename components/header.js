
const settingsButton = document.getElementById('settings-button');
const logoButton = document.getElementById('logo');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search');
const downloadButton = document.getElementById('download-button');

const downloadModal = document.getElementById('download-modal');
const closeBtn = document.querySelector('.close');
const videoUrlInput = document.getElementById('video-url');
const qualitySelect = document.getElementById('quality-select');
const qualitySection = document.getElementById('quality-section');
const checkUrlBtn = document.getElementById('check-url');
const startDownloadBtn = document.getElementById('start-download');
const downloadStatus = document.getElementById('download-status');


let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;

function dragStart(e) {
    if (!e.target.classList.contains('player-wrapper')) return;
    
    const container = document.getElementById('unified-player');
    initialX = e.clientX - container.offsetLeft;
    initialY = e.clientY - container.offsetTop;
    isDragging = true;
}
function drag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    const container = document.getElementById('unified-player');
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    // Ограничиваем перемещение
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;
    currentX = Math.max(0, Math.min(currentX, maxX));
    currentY = Math.max(0, Math.min(currentY, maxY));

    container.style.left = currentX + "px";
    container.style.top = currentY + "px";
}

function dragEnd() {
    isDragging = false;
}

function setupMinimizedPlayer() {
    const unifiedPlayer = document.getElementById('unified-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const expandBtn = document.getElementById('expand-btn');
    const closeBtn = document.getElementById('close-btn');

    if (!window.currentVideo) return;

    // Настройка плеера для минимизированного режима
    unifiedPlayer.classList.remove('maximized');
    unifiedPlayer.classList.add('minimized', 'visible');

    // Восстанавливаем состояние воспроизведения
    if (window.isVideoPlaying) {
        window.globalPlayer.play();
    }

    // Обработчики для кнопок
    playPauseBtn.onclick = () => {
        if (window.globalPlayer.paused) {
            window.globalPlayer.play();
        } else {
            window.globalPlayer.pause();
        }
    };

    expandBtn.onclick = () => {
        window.appFunctions.loadPage('player');
    };

    closeBtn.onclick = () => {
        unifiedPlayer.classList.remove('visible');
        window.globalPlayer.pause();
    };

    // Drag and drop functionality
    unifiedPlayer.onmousedown = dragStart;
    document.onmousemove = drag;
    document.onmouseup = dragEnd;
}


function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('dark-theme', document.body.classList.contains('dark-theme'));
}

if (localStorage.getItem('dark-theme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', toggleTheme);


let activeDownloads = new Map();

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    if (!tabButtons.length) return; // Exit if elements aren't found

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            const tabContent = document.getElementById(`${tabId}-tab`);
            
            // Only proceed if we found the tab content
            if (!tabContent) {
                console.error(`Tab content not found for id: ${tabId}-tab`);
                return;
            }
            
            // Remove active class from all tabs and contents
            document.querySelectorAll('.tab-button').forEach(btn => 
                btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => 
                content.classList.remove('active'));
            
            // Add active class to selected tab and content
            button.classList.add('active');
            tabContent.classList.add('active');
        });
    });
}

document.addEventListener('DOMContentLoaded', initializeTabs);

async function initializeDownloads() {
    try {
        const downloads = await ipcRenderer.invoke('get-active-downloads');
        activeDownloads = new Map(downloads.map(d => [d.id, d]));
        updateActiveDownloadsList();
    } catch (error) {
        console.error('Failed to initialize downloads:', error);
    }
}


document.addEventListener('DOMContentLoaded', initializeDownloads);


ipcRenderer.on('download-update', (event, downloads) => {
    activeDownloads = new Map(downloads.map(d => [d.id, d]));
    updateActiveDownloadsList();
});

ipcRenderer.on('download-finished', (event, downloadId) => {
    const download = activeDownloads.get(downloadId);
    if (download) {
        showFinishedNotification(download);
        activeDownloads.delete(downloadId);
        updateActiveDownloadsList();
    }
});

function showFinishedNotification(download) {
    const status = document.getElementById('download-status');
    status.textContent = `Download completed: ${download.url}`;
    status.className = 'status-success';
}

function updateActiveDownloads() {
    ipcRenderer.invoke('get-active-downloads')
        .then(downloads => {
            activeDownloads = new Map(downloads);
            updateActiveDownloadsList();
        })
        .catch(error => {
            console.error('Failed to update active downloads:', error);
        });
}

function updateActiveDownloadsList() {
    const container = document.getElementById('active-downloads-list');
    container.innerHTML = '';
    
    activeDownloads.forEach((download, id) => {
        const item = createDownloadItemElement(download);
        container.appendChild(item);
    });
}


settingsButton.addEventListener('click', () => {
    ipcRenderer.send('open-settings');
});

logoButton.addEventListener('click', () => {
    if (window.currentVideo) {
        setupMinimizedPlayer();
    }
    ipcRenderer.send('index-videos');
});

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredVideos = allVideos.filter(video => 
        path.basename(video).toLowerCase().includes(searchTerm)
    );
    displayVideos(filteredVideos);
});

downloadButton.addEventListener('click', () => {
    downloadModal.style.display = 'block';
    videoUrlInput.focus();
    initializeTabs(); 
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
// Проверка информации о видео
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

// Начало загрузки видео
startDownloadBtn.addEventListener('click', async () => {
    const url = videoUrlInput.value.trim();
    const selectedQuality = qualitySelect.value;
    
    try {
        // Блокируем кнопку и показываем статус
        startDownloadBtn.disabled = true;
        const status = document.getElementById('download-status');
        status.textContent = 'Starting download...';
        status.className = 'status-info';
        
        const result = await ipcRenderer.invoke('download-video', {
            videoUrl: url,
            videoFormat: selectedQuality,
            audioFormat: 'bestaudio'
        });
        
        // Обновляем UI после успешной загрузки
        status.textContent = 'Download completed!';
        status.className = 'status-success';
        
        // Переключаемся на вкладку активных загрузок
        document.querySelector('[data-tab="active"]').click();
        
    } catch (error) {
        const status = document.getElementById('download-status');
        status.textContent = `Error: ${error.message}`;
        status.className = 'status-error';
    } finally {
        startDownloadBtn.disabled = false;
    }
});

function showStatus(message, type) {
    downloadStatus.innerHTML = type === 'info' 
        ? `<div class="loading-spinner"></div>${message}`
        : message;
    downloadStatus.className = `status-${type}`;
}


document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        // Переключаем активную вкладку
        document.querySelectorAll('.tab-button').forEach(btn => 
            btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => 
            content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

function addDownloadItem(videoInfo) {
    const downloadId = Date.now().toString();
    const downloadItem = createDownloadItemElement(downloadId, videoInfo);
    
    document.getElementById('active-downloads-list').appendChild(downloadItem);
    activeDownloads.set(downloadId, {
        status: 'pending',
        info: videoInfo
    });
    
    return downloadId;
}

function updateDownloadStatus(downloadId, status, progress) {
    const downloadItem = document.querySelector(`[data-download-id="${downloadId}"]`);
    if (downloadItem) {
        downloadItem.className = `download-item status-${status}`;
        const statusText = downloadItem.querySelector('.download-status');
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        if (status === 'finished') {
            setTimeout(() => {
                downloadItem.remove();
                activeDownloads.delete(downloadId);
            }, 3000);
        }
    }
}

function createDownloadItemElement(download) {
    const div = document.createElement('div');
    div.className = `download-item status-${download.status}`;
    div.dataset.downloadId = download.id;
    
    div.innerHTML = `
        <div class="download-item-header">
            <div class="download-title">${download.url}</div>
            <div class="download-status">${download.status}</div>
        </div>
        <div class="download-progress-container">
            <div class="download-progress-bar"></div>
        </div>
    `;
    
    return div;
}