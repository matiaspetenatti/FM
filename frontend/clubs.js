const ClubsTab = (() => {
    const clubFilter = document.getElementById('club-filter');
    const clubSelect = document.getElementById('club');
    const title = document.getElementById('club-title');
    const table = document.getElementById('club-table');
    const head = document.getElementById('club-head');
    const body = document.getElementById('club-body');
    const detail = document.getElementById('club-detail');

    let allClubs = [];
    let players = [];
    let sort = { key: 'name', dir: 1 };
    let selectedPlayerId = null;

    function sortValue(p, key) {
        if (key === 'name') return p.name ?? '';
        if (key === 'age') return p.age ?? -1;
        if (key === 'best') return p.ratings[p.best.id];
        return p.ratings[key];
    }

    function renderClubOptions() {
        const selected = clubSelect.value;
        const q = clubFilter.value.trim().toLowerCase();
        const filtered = q ? allClubs.filter((c) => c.name.toLowerCase().includes(q)) : allClubs;

        clubSelect.replaceChildren(
            makeOption('', `Elegí un club (${filtered.length})`),
            ...filtered.map((c) => makeOption(c.club_uid, c.name))
        );
        if (filtered.some((c) => String(c.club_uid) === selected)) clubSelect.value = selected;
    }

    function clearPlayers() {
        players = [];
        selectedPlayerId = null;
        table.hidden = true;
        body.replaceChildren();
        title.textContent = 'Elegí un club';
        hideDetail(detail);
    }

    function renderTable() {
        renderSortableHeader(head, buildColumns(false), sort, (key) => {
            sort = nextSort(sort, key);
            renderTable();
        });

        const sorted = [...players].sort((a, b) => {
            const va = sortValue(a, sort.key);
            const vb = sortValue(b, sort.key);
            const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
            return cmp * sort.dir || (a.name ?? '').localeCompare(b.name ?? '');
        });

        body.replaceChildren(
            ...sorted.map((p) =>
                buildPlayerRow(p, {
                    showClub: false,
                    selected: p.unique_id === selectedPlayerId,
                    onClick: () => {
                        selectedPlayerId = p.unique_id;
                        renderTable();
                        showDetail(detail, p);
                    },
                })
            )
        );
    }

    async function loadPlayers() {
        if (!clubSelect.value) return clearPlayers();

        const raw = await window.api.getPlayers(getSnapshotId(), Number(clubSelect.value));
        players = raw.map(prepare);

        const clubName = clubSelect.options[clubSelect.selectedIndex].textContent;
        title.textContent = `${clubName} — ${players.length} jugadores`;
        table.hidden = false;
        renderTable();

        // Si había un jugador abierto y sigue en el club (al cambiar de fecha), lo mantenemos
        const current = players.find((p) => p.unique_id === selectedPlayerId);
        if (current) {
            showDetail(detail, current);
        } else {
            selectedPlayerId = null;
            hideDetail(detail);
        }
    }

    async function loadClubs() {
        const previousClub = clubSelect.value;
        allClubs = await window.api.getClubs(getSnapshotId());
        renderClubOptions();

        // Al cambiar de fecha mantenemos el club elegido si existe en esa fecha
        if (previousClub && allClubs.some((c) => String(c.club_uid) === previousClub)) {
            clubSelect.value = previousClub;
            await loadPlayers();
        } else {
            clearPlayers();
        }
    }

    clubFilter.addEventListener('input', renderClubOptions);
    clubSelect.addEventListener('change', () => {
        selectedPlayerId = null;
        loadPlayers();
    });

    return { refresh: loadClubs };
})();