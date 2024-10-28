

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

window.playerState = {
    left: null,
    top: null,
    width: '320px',  // Дефолтные значения
    height: '180px',
    isMinimized: false,
    initialWidth: null,   
    initialHeight: null,  
    initialX: null,      
    initialY: null,
    element: null  
};

window.playerState = playerState;

let isDragging = false;
let isResizing =  false;
window.isDragging = isDragging;
window.isResizing = isResizing;


document.addEventListener('playerMinimizedChanged', function(e) {
    window.playerState.isMinimized = e.detail.isMinimized;
    if (window.playerState.isMinimized) {
        setupMinimizedPlayer();
    } else {
        resetMaximizedPlayer();
    }
});

function setupMinimizedPlayer() {
    const unifiedPlayer = document.getElementById('unified-player');
    const playerWrapper = unifiedPlayer.querySelector('.player-wrapper');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const expandBtn = document.getElementById('expand-btn');
    const closeBtn = document.getElementById('close-btn');
    const resizeHandle = document.createElement('div');

    if (!window.currentVideo) return;

    window.playerState.isMinimized = true;
    window.playerState.element = document.getElementById('unified-player');

    toggleClickToPlay(false);

    // Если позиция не установлена, используем дефолтные значения
    if (window.playerState.left === null) {
        window.playerState.left = window.innerWidth - parseInt(window.playerState.width) - 20;
        window.playerState.top = window.innerHeight - parseInt(window.playerState.height) - 20;
    }

    // Применяем сохраненное состояние
    unifiedPlayer.style.left = `${window.playerState.left}px`;
    unifiedPlayer.style.top = `${window.playerState.top}px`;
    unifiedPlayer.style.width = window.playerState.width;
    unifiedPlayer.style.height = window.playerState.height;

    unifiedPlayer.classList.remove('maximized');
    unifiedPlayer.classList.add('minimized', 'visible');

    // Добавляем элемент для изменения размера
    resizeHandle.className = 'resize-handle';
    if (!unifiedPlayer.querySelector('.resize-handle')) {
        unifiedPlayer.appendChild(resizeHandle);
    }

    playPauseBtn.onclick = () => {
        if (window.globalPlayer.paused) {
            window.globalPlayer.play();
        } else {
            window.globalPlayer.pause();
        }
    };

    resizeHandle.onmousedown = resizeStart;
    playerWrapper.onmousedown = dragStart;
    document.onmousemove = handleMouseMove;
    document.onmouseup = handleMouseUp;

    // Обновляем обработчики кнопок
    expandBtn.onclick = () => {
        // Сохраняем текущее состояние для возможной последующей минимизации
        resetMaximizedPlayer();
        window.appFunctions.loadPage('player');
    };

    closeBtn.onclick = () => {
        unifiedPlayer.classList.remove('visible');
        window.globalPlayer.pause();
        resetMaximizedPlayer();
    };
}

function resizeStart(e) {
    if (!window.playerState.isMinimized) return;

    const unifiedPlayer = window.playerState.element;

    window.isResizing = true;
    window.playerState.initialWidth = unifiedPlayer.offsetWidth;
    window.playerState.initialHeight = unifiedPlayer.offsetHeight;
    window.playerState.initialX = e.clientX;
    window.playerState.initialY = e.clientY;

    unifiedPlayer.style.transition = 'none';
    e.stopPropagation();
}

// function resizeListener(e) {
//     if (!window.playerState.isMinimized) return;
    
//     if (!isResizing) return;

//     const dx = e.clientX - initialX;
//     const dy = e.clientY - initialY;
    
//     const newWidth = Math.max(200, Math.min(initialWidth + dx, window.innerWidth - playerState.left));
//     const newHeight = Math.max(150, Math.min(initialHeight + dy, window.innerHeight - playerState.top));
    
//     // Сохраняем новый размер
//     playerState.width = `${newWidth}px`;
//     playerState.height = `${newHeight}px`;
    
//     unifiedPlayer.style.width = playerState.width;
//     unifiedPlayer.style.height = playerState.height;
// }

// function resizeEnd() {
//     if (!window.playerState.isMinimized) return;
    
//     isResizing = false;
//     isDragging = false;
//     unifiedPlayer.style.transition = '';
// }

function dragStart(e) {
    if (!window.playerState.isMinimized) return;
    if (e.target.closest('.player-controls') || e.target.closest('.resize-handle')) return;
    
    const unifiedPlayer = window.playerState.element;
    
    isDragging = true;
    const rect = unifiedPlayer.getBoundingClientRect();
    window.playerState.initialX = e.clientX - rect.left;
    window.playerState.initialY = e.clientY - rect.top;
    
    unifiedPlayer.style.transition = 'none';
}

function resetMaximizedPlayer() {
    const unifiedPlayer = document.getElementById('unified-player');;
    const playerWrapper = unifiedPlayer.querySelector('.player-wrapper');

    toggleClickToPlay(true); 
    
    // Remove positioning and size styles
    unifiedPlayer.style.left = '';
    unifiedPlayer.style.top = '';
    unifiedPlayer.style.width = '';
    unifiedPlayer.style.height = '';
    
    // Remove event listeners
    
    playerWrapper.onmousedown = null;
    document.onmousemove = null;
    document.onmouseup = null;
    
    const resizeHandle = unifiedPlayer.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.onmousedown = null;
        resizeHandle.remove();
    }
}

window.resetMaximizedPlayer = resetMaximizedPlayer;

// function drag(e) {
//     if (!isDragging || !window.playerState.isMinimized) return;
    
//     e.preventDefault();
    
//     const x = e.clientX - initialX;
//     const y = e.clientY - initialY;
    
//     const maxX = window.innerWidth - unifiedPlayer.offsetWidth;
//     const maxY = window.innerHeight - unifiedPlayer.offsetHeight;
    
//     const boundedX = Math.max(0, Math.min(x, maxX));
//     const boundedY = Math.max(0, Math.min(y, maxY));
    
//     // Сохраняем новую позицию
//     playerState.left = boundedX;
//     playerState.top = boundedY;
    
//     unifiedPlayer.style.left = `${boundedX}px`;
//     unifiedPlayer.style.top = `${boundedY}px`;
// }

function handleMouseMove(e) {
    const unifiedPlayer = playerState.element;
    
    if (!window.playerState.isMinimized) return;
    if (!isDragging && !window.isResizing) return;
    
    
    if (window.isResizing) {
        // Используем переменные из playerState
        const dx = e.clientX - window.playerState.initialX;
        const dy = e.clientY - window.playerState.initialY;
        
        const newWidth = Math.max(200, Math.min(window.playerState.initialWidth + dx, window.innerWidth - window.playerState.left));
        const newHeight = Math.max(150, Math.min(window.playerState.initialHeight + dy, window.innerHeight - window.playerState.top));
        
        // Сохраняем новый размер
        window.playerState.width = `${newWidth}px`;
        window.playerState.height = `${newHeight}px`;
    
        window.playerState.element.style.width = playerState.width;
        window.playerState.element.style.height = playerState.height;
    } else if (isDragging) {
        // Drag logic
        const x = e.clientX - window.playerState.initialX;
        const y = e.clientY - window.playerState.initialY;
        
        const maxX = window.innerWidth - unifiedPlayer.offsetWidth;
        const maxY = window.innerHeight - unifiedPlayer.offsetHeight;
        
        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(0, Math.min(y, maxY));
        
        window.playerState.left = boundedX;
        window.playerState.top = boundedY;
        
        unifiedPlayer.style.left = `${boundedX}px`;
        unifiedPlayer.style.top = `${boundedY}px`;
    }
}

// function dragEnd() {
//     if (!isDragging || !playerState.isMinimized) return;
//     isDragging = false;
//     unifiedPlayer.style.transition = ''; // Восстанавливаем transition
// }

function handleMouseUp() {
    if (!window.playerState.isMinimized) return;
    
    isDragging = false;
    window.isResizing = false;
    
    const unifiedPlayer = document.getElementById('unified-player');
    unifiedPlayer.style.transition = '';
}


function toggleClickToPlay(enable) {
    if (!window.globalPlayer) {
        console.log('Player not initialized');
        return;
    }

    const videoElement = window.globalPlayer.elements.container;
    if (enable) {
        videoElement.style.pointerEvents = 'auto';
    } else {
        videoElement.style.pointerEvents = 'none';
    }

    window.globalPlayer.config.clickToPlay = enable;
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