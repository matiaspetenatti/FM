// Código compartido por las pestañas Clubes y Jugadores

// ---------- Notas (0-100) ----------

let POSITIONS = [];

// Promedio ponderado de los atributos clave (escala 1-20), llevado a 0-100
function rate(player, weights) {
    let total = 0;
    let sum = 0;
    for (const [attr, w] of Object.entries(weights)) {
        const value = player[attr];
        if (value == null) continue;
        total += w * value;
        sum += w;
    }
    if (sum === 0) return 0;
    return Math.round(((total / sum - 1) / 19) * 100);
}

function prepare(raw) {
    const ratings = {};
    for (const pos of POSITIONS) {
        ratings[pos.id] = raw[`r_${pos.id.toLowerCase()}`];
    }
    const best = POSITIONS.find((p) => p.id === raw.best_position) ?? POSITIONS[0];
    return { ...raw, ratings, best };
}

function ratingTier(value) {
    if (value >= 70) return 'high';
    if (value >= 50) return 'mid';
    return 'low';
}

function attrTier(value) {
    if (value >= 15) return 'high';
    if (value >= 10) return 'mid';
    return 'low';
}

// ---------- Utilidades ----------

const getSnapshotId = () => Number(document.getElementById('snapshot').value);

function makeOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
}

function makeCell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
}

// ---------- Tabla de jugadores ----------

function buildColumns(showClub) {
    return [
        { key: 'name', label: 'Nombre' },
        { key: 'age', label: 'Edad' },
        ...(showClub ? [{ key: 'club', label: 'Club' }] : []),
        ...POSITIONS.map((p) => ({ key: p.id, label: p.label, title: p.title })),
        { key: 'best', label: 'Mejor' },
    ];
}

// Al hacer clic en una columna: si ya estaba, invierte; si no, la elige
// (texto de menor a mayor, notas de mayor a menor)
function nextSort(current, key) {
    if (current.key === key) return { key, dir: -current.dir };
    return { key, dir: key === 'name' || key === 'club' ? 1 : -1 };
}

function renderSortableHeader(headEl, columns, sort, onSort) {
    headEl.replaceChildren(
        ...columns.map((col) => {
            const th = document.createElement('th');
            th.className = 'sortable';
            if (col.title) th.title = col.title;
            const arrow = sort.key === col.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '';
            th.textContent = col.label + arrow;
            th.addEventListener('click', () => onSort(col.key));
            return th;
        })
    );
}

function buildPlayerRow(p, { showClub, selected, onClick }) {
    const tr = document.createElement('tr');
    if (selected) tr.classList.add('selected');

    tr.appendChild(makeCell(p.name ?? '—'));
    tr.appendChild(makeCell(p.age ?? '—'));
    if (showClub) tr.appendChild(makeCell(p.club_name ?? 'Libre'));
    for (const pos of POSITIONS) {
        const value = p.ratings[pos.id];
        tr.appendChild(makeCell(value, `rating ${ratingTier(value)}`));
    }
    tr.appendChild(makeCell(`${p.best.label} (${p.ratings[p.best.id]})`, 'best'));

    tr.addEventListener('click', onClick);
    return tr;
}

// ---------- Detalle de atributos (con comparación entre snapshots) ----------

let detailRequest = 0; // para ignorar respuestas viejas si se abre otro jugador rápido

function daysBetween(dateA, dateB) {
    const a = Date.parse(`${dateA}T00:00:00Z`);
    const b = Date.parse(`${dateB}T00:00:00Z`);
    return Math.round((b - a) / 86400000);
}

const formatDays = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

function labeledSelect(labelText, options, value, disabled, onChange) {
    const label = document.createElement('label');
    label.className = 'compare-select';
    label.append(labelText);

    const select = document.createElement('select');
    select.replaceChildren(...options);
    select.value = value;
    select.disabled = disabled;
    select.addEventListener('change', () => onChange(Number(select.value)));

    label.appendChild(select);
    return label;
}

async function showDetail(container, player) {
    const myRequest = ++detailRequest;
    const history = await window.api.getPlayerHistory(player.unique_id);
    if (myRequest !== detailRequest || history.length === 0) return;

    // "Hasta" arranca en la fecha elegida arriba; "Desde" en la inmediata anterior
    const current = history.findIndex((h) => h.snapshot_id === getSnapshotId());
    const toIndex = current === -1 ? history.length - 1 : current;
    const state = { toIndex, fromIndex: toIndex > 0 ? toIndex - 1 : null };

    renderDetail(container, player, history, state);
    container.hidden = false;
}

function renderDetail(container, player, history, state) {
    const toRow = history[state.toIndex];
    const fromRow = state.fromIndex == null ? null : history[state.fromIndex];
    const optionText = (h) => `${h.game_date} (${h.source_file})`;
    const rerender = () => renderDetail(container, player, history, state);

    const title = document.createElement('h3');
    title.textContent = `${player.name ?? '—'} · ${toRow.age ?? '—'} años`;

    const feet = document.createElement('p');
    feet.className = 'feet';
    feet.textContent = FEET.map((f) => `${f.label}: ${toRow[f.key] ?? '—'}`).join('   ·   ');

    // --- Atributos con su cambio ---
    let up = 0;
    let down = 0;

    const groups = ATTRIBUTE_GROUPS.map((group) => {
        const box = document.createElement('div');
        box.className = 'attr-group';

        const h = document.createElement('h4');
        h.textContent = group.title;
        box.appendChild(h);

        for (const attr of group.attrs) {
            const value = toRow[attr.key];
            const before = fromRow ? fromRow[attr.key] : null;
            const delta = value != null && before != null ? value - before : 0;
            if (delta > 0) up++;
            if (delta < 0) down++;

            const row = document.createElement('div');
            row.className = 'attr-row';

            const name = document.createElement('span');
            name.textContent = attr.label;

            const val = document.createElement('span');
            val.className = `attr-value ${value == null ? '' : attrTier(value)}`;
            val.textContent = value ?? '—';

            const right = document.createElement('span');
            right.className = 'attr-right';
            right.appendChild(val);

            if (delta !== 0) {
                const arrow = document.createElement('span');
                arrow.className = `delta ${delta > 0 ? 'up' : 'down'}`;
                arrow.textContent = `${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}`;
                right.appendChild(arrow);
            }

            row.append(name, right);
            box.appendChild(row);
        }
        return box;
    });

    const grid = document.createElement('div');
    grid.className = 'attr-grid';
    grid.append(...groups);

    // --- Barra de comparación: tag + desplegables + resumen ---
    const tag = document.createElement('span');
    tag.className = 'date-tag';
    tag.textContent = fromRow
        ? `${fromRow.game_date} - ${toRow.game_date} · ${formatDays(daysBetween(fromRow.game_date, toRow.game_date))}`
        : `${toRow.game_date} · no hay una snapshot anterior para comparar`;

    const fromOptions = history.slice(0, state.toIndex).map((h, i) => makeOption(i, optionText(h)));
    const fromSelect = labeledSelect(
        'Desde',
        fromOptions.length ? fromOptions : [makeOption('', '—')],
        state.fromIndex ?? '',
        fromOptions.length === 0,
        (i) => {
            state.fromIndex = i;
            rerender();
        }
    );

    const toSelect = labeledSelect(
        'Hasta',
        history.map((h, i) => makeOption(i, optionText(h))),
        state.toIndex,
        false,
        (i) => {
            state.toIndex = i;
            // Si "Desde" ya no es anterior a "Hasta", pasa a la inmediata anterior
            if (state.fromIndex == null || state.fromIndex >= i) state.fromIndex = i > 0 ? i - 1 : null;
            rerender();
        }
    );

    const bar = document.createElement('div');
    bar.className = 'compare-bar';
    bar.append(tag, fromSelect, toSelect);

    if (fromRow) {
        const summary = document.createElement('span');
        summary.className = 'compare-summary';
        summary.textContent =
            up === 0 && down === 0 ? 'Sin cambios en los atributos' : `${up} suben · ${down} bajan`;
        bar.appendChild(summary);
    }

    container.replaceChildren(title, feet, bar, grid);
}

function hideDetail(container) {
    detailRequest++; // cancela cualquier carga pendiente
    container.hidden = true;
    container.replaceChildren();
}