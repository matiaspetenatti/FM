const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getSnapshots: () => ipcRenderer.invoke('db:snapshots'),
    getClubs: (snapshotId) => ipcRenderer.invoke('db:clubs', snapshotId),
    getPlayers: (snapshotId, clubUid) => ipcRenderer.invoke('db:players', snapshotId, clubUid),
    getPlayersPage: (options) => ipcRenderer.invoke('db:players-page', options),
    getPositions: () => ipcRenderer.invoke('positions'),
    getPlayerHistory: (uniqueId) => ipcRenderer.invoke('db:player-history', uniqueId),
});