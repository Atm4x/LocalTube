const fs = require('fs').promises;
const path = require('path');
const { ipcRenderer }   = require('electron');


class RecommendationSystem {
    constructor() {
        this.appDataPath = ipcRenderer.sendSync('get-user-data-path');
        this.appDataPath = path.join(this.appDataPath, 'recommendations.json');
        
        // Загружаем сохраненные данные при инициализации
        this.loadData().catch(() => {
            // Если файл не существует или произошла ошибка, используем значения по умолчанию
            this.watchHistory = new Map();
            this.lastWatched = [];
            this.categoryPreferences = new Map();
        });
        
        this.MAX_HISTORY = 50;
    }

    extractKeywords(filename) {
        if (!filename) return [];
        // Очищаем имя файла от расширения и специальных символов
        return filename
            .replace(/\.[^/.]+$/, "") // убираем расширение
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    async loadData() {
        const data = JSON.parse(await fs.readFile(this.appDataPath, 'utf8'));
        this.watchHistory = new Map(Object.entries(data.watchHistory));
        this.lastWatched = data.lastWatched;
        this.categoryPreferences = new Map(Object.entries(data.categoryPreferences));
    }

    async saveData() {
        const data = {
            watchHistory: Object.fromEntries(this.watchHistory),
            lastWatched: this.lastWatched,
            categoryPreferences: Object.fromEntries(this.categoryPreferences)
        };
        await fs.writeFile(this.appDataPath, JSON.stringify(data), 'utf8');
    }

    // Метод для обновления предпочтений пользователя на основе просмотренного видео
    updateCategoryPreferences(keywords) {
        keywords.forEach(keyword => {
            this.categoryPreferences.set(
                keyword, 
                (this.categoryPreferences.get(keyword) || 0) + 1
            );
        });
    }

    calculateSimilarity(currentVideo, candidateVideo) {
        let score = 0;
        
        // Получаем ключевые слова
        const keywords1 = this.extractKeywords(currentVideo.title);
        const keywords2 = this.extractKeywords(candidateVideo.title);
        
        if (keywords1.length && keywords2.length) {
            const commonWords = keywords1.filter(word => keywords2.includes(word));
            score += (commonWords.length * 2) / (keywords1.length + keywords2.length);

            // Добавляем бонус за предпочитаемые категории
            keywords2.forEach(keyword => {
                const preferenceScore = this.categoryPreferences.get(keyword) || 0;
                score += (preferenceScore * 0.2); // Увеличиваем вес видео с предпочитаемыми категориями
            });
        }

        // Учитываем частоту просмотров этого конкретного видео
        const watchCount = this.watchHistory.get(candidateVideo.path) || 0;
        score += Math.min(watchCount, 5) * 0.15; // Увеличиваем вес для часто просматриваемых видео

        // Бонус за недавно просмотренные похожие видео
        const recentlyWatchedBonus = this.lastWatched
            .slice(0, 10) // берем последние 10 просмотренных
            .includes(candidateVideo.path) ? -0.5 : 0; // Понижаем рейтинг недавно просмотренных
        score += recentlyWatchedBonus;

        // Учитываем длительность
        if (currentVideo.duration && candidateVideo.duration) {
            const durationDiff = Math.abs(currentVideo.duration - candidateVideo.duration);
            const maxDuration = Math.max(currentVideo.duration, candidateVideo.duration);
            score += 1 - (durationDiff / maxDuration);
        }

        return score;
    }

    async updateWatchHistory(videoPath) {
        // Обновляем количество просмотров
        this.watchHistory.set(videoPath, (this.watchHistory.get(videoPath) || 0) + 1);
        
        // Обновляем список последних просмотренных
        this.lastWatched = [videoPath, ...this.lastWatched.filter(v => v !== videoPath)]
            .slice(0, this.MAX_HISTORY);
        
        // Обновляем предпочтения по категориям
        const keywords = this.extractKeywords(videoPath);
        this.updateCategoryPreferences(keywords);

        // Сохраняем изменения
        await this.saveData();
    }

    async getRecommendations(currentVideoPath, allVideos) {
        const currentMetadata = await this.getVideoMetadata(currentVideoPath);
        
        const recommendations = await Promise.all(
            allVideos
                .filter(videoPath => videoPath !== currentVideoPath)
                .map(async (videoPath) => {
                    const metadata = await this.getVideoMetadata(videoPath);
                    const score = this.calculateSimilarity(
                        { ...currentMetadata, path: currentVideoPath },
                        { ...metadata, path: videoPath }
                    );
                    return { 
                        videoPath, 
                        metadata: {
                            ...metadata,
                            views: this.watchHistory.get(videoPath) || 0 // Количество просмотров пользователем
                        }, 
                        score 
                    };
                })
        );

        return recommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    async getVideoMetadata(videoPath) {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    resolve({
                        title: path.basename(videoPath, path.extname(videoPath))
                            .replace(/-\d+$/, '')
                            .replace(/_/g, ' '),
                        duration: 0,
                        description: 'No description available',
                        views: Math.floor(Math.random() * 1000) // Пример для демонстрации
                    });
                    return;
                }

                resolve({
                    title: metadata.format.tags?.title || path.basename(videoPath, path.extname(videoPath))
                        .replace(/-\d+$/, '')
                        .replace(/_/g, ' '),
                    duration: parseInt(metadata.format.duration) || 0,
                    description: metadata.format.tags?.comment || 'No description available',
                    views: parseInt(metadata.format.tags?.views) || Math.floor(Math.random() * 1000)
                });
            });
        });
    }
}


module.exports = RecommendationSystem;