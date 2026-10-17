const snapshotSelect = document.getElementById('snapshot');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

const tabs = { clubs: ClubsTab, players: PlayersTab };
const stale = { clubs: true, players: true }; // true = hay que (re)cargar al abrir la pestaña
let activeTab = 'clubs';

async function activate(name) {
    activeTab = name;
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    tabPanels.forEach((p) => (p.hidden = p.id !== `tab-${name}`));

    // Cada pestaña se carga recién cuando se abre (y solo si hace falta)
    if (stale[name]) {
        stale[name] = false;
        await tabs[name].refresh();
    }
}

async function loadSnapshots() {
    const snapshots = await window.api.getSnapshots();
    // Vienen de más reciente a más antigua: la primera queda elegida por defecto
    snapshotSelect.replaceChildren(
        ...snapshots.map((s) => makeOption(s.id, `${s.game_date} (${s.source_file})`))
    );
}

tabButtons.forEach((b) => b.addEventListener('click', () => activate(b.dataset.tab)));

snapshotSelect.addEventListener('change', () => {
    stale.clubs = true;
    stale.players = true;
    activate(activeTab);
});

(async () => {
    POSITIONS = await window.api.getPositions();
    await loadSnapshots();
    await activate('clubs');
})();

