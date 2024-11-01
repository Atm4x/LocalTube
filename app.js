const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const Plyr = require('plyr');

const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment');
let dragPlayer, dragPlayerEnd, toggleClickToPlayState
const RecommendationSystem = require('./recommendation');
const recommendationSystem  = new RecommendationSystem();

// const VideoPlayerManager = require('./components/video-player-manager');
// window.videoPlayerManager = new VideoPlayerManager();
const isDevelopment = process.env.NODE_ENV === "development";

let ffprobe;

if (isDevelopment) {
    ffprobe = require('ffprobe-static');
    console.log('DEV');
} else {
    if (process.platform === 'win32') {
        ffmpeg.setFfmpegPath(path.join(process.resourcesPath, 'ffmpeg.exe'));
        ffmpeg.setFfprobePath(path.join(process.resourcesPath, 'ffprobe.exe'));
    } else {
        ffmpeg.setFfmpegPath(path.join(process.resourcesPath, 'ffmpeg'));
        ffmpeg.setFfprobePath(path.join(process.resourcesPath, 'ffprobe'));
    }
    console.log('PROD');
}


const loadedScripts = {};
window.currentVideo = null;

// И добавьте функцию для установки текущего видео:
function setCurrentVideo(videoPath) {
    window.currentVideo = videoPath;
}


window.customEvents = new EventTarget();
window.customEvents.on = function(eventName, handler) {
    this.addEventListener(eventName, (event) => handler(event.detail));
  };

// Экспортируйте эту функцию:
window.appFunctions = {
    setCurrentVideo,
    loadPage
};

// Функция для загрузки HTML компонентов
async function loadComponent(id, componentPath) {
    try {
        const response = await fetch(componentPath);
        if (!response.ok) throw new Error(`Failed to fetch component at ${componentPath}`);
        const html = await response.text();
        document.getElementById(id).innerHTML = html;
    } catch (error) {
        console.error("Error loading component:", error);
    }
}

async function loadPage(pageName) {
    try {
        // Очищаем предыдущие ресурсы
        cleanupCurrentPage();
        
        const response = await fetch(`./pages/${pageName}.html`);
        if (!response.ok) throw new Error(`Failed to fetch page at ./pages/${pageName}.html`);
        const html = await response.text();
        document.getElementById("page-content").innerHTML = html;

        // Удаляем предыдущий скрипт
        if (loadedScripts[pageName]) {
            document.body.removeChild(loadedScripts[pageName]);
            delete loadedScripts[pageName];
        }

        const script = document.createElement('script');
        script.src = `./pages/${pageName}.js`;
        script.onload = () => {
            loadedScripts[pageName] = script;
        };
        document.body.appendChild(script);
    } catch (error) {
        console.error("Error loading page:", error);
    }
}

function cleanupCurrentPage() {
    // Очищаем все обработчики событий
    const pageContent = document.getElementById("page-content");
    const oldElement = pageContent.cloneNode(false);
    pageContent.parentNode.replaceChild(oldElement, pageContent);
    
    // Очищаем память от неиспользуемых ресурсов
    if (window.gc) window.gc();
}

let startupVideo = false;

async function initApp() {
    // Загрузка компонентов
    await loadComponent("header-component", "./components/header.html");

    // Загрузка начальной страницы
    if(startupVideo === false)
        await loadPage("index");

    if (!loadedScripts['header']) {
        const headerScript = document.createElement('script');
        headerScript.src = './components/header.js';
        headerScript.onload = () => {
            loadedScripts['header'] = headerScript;
        };
        document.body.appendChild(headerScript);
    }

}

ipcRenderer.on('startup-video', (event, videoPath) => {
    if (fs.existsSync(videoPath)) {
        startupVideo = true;
        setCurrentVideo(videoPath);
        loadPage('player');
    }
});

// Запуск инициализации после загрузки DOM
document.addEventListener("DOMContentLoaded", initApp);

// Обработчик для переключения страниц
ipcRenderer.on('navigate', (event, pageName) => {
    loadPage(pageName);
});


ipcRenderer.on('load-video', (event, videoPath) => {
    if (document.getElementById('video-player')) {
        // Если элемент плеера существует, отправляем событие загрузки видео
        document.dispatchEvent(new CustomEvent('video-ready-to-load', { detail: videoPath }));
    } else {
        // Если элемент плеера еще не создан, ждем его создания
        const checkInterval = setInterval(() => {
            if (document.getElementById('video-player')) {
                clearInterval(checkInterval);
                document.dispatchEvent(new CustomEvent('video-ready-to-load', { detail: videoPath }));
            }
        }, 100);
    }
});