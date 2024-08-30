const fs = require('fs');
const path = require('path');

function indexVideos(folders) {
    let videos = [];
    const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv'];

    folders.forEach(folder => {
        const files = walkSync(folder);
        files.forEach(file => {
            if (videoExtensions.includes(path.extname(file).toLowerCase())) {
                videos.push(file);
            }
        });
    });

    return videos;
}

function walkSync(dir, filelist = []) {
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        try {
            fs.statSync(dirFile).isDirectory()
                ? walkSync(dirFile, filelist)
                : filelist.push(dirFile);
        } catch (err) {
            console.error('Error accessing file:', dirFile, err);
        }
    });
    return filelist;
}

module.exports = { indexVideos };
