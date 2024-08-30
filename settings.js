const { ipcRenderer } = require('electron');
const folderList = document.getElementById('folder-list');
const addFolderButton = document.getElementById('add-folder');
const backButton = document.getElementById('back-button');
const themeToggle = document.getElementById('theme-toggle');

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('dark-theme', document.body.classList.contains('dark-theme'));
}

if (localStorage.getItem('dark-theme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', toggleTheme);

// Загрузка сохраненных папок
ipcRenderer.on('load-folders', (event, folders) => {
    folderList.innerHTML = '';
    folders.forEach(folder => {
        const li = document.createElement('li');
        li.textContent = folder;
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.onclick = () => ipcRenderer.send('remove-folder', folder);
        li.appendChild(removeButton);
        folderList.appendChild(li);
    });
});

addFolderButton.addEventListener('click', () => {
    ipcRenderer.send('add-folder');
});

backButton.addEventListener('click', () => {
    ipcRenderer.send('back-to-main');
});

ipcRenderer.send('get-folders');
