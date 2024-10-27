const fs = require('fs');
const path = require('path');

function indexVideos(folders) {
    try {
        let videos = [];
        const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv'];

        folders.forEach(folder => {
            const files = walkSync(folder);
            files.forEach(file => {
                if (videoExtensions.includes(path.extname(file).toLowerCase()) && 
                    fs.existsSync(file)) {
                    videos.push(file);
                }
            });
        });

        return videos;
    } catch (error) {
        console.error('Error in indexVideos:', error);
        return [];
    }
}

function walkSync(dir) {
    let files = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            files = files.concat(walkSync(file));
        } else {
            files.push(file);
        }
    });
    return files;
}

module.exports = { indexVideos };