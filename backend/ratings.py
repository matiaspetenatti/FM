"""
Calcula las notas (0-100) por posición de cada jugador y las guarda en player_ratings.

    shared/positions.json  +  player_snapshots  ->  player_ratings

Uso:
    python ratings.py        # recalcula TODOS los snapshots (útil si cambiaste los pesos)

El importador (import_snapshots.py) también llama a compute_ratings() con cada snapshot nuevo.
"""
import json
import sqlite3
import time
from pathlib import Path

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "data" / "fm26.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"
POSITIONS_PATH = BASE_DIR.parent / "shared" / "positions.json"


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    # SQLite lo exige en cada conexión
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def rating_column(position_id: str) -> str:
    return f"r_{position_id.lower()}"


def rating_sql(position: dict, attr_columns: set[str]) -> str:
    """Promedio ponderado de los atributos (escala 1-20) llevado a 0-100, como expresión SQL."""
    weights = position["weights"]
    total_weight = sum(weights.values())
    terms = []
    for attr, weight in weights.items():
        if attr not in attr_columns:
            raise ValueError(
                f'positions.json: atributo desconocido "{attr}" en {position["id"]}')
        terms.append(f"{int(weight)} * COALESCE({attr}, 1)")
    weighted_avg = f"(({' + '.join(terms)}) * 1.0 / {total_weight})"
    return f"CAST(ROUND(({weighted_avg} - 1) / 19.0 * 100) AS INTEGER)"


def compute_ratings(conn: sqlite3.Connection, snapshot_id: int) -> int:
    """Calcula (o recalcula) las notas de un snapshot. No hace commit: lo maneja quien la llama."""
    positions = json.loads(POSITIONS_PATH.read_text(encoding="utf-8"))
    attr_columns = table_columns(conn, "player_snapshots")
    rating_table_columns = table_columns(conn, "player_ratings")

    columns = []
    for pos in positions:
        if not pos["id"].isalnum():
            raise ValueError(f'positions.json: id inválido "{pos["id"]}"')
        col = rating_column(pos["id"])
        if col not in rating_table_columns:
            raise ValueError(
                f'La posición "{pos["id"]}" no tiene la columna {col} en player_ratings. '
                f"Agregala en schema.sql."
            )
        columns.append(col)

    col_list = ", ".join(columns)
    inner = ", ".join(
        f"{rating_sql(pos, attr_columns)} AS {col}" for pos, col in zip(positions, columns)
    )
    best_case = (
        f"CASE max({col_list}) "
        + " ".join(f"WHEN {col} THEN '{pos['id']}'" for pos,
                   col in zip(positions, columns))
        + " END"
    )

    conn.execute(
        "DELETE FROM player_ratings WHERE snapshot_id = ?", (snapshot_id,))
    cursor = conn.execute(
        f"""
        INSERT INTO player_ratings
            (snapshot_id, player_unique_id, {col_list}, best_position, best_rating)
        SELECT snapshot_id, player_unique_id, {col_list}, {best_case}, max({col_list})
        FROM (
            SELECT snapshot_id, player_unique_id, {inner}
            FROM player_snapshots
            WHERE snapshot_id = ?
        )
        """,
        (snapshot_id,),
    )
    return cursor.rowcount


def main():
    conn = connect()
    try:
        snapshots = conn.execute(
            "SELECT id, source_file, game_date FROM snapshots ORDER BY game_date"
        ).fetchall()
        if not snapshots:
            print("No hay snapshots en la base. Corré primero import_snapshots.py")
            return

        for snapshot_id, source_file, game_date in snapshots:
            start = time.time()
            with conn:  # una transacción por snapshot
                count = compute_ratings(conn, snapshot_id)
            print(
                f"[OK]   {game_date} ({source_file}): {count} notas en {time.time() - start:.1f}s")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
