PRAGMA foreign_keys = ON;

-- ============================================================
-- SNAPSHOTS: una fila por cada .fm importado
-- ============================================================
CREATE TABLE IF NOT EXISTS snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file   TEXT    NOT NULL,              -- nombre del .fm / csv de origen
    game_date     TEXT    NOT NULL,              -- 'YYYY-MM-DD' (fecha dentro del juego)
    player_count  INTEGER,
    imported_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (source_file, game_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_game_date ON snapshots (game_date);

-- ============================================================
-- CLUBS: datos que casi no cambian (club_uid es estable dentro de una misma carrera)
-- ============================================================
CREATE TABLE IF NOT EXISTS clubs (
    club_uid   INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    nation_id  INTEGER
);

-- Lo que cambia por fecha: reputación del club
CREATE TABLE IF NOT EXISTS club_snapshots (
    snapshot_id  INTEGER NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
    club_uid     INTEGER NOT NULL REFERENCES clubs (club_uid),
    reputation   INTEGER,
    PRIMARY KEY (snapshot_id, club_uid)
);

-- ============================================================
-- PLAYERS: datos fijos del jugador (clave = unique_id del juego)
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
    unique_id    INTEGER PRIMARY KEY,
    name         TEXT,
    first_name   TEXT,
    last_name    TEXT,
    common_name  TEXT,
    birth_date   TEXT,                           -- 'YYYY-MM-DD'
    nation_id    INTEGER,
    height_cm    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_players_name      ON players (name);
CREATE INDEX IF NOT EXISTS idx_players_nation_id ON players (nation_id);

-- second_nation_ids del CSV ("12|45") se separa en filas
CREATE TABLE IF NOT EXISTS player_second_nations (
    player_unique_id  INTEGER NOT NULL REFERENCES players (unique_id) ON DELETE CASCADE,
    nation_id         INTEGER NOT NULL,
    PRIMARY KEY (player_unique_id, nation_id)
);

-- ============================================================
-- PLAYER_SNAPSHOTS: el estado del jugador en cada fecha
-- ============================================================
CREATE TABLE IF NOT EXISTS player_snapshots (
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
    player_unique_id    INTEGER NOT NULL REFERENCES players (unique_id),

    age                 INTEGER,

    -- Club / equipo (NULL = jugador libre)
    club_uid            INTEGER REFERENCES clubs (club_uid),
    team_id             INTEGER,

    -- Habilidad y reputación
    ability_current     INTEGER,
    ability_potential   INTEGER,                 -- NULL si el save solo guarda un rango
    reputation_current  INTEGER,
    reputation_home     INTEGER,
    reputation_world    INTEGER,

    -- Pies
    left_foot           INTEGER,
    right_foot          INTEGER,

    -- Atributos técnicos
    crossing            INTEGER,
    dribbling           INTEGER,
    finishing           INTEGER,
    heading             INTEGER,
    long_shots          INTEGER,
    marking             INTEGER,
    off_the_ball        INTEGER,
    passing             INTEGER,
    penalty_taking      INTEGER,
    tackling            INTEGER,
    vision              INTEGER,
    first_touch         INTEGER,
    technique           INTEGER,
    flair               INTEGER,
    corners             INTEGER,
    long_throws         INTEGER,
    free_kick_taking    INTEGER,

    -- Atributos de portero
    handling            INTEGER,
    aerial_reach        INTEGER,
    command_of_area     INTEGER,
    communication       INTEGER,
    kicking             INTEGER,
    throwing            INTEGER,
    one_on_ones         INTEGER,
    reflexes            INTEGER,
    eccentricity        INTEGER,
    rushing_out         INTEGER,
    punching            INTEGER,

    -- Atributos mentales
    anticipation        INTEGER,
    decisions           INTEGER,
    positioning         INTEGER,
    teamwork            INTEGER,
    work_rate           INTEGER,
    leadership          INTEGER,
    bravery             INTEGER,
    aggression          INTEGER,
    determination       INTEGER,
    composure           INTEGER,
    concentration       INTEGER,

    -- Atributos físicos
    acceleration        INTEGER,
    strength            INTEGER,
    stamina             INTEGER,
    pace                INTEGER,
    jumping_reach       INTEGER,
    balance             INTEGER,
    agility             INTEGER,
    natural_fitness     INTEGER,

    -- Atributos ocultos
    dirtiness           INTEGER,
    consistency         INTEGER,
    important_matches   INTEGER,
    injury_proneness    INTEGER,
    versatility         INTEGER,

    -- Personalidad
    personality_adaptability     INTEGER,
    personality_ambition         INTEGER,
    personality_loyalty          INTEGER,
    personality_pressure         INTEGER,
    personality_professionalism  INTEGER,
    personality_sportsmanship    INTEGER,
    personality_temperament      INTEGER,
    personality_controversy      INTEGER,

    PRIMARY KEY (snapshot_id, player_unique_id)
);

-- Para "historial de un jugador" y "plantilla de un club en una fecha"
CREATE INDEX IF NOT EXISTS idx_ps_player ON player_snapshots (player_unique_id, snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ps_club   ON player_snapshots (snapshot_id, club_uid);


-- ============================================================
-- PLAYER_RATINGS: nota 0-100 por posición, calculada con shared/positions.json
-- (se genera con ratings.py; si cambias los pesos, volvé a correrlo)
-- ============================================================
CREATE TABLE IF NOT EXISTS player_ratings (
    snapshot_id       INTEGER NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
    player_unique_id  INTEGER NOT NULL,
    r_gk              INTEGER NOT NULL,
    r_dc              INTEGER NOT NULL,
    r_dlr             INTEGER NOT NULL,
    r_wblr            INTEGER NOT NULL,
    r_dm              INTEGER NOT NULL,
    r_mc              INTEGER NOT NULL,
    r_mlr             INTEGER NOT NULL,
    r_amc             INTEGER NOT NULL,
    r_amlr            INTEGER NOT NULL,
    r_st              INTEGER NOT NULL,
    best_position     TEXT    NOT NULL,
    best_rating       INTEGER NOT NULL,
    PRIMARY KEY (snapshot_id, player_unique_id)
) WITHOUT ROWID;

-- Un índice por columna ordenable: permiten ordenar sin recorrer todos los jugadores
CREATE INDEX IF NOT EXISTS idx_pr_best ON player_ratings (snapshot_id, best_rating, player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_gk   ON player_ratings (snapshot_id, r_gk,   player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_dc   ON player_ratings (snapshot_id, r_dc,   player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_dlr  ON player_ratings (snapshot_id, r_dlr,  player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_wblr ON player_ratings (snapshot_id, r_wblr, player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_dm   ON player_ratings (snapshot_id, r_dm,   player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_mc   ON player_ratings (snapshot_id, r_mc,   player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_mlr  ON player_ratings (snapshot_id, r_mlr,  player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_amc  ON player_ratings (snapshot_id, r_amc,  player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_amlr ON player_ratings (snapshot_id, r_amlr, player_unique_id);
CREATE INDEX IF NOT EXISTS idx_pr_st   ON player_ratings (snapshot_id, r_st,   player_unique_id);