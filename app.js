const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const Plyr = require('plyr');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');
const moment = require('moment');
let dragPlayer, dragPlayerEnd, toggleClickToPlayState
const RecommendationSystem = require('./recommendation');
const recommendationSystem  = new RecommendationSystem();

const VideoPlayerManager = require('./components/video-player-manager');
window.videoPlayerManager = new VideoPlayerManager();

const loadedScripts = {};
window.currentVideo = null;

// И добавьте функцию для установки текущего видео:
function setCurrentVideo(videoPath) {
    window.currentVideo = videoPath;
}

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

// Инициализация приложения
// app.js - в функции initApp
async function initApp() {
    // Загрузка компонентов
    await loadComponent("header-component", "./components/header.html");

    // Загрузка начальной страницы
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