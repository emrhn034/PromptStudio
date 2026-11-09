const { contextBridge, ipcRenderer } = require('electron');
const allowed = new Set(['state', 'save', 'remove', 'settings', 'key', 'test-key', 'openrouter-connect', 'import-assets', 'asset-info', 'generate-content', 'generate-image', 'export-image', 'export-content', 'youtube-connect', 'youtube-sync', 'youtube-disconnect', 'chat', 'clear-chat', 'check-update', 'open-release']);
for (const name of ['publication-account', 'publication-disconnect', 'publication-pick', 'publication-add', 'publication-cancel']) allowed.add(name);
for (const name of ['research-key', 'video-report', 'research-ideas', 'research-open-source']) allowed.add(name);
allowed.add('cover-concepts');
for (const name of ['chatgpt-status', 'chatgpt-install', 'chatgpt-connect', 'chatgpt-disable']) allowed.add(name);
contextBridge.exposeInMainWorld('studio', { call: (name, ...args) => {
  if (!allowed.has(name)) return Promise.reject(new Error('Geçersiz işlem.'));
  return ipcRenderer.invoke(name, ...args);
} });
