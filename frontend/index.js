const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ATTRIBUTE_COLUMNS } = require('./attributes');

const DB_PATH = path.join(__dirname, '..', 'backend', 'data', 'fm26.db');
const POSITIONS_PATH = path.join(__dirname, '..', 'shared', 'positions.json');
let db;

const POSITIONS = JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8'));
const ratingColumn = (pos) => `r_${pos.id.toLowerCase()}`;

const ATTR_SELECT = ATTRIBUTE_COLUMNS.map((c) => `ps.${c}`).join(', ');
const RATING_SELECT = [
    ...POSITIONS.map((p) => `pr.${ratingColumn(p)}`),
    'pr.best_position',
    'pr.best_rating',
].join(', ');

// Columnas por las que se puede ordenar (lista cerrada: nada viene del usuario)
const SORT_SQL = {
    name: 'p.name COLLATE NOCASE',
    age: 'ps.age',
    club: 'c.name COLLATE NOCASE',
    best: 'pr.best_rating',
    ...Object.fromEntries(POSITIONS.map((p) => [p.id, `pr.${ratingColumn(p)}`])),
};

function escapeLike(text) {
    return text.replace(/[\\%_]/g, '\\$&');
}

function registerHandlers() {
    // Solo lo que la ventana necesita para dibujar las columnas (los pesos se quedan acá)
    ipcMain.handle('positions', () =>
        POSITIONS.map(({ id, label, title }) => ({ id, label, title }))
    );

    ipcMain.handle('db:snapshots', () =>
        db.prepare(`
      SELECT id, source_file, game_date, player_count
      FROM snapshots
      ORDER BY game_date DESC, id DESC
    `).all()
    );

    ipcMain.handle('db:clubs', (_event, snapshotId) =>
        db.prepare(`
      SELECT c.club_uid, c.name
      FROM club_snapshots cs
      JOIN clubs c ON c.club_uid = cs.club_uid
      WHERE cs.snapshot_id = ?
      ORDER BY c.name
    `).all(snapshotId)
    );

    ipcMain.handle('db:players', (_event, snapshotId, clubUid) =>
        db.prepare(`
      SELECT p.unique_id, p.name, ps.age, ${ATTR_SELECT}, ${RATING_SELECT}
      FROM player_snapshots ps
      JOIN players p ON p.unique_id = ps.player_unique_id
      JOIN player_ratings pr
        ON pr.snapshot_id = ps.snapshot_id AND pr.player_unique_id = ps.player_unique_id
      WHERE ps.snapshot_id = ? AND ps.club_uid = ?
      ORDER BY p.name
    `).all(snapshotId, clubUid)
    );

    // Todos los jugadores, paginados, con búsqueda y orden
    ipcMain.handle('db:players-page', (_event, opts) => {
        const snapshotId = Number(opts.snapshotId);
        const pageSize = Math.min(Math.max(Number(opts.pageSize) || 50, 1), 200);
        const page = Math.max(Number(opts.page) || 1, 1);
        const offset = (page - 1) * pageSize;
        const dir = opts.sortDir === 'desc' ? 'DESC' : 'ASC';
        const orderBy = SORT_SQL[opts.sortKey] ?? SORT_SQL.name;

        const where = ['pr.snapshot_id = ?'];
        const params = [snapshotId];
        const search = (opts.search ?? '').trim();
        if (search) {
            where.push("(p.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");
            const like = `%${escapeLike(search)}%`;
            params.push(like, like);
        }

        const from = `
      FROM player_ratings pr
      JOIN player_snapshots ps
        ON ps.snapshot_id = pr.snapshot_id AND ps.player_unique_id = pr.player_unique_id
      JOIN players p ON p.unique_id = pr.player_unique_id
      LEFT JOIN clubs c ON c.club_uid = ps.club_uid
      WHERE ${where.join(' AND ')}
    `;

        // Sin búsqueda, el total es simplemente cuántas notas tiene el snapshot (más rápido)
        const total = search
            ? db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params).n
            : db.prepare('SELECT COUNT(*) AS n FROM player_ratings WHERE snapshot_id = ?').get(snapshotId).n;

        // El desempate va en la misma dirección que el orden, así los índices se pueden usar
        const rows = db.prepare(`
      SELECT p.unique_id, p.name, ps.age, c.name AS club_name, ${ATTR_SELECT}, ${RATING_SELECT}
      ${from}
      ORDER BY ${orderBy} ${dir}, pr.player_unique_id ${dir}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

        return { total, rows };
    });
    // Todas las filas de un jugador (una por snapshot), para comparar fechas
    ipcMain.handle('db:player-history', (_event, uniqueId) =>
        db.prepare(`
      SELECT s.id AS snapshot_id, s.game_date, s.source_file, ps.age, ${ATTR_SELECT}
      FROM player_snapshots ps
      JOIN snapshots s ON s.id = ps.snapshot_id
      WHERE ps.player_unique_id = ?
      ORDER BY s.game_date, s.id
    `).all(Number(uniqueId))
    );
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 760,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    try {
        db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    } catch (err) {
        dialog.showErrorBox('No se pudo abrir la base de datos', `${DB_PATH}\n\n${err.message}`);
        app.quit();
        return;
    }
    registerHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    if (db) db.close();
    app.quit();
});