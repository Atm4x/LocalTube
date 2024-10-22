// downloader.js
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const fetch = require('node-fetch');
const ffmetadata = require("ffmetadata");
const util = require('util');

const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath("C:/FFmpeg/bin/ffmpeg.exe");

class VideoDownloader {
    constructor() {
        this.API_KEY = '17npX4J2EVoGOkS07FKd3xZuyltiJkDRVHCQyjIXCu0';
        this.API_BASE_URL = 'http://w.vasys.ru:5000';
        this.downloadPath = path.join(process.cwd(), 'downloads'); 
        this.lastVideoInfo = null;
        
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
        }
    }

    async getVideoInfo(videoUrl) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/get_info`, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: videoUrl })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.checkInfoStatus(data.task_id);
        } catch (error) {
            throw new Error(`Failed to get video info: ${error.message}`);
        }
    }

    async checkInfoStatus(taskId) {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                try {
                    const statusResponse = await fetch(`${this.API_BASE_URL}/status/${taskId}`, {
                        headers: { 'X-API-Key': this.API_KEY }
                    });

                    if (!statusResponse.ok) {
                        throw new Error(`HTTP error! status: ${statusResponse.status}`);
                    }

                    const statusData = await statusResponse.json();

                    if (statusData.status === 'completed') {
                        clearInterval(checkInterval);
                        const infoResponse = await fetch(`${this.API_BASE_URL}${statusData.file}?qualities&title&author`, {
                            headers: { 'X-API-Key': this.API_KEY }
                        });
                        const info = await infoResponse.json();
                        console.log(info);
                        const result = {
                            qualities: info.qualities,
                            videoTitle: info.title,
                            duration: info.duration,
                            uploadDate: info.upload_date,
                            viewCount: info.view_count,
                            videoId: info.id || this.extractVideoId(info.webpage_url || '')
                        };
                        this.lastVideoInfo = result; 
                        resolve(result);
                    } else if (statusData.status === 'failed') {
                        clearInterval(checkInterval);
                        reject(new Error('Failed to get video info'));
                    }
                } catch (error) {
                    clearInterval(checkInterval);
                    reject(error);
                }
            }, 2000);

            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Timeout: Failed to get video info after 2 minutes'));
            }, 120000);
        });
    }

    extractVideoId(url) {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : Date.now().toString();
    }

    async downloadVideo(videoUrl, videoFormat, audioFormat = 'bestaudio') {
        try {
            // Сначала получаем информацию о видео
            const videoInfo = await this.getVideoInfo(videoUrl);
            
            const response = await fetch(`${this.API_BASE_URL}/get_video`, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: videoUrl,
                    video_format: videoFormat,
                    audio_format: audioFormat
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(data);
            return this.checkDownloadStatus(data.task_id, videoInfo);
        } catch (error) {
            throw new Error(`Failed to start download: ${error.message}`);
        }
    }

    async checkDownloadStatus(taskId, videoInfo) {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                try {
                    const response = await fetch(`${this.API_BASE_URL}/status/${taskId}`, {
                        headers: { 'X-API-Key': this.API_KEY }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data.status === 'completed') {
                        clearInterval(checkInterval);
                        const videoData = await this.saveVideoLocally(
                            `${this.API_BASE_URL}${data.file}`,
                            videoInfo
                        );
                        console.log('Download Info:', JSON.stringify(videoData, null, 2));
                        resolve(videoData);
                    } else if (data.status === 'failed') {
                        clearInterval(checkInterval);
                        reject(new Error('Download failed'));
                    }
                } catch (error) {
                    clearInterval(checkInterval);
                    reject(error);
                }
            }, 2000);
        });
    }

    async saveVideoLocally(fileUrl, videoInfo) {
        try {
            console.log('Starting to save video:', fileUrl);
            
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('Fetched video data, converting to buffer');
            let buffer = Buffer.from(await response.arrayBuffer());
            
            const safeTitle = ((videoInfo && videoInfo.videoTitle) || this.lastVideoInfo.videoTitle || 'video')
                .replace(/[/\\?%*:|"<>]/g, '-')
                .replace(/\s+/g, '_')
                .substring(0, 200);

            const title = ((videoInfo && videoInfo.videoTitle) || this.lastVideoInfo.videoTitle || 'video')
            
            const videoId = (videoInfo && videoInfo.videoId) || this.lastVideoInfo.videoId || Date.now().toString();
            const filename = `${safeTitle}-${videoId}.mp4`;
            const savePath = path.join(this.downloadPath, filename);
            

            console.log('Writing file to disk');
            fs.writeFileSync(savePath, buffer);

            console.log('Adding metadata');
            try {
                await this.addMetadata(savePath, title);
                console.log('Metadata added successfully');
            } catch (metadataError) {
                console.error('Error adding metadata:', metadataError);
                // Продолжаем без добавления метаданных
            }
            
            
            console.log('Video saved successfully');
            return {
                path: savePath,
                filename: filename,
                title: safeTitle
            };
        } catch (error) {
            console.error('Detailed error in saveVideoLocally:', error);
            throw new Error(`Failed to save video locally: ${error.message}`);
        }
    }

async  addMetadata(filePath, title) {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions('-metadata', `title=${title}`)
      .saveToFile(`${filePath}_temp.mp4`)
      .on('end', () => {
        // Заменить оригинальный файл временным
        fs.renameSync(`${filePath}_temp.mp4`, filePath);
        resolve();
      })
      .on('error', reject);
  });
}
    
}

module.exports = VideoDownloader;