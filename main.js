const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { indexVideos, addActiveDownload, removeActiveDownload } = require('./videoIndexer');
const path = require('path');
const fs = require('fs');

const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');
const VideoDownloader = require('./downloader');
const downloader = new VideoDownloader();

const activeDownloads = new Map();

let mainWindow;
let indexedFolders = [];

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile('app.html');
    //mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Load settings from settings.json
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
        indexedFolders = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Навигация между страницами
ipcMain.on('navigate', (event, pageName) => {
    mainWindow.webContents.send('navigate', pageName);
});

ipcMain.on('get-folders', (event) => {
    event.reply('load-folders', indexedFolders);
});

ipcMain.on('add-folder', (event) => {
    dialog.showOpenDialog({
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled) {
            const newFolder = result.filePaths[0];
            if (!indexedFolders.includes(newFolder)) {
                indexedFolders.push(newFolder);
                saveSettings();
                event.reply('load-folders', indexedFolders);
            }
        }
    });
});

ipcMain.on('remove-folder', (event, folder) => {
    indexedFolders = indexedFolders.filter(f => f !== folder);
    saveSettings();
    event.reply('load-folders', indexedFolders);
});

ipcMain.on('index-videos', (event) => {
    const downloadPath = path.join(process.cwd(), 'downloads');
    const videos = indexVideos([downloadPath]);
    
    const filteredVideos = videos.filter(video => 
        !Array.from(activeDownloads.values()).some(download => 
            download.path === video
        )
    );
    
    event.reply('video-list', filteredVideos);
});

ipcMain.on('open-video', (event, videoPath) => {
    if (fs.existsSync(videoPath)) {
        mainWindow.webContents.send('navigate', 'player');
        // Используем setTimeout, чтобы дать время на загрузку страницы плеера
        setTimeout(() => {
            mainWindow.webContents.send('load-video', videoPath);
        }, 100);
    } else {
        mainWindow.webContents.send('video-not-found', videoPath);
    }
});

ipcMain.handle('get-video-info', async (event, videoUrl) => {
    try {
        return await downloader.getVideoInfo(videoUrl);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('download-video', async (event, { videoUrl, videoFormat, audioFormat }) => {
    try {
        const downloadId = Date.now().toString();
        const tempPath = path.join(app.getPath('temp'), `${downloadId}.mp4`);
        
        // Добавляем загрузку в активные
        activeDownloads.set(downloadId, {
            id: downloadId,
            url: videoUrl,
            status: 'pending',
            progress: 0,
            tempPath
        });
        
        // Сообщаем всем окнам об обновлении списка загрузок
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('download-update', Array.from(activeDownloads.values()));
        });

        // Начинаем загрузку
        activeDownloads.get(downloadId).status = 'downloading';
        updateDownloadStatus(downloadId);
        
        const result = await downloader.downloadVideo(videoUrl, videoFormat, audioFormat);
        
        // Обновляем статус на добавление метаданных
        activeDownloads.get(downloadId).status = 'meta';
        updateDownloadStatus(downloadId);
        
        // После успешной загрузки
        activeDownloads.delete(downloadId);
        updateDownloadStatus(downloadId, true);
        
        return result;
    } catch (error) {
        throw error;
    }
});


function updateDownloadStatus(downloadId, finished = false) {
    BrowserWindow.getAllWindows().forEach(win => {
        if (finished) {
            win.webContents.send('download-finished', downloadId);
        } else {
            win.webContents.send('download-update', Array.from(activeDownloads.values()));
        }
    });
}

ipcMain.handle('get-active-downloads', () => {
    return Array.from(activeDownloads.values());
  });

function saveSettings() {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(indexedFolders, null, 2));
}

const thumbsDir = path.join(app.getPath('userData'), 'thumbnails');
if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir);
}

ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
});

// Кеш превью
const thumbnailCache = new Map();

ipcMain.handle('get-video-thumbnail', async (event, videoPath) => {
    const videoHash = crypto.createHash('md5').update(videoPath).digest('hex');
    const thumbnailPath = path.join(thumbsDir, `${videoHash}.jpg`);

    // Проверяем кеш
    if (thumbnailCache.has(videoPath)) {
        return thumbnailCache.get(videoPath);
    }

    // Проверяем существование файла превью
    if (fs.existsSync(thumbnailPath)) {
        thumbnailCache.set(videoPath, thumbnailPath);
        return thumbnailPath;
    }

    // Создаем превью через ffmpeg
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .on('end', () => {
                thumbnailCache.set(videoPath, thumbnailPath);
                resolve(thumbnailPath);
            })
            .on('error', reject)
            .screenshots({
                timestamps: ['10%'],
                filename: path.basename(thumbnailPath),
                folder: thumbsDir,
                size: '320x180'
            });
    });
});

// Очистка кеша при низкой памяти
app.on('web-contents-created', (event, contents) => {
    contents.on('destroyed', () => {
        thumbnailCache.clear();
    });
});

function checkMemoryUsage() {
    const used = process.memoryUsage();
    if (used.heapUsed > 500 * 1024 * 1024) { // 500MB
        thumbnailCache.clear();
        gc && gc();
    }
}

setInterval(checkMemoryUsage, 30000);