const PlayersTab = (() => {
    const PAGE_SIZE = 50;

    const search = document.getElementById('player-search');
    const title = document.getElementById('player-title');
    const table = document.getElementById('player-table');
    const head = document.getElementById('player-head');
    const body = document.getElementById('player-body');
    const pager = document.getElementById('player-pager');
    const detail = document.getElementById('player-detail');

    let sort = { key: 'name', dir: 1 };
    let page = 1;
    let total = 0;
    let players = [];
    let selectedPlayerId = null;
    let requestId = 0; // para ignorar respuestas viejas si el usuario cambia algo rápido
    let searchTimer;

    const totalPages = () => Math.max(1, Math.ceil(total / PAGE_SIZE));

    function pageButton(text, targetPage, disabled) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.disabled = disabled;
        btn.addEventListener('click', () => goTo(targetPage));
        return btn;
    }

    function renderPager() {
        const last = totalPages();
        const info = document.createElement('span');
        info.textContent = `Página ${page.toLocaleString('es-AR')} de ${last.toLocaleString('es-AR')}`;

        pager.replaceChildren(
            pageButton('«', 1, page === 1),
            pageButton('‹', page - 1, page === 1),
            info,
            pageButton('›', page + 1, page === last),
            pageButton('»', last, page === last)
        );
    }

    function render() {
        title.textContent = `${total.toLocaleString('es-AR')} jugadores`;
        table.hidden = false;

        renderSortableHeader(head, buildColumns(true), sort, (key) => {
            sort = nextSort(sort, key);
            page = 1;
            load();
        });

        body.replaceChildren(
            ...players.map((p) =>
                buildPlayerRow(p, {
                    showClub: true,
                    selected: p.unique_id === selectedPlayerId,
                    onClick: () => {
                        selectedPlayerId = p.unique_id;
                        render();
                    },
                })
            )
        );

        renderPager();

        // El jugador abierto solo se mantiene si sigue en la página actual
        const current = players.find((p) => p.unique_id === selectedPlayerId);
        if (current) {
            showDetail(detail, current);
        } else {
            selectedPlayerId = null;
            hideDetail(detail);
        }
    }

    async function load() {
        const myRequest = ++requestId;
        title.textContent = 'Cargando...';

        const result = await window.api.getPlayersPage({
            snapshotId: getSnapshotId(),
            search: search.value,
            sortKey: sort.key,
            sortDir: sort.dir === 1 ? 'asc' : 'desc',
            page,
            pageSize: PAGE_SIZE,
        });
        if (myRequest !== requestId) return; // llegó una respuesta más nueva, esta se descarta

        total = result.total;
        if (page > totalPages()) {
            page = totalPages();
            return load();
        }
        players = result.rows.map(prepare);
        render();
    }

    function goTo(targetPage) {
        page = Math.min(Math.max(targetPage, 1), totalPages());
        load();
    }

    // Busca 300 ms después de que el usuario deja de escribir
    search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            page = 1;
            selectedPlayerId = null;
            load();
        }, 300);
    });

    function refresh() {
        page = 1;
        selectedPlayerId = null;
        return load();
    }

    return { refresh };
})();