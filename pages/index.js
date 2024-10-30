
(function() {
    console.log("Index page loaded");

    if (ipcRenderer) {
        ipcRenderer.removeAllListeners('video-list');
        ipcRenderer.removeAllListeners('video-download-complete');
    };

    let videoGrid;
    let allVideos = [];
    function initIndex() {

        videoGrid = document.getElementById('video-grid');
        if (!videoGrid) {
            console.error('Video grid element not found');
            return;
        }

        ipcRenderer.send('index-videos');
    }

    function displayVideos(videos) {
        if (!videoGrid) return;

        videoGrid.innerHTML = '';
        if (videos.length === 0) {
            videoGrid.innerHTML = '<p>No videos found in the downloads folder.</p>';
            return;
        }
        
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid-wrapper';
        
        videos.forEach(videoPath => {
            if (!fs.existsSync(videoPath)) {
                return; // Пропускаем несуществующие файлы
            }

            const videoCard = createVideoCard(videoPath);
            gridWrapper.appendChild(videoCard);
        });
        
        videoGrid.appendChild(gridWrapper);
    }

    function createVideoCard(videoPath) {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
    
        // Создаем контейнер для превью
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'video-thumbnail-container';
    
        // Загружаем превью через main process
        ipcRenderer.invoke('get-video-thumbnail', videoPath).then(thumbnailPath => {
            const img = document.createElement('img');
            img.src = thumbnailPath;
            img.className = 'video-thumbnail';
            thumbnailContainer.appendChild(img);
        });
    
        const videoInfo = document.createElement('div');
        videoInfo.className = 'video-card-info';
        
        const title = path.basename(videoPath, path.extname(videoPath))
            .replace(/-\d+$/, '')
            .replace(/_/g, ' ');
            
        videoInfo.innerHTML = `<div class="video-card-title">${title}</div>`;
    
        videoCard.appendChild(thumbnailContainer);
        videoCard.appendChild(videoInfo);
    
        videoCard.addEventListener('click', (e) => {
            e.preventDefault();
            if (fs.existsSync(videoPath)) {
                window.resetMaximizedPlayer();
                window.appFunctions.setCurrentVideo(videoPath);
                window.appFunctions.loadPage('player');
            } else {
                alert('Video file not found');
                updateVideoList();
            }
        });
    
        return videoCard;
    }

    function updateVideoList() {
        ipcRenderer.send('index-videos');
    }

    // Обработчики событий
    ipcRenderer.on('video-list', (event, videos) => {
        allVideos = videos.filter(video => fs.existsSync(video));
        displayVideos(allVideos);
    });

    ipcRenderer.on('video-download-complete', (event, videoPath) => {
        if (fs.existsSync(videoPath)) {
            setTimeout(updateVideoList, 1000);
        }
    });

    // Инициализация страницы
    initIndex();

    // Экспорт функций, которые могут понадобиться извне
    window.indexFunctions = {
        updateVideoList,
        displayVideos
    };
})();