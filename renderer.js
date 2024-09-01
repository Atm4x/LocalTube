const { ipcRenderer } = require('electron');
const path = require('path');

const videoGrid = document.getElementById('video-grid');
const settingsButton = document.getElementById('settings-button');
const indexButton = document.getElementById('index-button');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search');

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

ipcRenderer.on('video-list', (event, videos) => {
    allVideos = videos;
    displayVideos(videos);
});

function displayVideos(videos) {
    videoGrid.innerHTML = '';
    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="https://via.placeholder.com/240x135" alt="${path.basename(video)}">
            <div class="video-card-info">
                <div class="video-card-title">${path.basename(video)}</div>
                <div class="video-card-meta">${path.dirname(video)}</div>
            </div>
        `;
        videoCard.addEventListener('click', () => {
            ipcRenderer.send('open-video', video);
        });
        videoGrid.appendChild(videoCard);
    });
}

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredVideos = allVideos.filter(video => 
        path.basename(video).toLowerCase().includes(searchTerm)
    );
    displayVideos(filteredVideos);
});

// Запрос списка видео при загрузке страницы
ipcRenderer.send('index-videos');
