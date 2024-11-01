const builder = require('electron-builder');
const path = require('path');

builder.build({
    config: {
        appId: 'com.localtube.app',
        productName: 'LocalTube',
        directories: {
            output: 'dist'
        },
        win: {
            target: [
                {
                    target: 'msi',
                    arch: ['x64']
                }
            ],
            icon: 'assets/icon.ico'
        },
        extraResources: [
            {
                "from": "node_modules/ffmpeg-static/ffmpeg.exe",
                "to": "ffmpeg.exe"
            },
            {
                "from": "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe",
                "to": "ffprobe.exe"
            }
        ],
        msi: {
            oneClick: false,
            perMachine: true,
            allowToChangeInstallationDirectory: true
        },
        asar: true,
        asarUnpack: [
            "node_modules/ffmpeg-static/**/*",
            "node_modules/ffprobe-static/**/*"
        ],
        files: [
            "**/*",
            "!downloads/**/*",
            "!dist/**/*",
            "!build/**/*"
        ]
    }
})
.then(() => {
    console.log('Build completed successfully');
})
.catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});