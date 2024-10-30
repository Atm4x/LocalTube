const fs = require('fs').promises;
const path = require('path');
const { ipcRenderer } = require('electron');

class RecommendationSystem {
    constructor() {
        this.appDataPath = ipcRenderer.sendSync('get-user-data-path');
        this.appDataPath = path.join(this.appDataPath, 'recommendations.json');
        
        // Загружаем сохраненные данные при инициализации
        this.loadData().catch(() => {
            this.watchHistory = new Map();
            this.lastWatched = [];
            this.categoryPreferences = new Map();
            this.videoSimilarityCache = new Map();
        });
        
        this.MAX_HISTORY = 50;
        this.DIVERSITY_THRESHOLD = 0.3; // Порог разнообразия
    }

    extractKeywords(filename) {
        if (!filename) return [];
        
        // Улучшенное извлечение ключевых слов
        const words = filename
            .replace(/\.[^/.]+$/, "")
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/[\s-]+/)
            .filter(word => word.length > 2);

        // Добавляем n-граммы для лучшего сопоставления
        const ngrams = [];
        for (let i = 0; i < words.length - 1; i++) {
            ngrams.push(words[i] + ' ' + words[i + 1]);
        }

        return [...new Set([...words, ...ngrams])];
    }

    async loadData() {
        try {
            const data = JSON.parse(await fs.readFile(this.appDataPath, 'utf8'));
            this.watchHistory = new Map(Object.entries(data.watchHistory));
            this.lastWatched = data.lastWatched;
            this.categoryPreferences = new Map(Object.entries(data.categoryPreferences));
            this.videoSimilarityCache = new Map();
        } catch (error) {
            console.error('Error loading recommendations data:', error);
            this.resetData();
        }
    }

    resetData() {
        this.watchHistory = new Map();
        this.lastWatched = [];
        this.categoryPreferences = new Map();
        this.videoSimilarityCache = new Map();
    }

    async saveData() {
        const data = {
            watchHistory: Object.fromEntries(this.watchHistory),
            lastWatched: this.lastWatched,
            categoryPreferences: Object.fromEntries(this.categoryPreferences)
        };
        await fs.writeFile(this.appDataPath, JSON.stringify(data), 'utf8');
    }

    updateCategoryPreferences(keywords) {
        const decayFactor = 0.95; // Фактор затухания для старых предпочтений
        
        // Применяем затухание к существующим предпочтениям
        for (const [key, value] of this.categoryPreferences.entries()) {
            this.categoryPreferences.set(key, value * decayFactor);
        }

        // Обновляем предпочтения с новыми ключевыми словами
        keywords.forEach(keyword => {
            const currentValue = this.categoryPreferences.get(keyword) || 0;
            this.categoryPreferences.set(keyword, currentValue + 1);
        });
    }

    calculateSimilarity(currentVideo, candidateVideo) {
        const cacheKey = `${currentVideo.path}|${candidateVideo.path}`;
        if (this.videoSimilarityCache.has(cacheKey)) {
            return this.videoSimilarityCache.get(cacheKey);
        }

        let score = 0;
        const keywords1 = this.extractKeywords(currentVideo.title);
        const keywords2 = this.extractKeywords(candidateVideo.title);

        // Базовое сходство по ключевым словам
        if (keywords1.length && keywords2.length) {
            const commonWords = keywords1.filter(word => keywords2.includes(word));
            score += (commonWords.length * 2) / (keywords1.length + keywords2.length);
        }

        // Учитываем предпочтения пользователя
        keywords2.forEach(keyword => {
            const preferenceScore = this.categoryPreferences.get(keyword) || 0;
            score += preferenceScore * 0.1;
        });

        // Штраф за недавний просмотр
        const recentIndex = this.lastWatched.indexOf(candidateVideo.path);
        if (recentIndex !== -1) {
            score -= (this.lastWatched.length - recentIndex) / this.lastWatched.length;
        }

        // Учитываем длительность видео
        if (currentVideo.duration && candidateVideo.duration) {
            const durationRatio = Math.min(currentVideo.duration, candidateVideo.duration) / 
                                Math.max(currentVideo.duration, candidateVideo.duration);
            score += durationRatio * 0.2;
        }

        // Добавляем элемент случайности для разнообразия
        score += Math.random() * this.DIVERSITY_THRESHOLD;

        // Кешируем результат
        this.videoSimilarityCache.set(cacheKey, score);
        
        return score;
    }

    async updateWatchHistory(videoPath) {
        // Обновляем количество просмотров
        const currentCount = this.watchHistory.get(videoPath) || 0;
        this.watchHistory.set(videoPath, currentCount + 1);
        
        // Обновляем список последних просмотренных
        this.lastWatched = [videoPath, ...this.lastWatched.filter(v => v !== videoPath)]
            .slice(0, this.MAX_HISTORY);
        
        // Обновляем предпочтения
        const keywords = this.extractKeywords(path.basename(videoPath));
        this.updateCategoryPreferences(keywords);

        // Очищаем кеш сходства для этого видео
        for (const key of this.videoSimilarityCache.keys()) {
            if (key.includes(videoPath)) {
                this.videoSimilarityCache.delete(key);
            }
        }

        await this.saveData();
    }

    async getRecommendations(currentVideoPath, allVideos) {
        const currentMetadata = await this.getVideoMetadata(currentVideoPath);
        
        // Фильтруем текущее видео и последние 3 просмотренных
        const recentlyWatched = new Set(this.lastWatched.slice(0, 3));
        const eligibleVideos = allVideos.filter(videoPath => 
            videoPath !== currentVideoPath && !recentlyWatched.has(videoPath)
        );

        // Получаем рекомендации с метаданными
        const recommendations = await Promise.all(
            eligibleVideos.map(async (videoPath) => {
                const metadata = await this.getVideoMetadata(videoPath);
                const score = this.calculateSimilarity(
                    { ...currentMetadata, path: currentVideoPath },
                    { ...metadata, path: videoPath }
                );
                return { 
                    videoPath, 
                    metadata: {
                        ...metadata,
                        views: this.watchHistory.get(videoPath) || 0
                    }, 
                    score 
                };
            })
        );

        // Сортируем и добавляем разнообразие
        const sortedRecommendations = recommendations
            .sort((a, b) => b.score - a.score);

        // Перемешиваем топ-20 рекомендаций для большего разнообразия
        const topRecommendations = sortedRecommendations.slice(0, 20);
        for (let i = topRecommendations.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [topRecommendations[i], topRecommendations[j]] = 
            [topRecommendations[j], topRecommendations[i]];
        }

        return topRecommendations.slice(0, 10);
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
                        description: 'No description available'
                    });
                    return;
                }

                resolve({
                    title: metadata.format.tags?.title || 
                           path.basename(videoPath, path.extname(videoPath))
                           .replace(/-\d+$/, '')
                           .replace(/_/g, ' '),
                    duration: parseInt(metadata.format.duration) || 0,
                    description: metadata.format.tags?.comment || 'No description available'
                });
            });
        });
    }
}

module.exports = RecommendationSystem;