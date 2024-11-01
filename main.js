const { app, BrowserWindow, ipcMain, dialog  } = require('electron');
require('@electron/remote/main').initialize();
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
let startupVideoPath = null;


const isDevelopment = process.env.NODE_ENV === 'development';



const defaultThumbPath =path.join(process.execPath, '..', 'default-thumbnail.jpg');

const thumbsDir = path.join(app.getPath('userData'), 'thumbnails');

if (process.argv.length > 1) {
    // Получаем путь к видео из аргументов
    startupVideoPath = process.argv[1];
    
    // Для разработки в Electron
    if (startupVideoPath.endsWith('electron.exe')) {
        startupVideoPath = process.argv[2];
    }
}
if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir);
    if (fs.existsSync(defaultThumbPath)) {
        fs.copyFileSync(defaultThumbPath, path.join(thumbsDir, 'default-thumbnail.jpg'));
    }
}


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
        },
        icon: isDevelopment ? './assets/icon.ico' : path.join(process.resourcesPath, 'assets/icon.ico')
    });

    require('@electron/remote/main').enable(mainWindow.webContents);
    mainWindow.setMenu(null);
    mainWindow.loadFile('app.html');
    //mainWindow.webContents.openDevTools();
    if(!isDevelopment) {
        mainWindow.webContents.on('did-finish-load', () => {
            if (startupVideoPath && fs.existsSync(startupVideoPath)) {
                mainWindow.webContents.send('startup-video', startupVideoPath);
            }
        });
    }
}   

// В main.js
app.setAsDefaultProtocolClient('localtube');

// Обработка открытия файлов в macOS
app.on('open-file', (event, path) => {
    event.preventDefault();
    if (mainWindow) {
        mainWindow.webContents.send('startup-video', path);
    } else {
        startupVideoPath = path;
    }
});

// Обработка второго экземпляра приложения в Windows
app.on('second-instance', (event, commandLine) => {
    if (commandLine.length >= 2) {
        const videoPath = commandLine[1];
        if (mainWindow) {
            mainWindow.webContents.send('startup-video', videoPath);
            mainWindow.focus();
        }
    }
});



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
    let downloadPath;
    if(isDevelopment) 
        downloadPath = path.join(__dirname, 'downloads');
    else downloadPath = path.join(process.execPath, '..', 'downloads');
    const allFolders = [...indexedFolders];
    
    if (fs.existsSync(downloadPath) && !allFolders.includes(downloadPath)) {
        allFolders.unshift(downloadPath);
    }

    const videos = indexVideos(allFolders);
    
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
ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
});

// Кеш превью
const thumbnailCache = new Map();

ipcMain.handle('get-video-thumbnail', async (event, videoPath) => {
    const videoHash = crypto.createHash('md5').update(videoPath).digest('hex');
    const thumbnailPath = path.join(thumbsDir, `${videoHash}.jpg`);
    const defaultLocalThumb = path.join(thumbsDir, 'default-thumbnail.jpg');

    // Проверяем наличие дефолтного изображения в папке thumbnails
    if (!fs.existsSync(defaultLocalThumb) && fs.existsSync(defaultThumbPath)) {
        fs.copyFileSync(defaultThumbPath, defaultLocalThumb);
    }

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
        // Сначала проверяем наличие видеопотока
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error('Error probing video:', err);
                return resolve(defaultLocalThumb);
            }

            const hasVideoStream = metadata.streams.some(stream => stream.codec_type === 'video');
            
            if (!hasVideoStream) {
                console.error('No video stream found');
                return resolve(defaultLocalThumb);
            }

            ffmpeg(videoPath)
                .on('end', () => {
                    thumbnailCache.set(videoPath, thumbnailPath);
                    resolve(thumbnailPath);
                })
                .on('error', (err) => {
                    console.error('Error creating thumbnail:', err);
                    resolve(defaultLocalThumb);
                })
                .screenshots({
                    timestamps: ['10%'],
                    filename: path.basename(thumbnailPath),
                    folder: thumbsDir,
                    size: '320x180'
                });
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