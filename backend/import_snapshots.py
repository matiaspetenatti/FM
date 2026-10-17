"""
Carga los CSV de backend/data/snapshots en la base SQLite.

    backend/data/snapshots/*.csv  ->  backend/data/fm26.db

Uso:
    python import_snapshots.py            # importa solo los CSV nuevos
    python import_snapshots.py --force    # reimporta todos (reemplaza el snapshot)
"""
import csv
import sqlite3
import sys
from itertools import chain
from pathlib import Path

from ratings import compute_ratings, connect

BASE_DIR = Path(__file__).parent
SNAPSHOTS_DIR = BASE_DIR / "data" / "snapshots"

CHUNK = 10_000  # filas por lote, para no cargar todo el CSV en memoria

# Columnas del CSV que NO van a player_snapshots (van a players / clubs / snapshots).
# Todo lo demás (age, club_uid, team_id, ability_*, atributos, personality_*, pies)
# se copia tal cual a player_snapshots, usando el nombre de la cabecera del CSV.
NOT_IN_PLAYER_SNAPSHOTS = {
    "game_date", "unique_id", "name", "first_name", "last_name", "common_name",
    "birth_date", "nation_id", "second_nation_ids", "height_cm",
    "club_name", "club_nation_id", "club_reputation",
}


def to_int(value):
    return int(value) if value not in (None, "") else None


def to_text(value):
    return value if value not in (None, "") else None


def import_csv(conn: sqlite3.Connection, csv_path: Path, force: bool = False):
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        first = next(reader, None)
        if first is None:
            print(f"[SKIP] {csv_path.name}: CSV vacío")
            return

        source_file = csv_path.stem
        game_date = first["game_date"]
        ps_cols = [
            c for c in reader.fieldnames if c not in NOT_IN_PLAYER_SNAPSHOTS]

        existing = conn.execute(
            "SELECT id FROM snapshots WHERE source_file = ? AND game_date = ?",
            (source_file, game_date),
        ).fetchone()
        if existing and not force:
            print(f"[OK]   {csv_path.name}: ya importado, se omite")
            return

        ps_sql = (
            f"INSERT INTO player_snapshots (snapshot_id, player_unique_id, {', '.join(ps_cols)}) "
            f"VALUES ({', '.join('?' * (2 + len(ps_cols)))})"
        )

        with conn:  # una transacción: si algo falla, no queda nada a medias
            if existing:
                # ON DELETE CASCADE borra player_snapshots y club_snapshots de ese snapshot
                conn.execute("DELETE FROM snapshots WHERE id = ?",
                             (existing[0],))

            snapshot_id = conn.execute(
                "INSERT INTO snapshots (source_file, game_date) VALUES (?, ?)",
                (source_file, game_date),
            ).lastrowid

            seen_players = set()
            seen_clubs = set()
            clubs, club_snaps, players, nations, ps_rows = [], [], [], [], []
            total = skipped_no_id = skipped_dup = 0

            def flush():
                # Orden importante: clubs y players antes que player_snapshots (claves foráneas)
                conn.executemany(
                    "INSERT INTO clubs (club_uid, name, nation_id) VALUES (?, ?, ?) "
                    "ON CONFLICT(club_uid) DO UPDATE SET "
                    "name = excluded.name, nation_id = excluded.nation_id",
                    clubs,
                )
                conn.executemany(
                    "INSERT INTO club_snapshots (snapshot_id, club_uid, reputation) "
                    "VALUES (?, ?, ?)",
                    club_snaps,
                )
                conn.executemany(
                    "INSERT INTO players (unique_id, name, first_name, last_name, "
                    "common_name, birth_date, nation_id, height_cm) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
                    "ON CONFLICT(unique_id) DO UPDATE SET "
                    "name = excluded.name, first_name = excluded.first_name, "
                    "last_name = excluded.last_name, common_name = excluded.common_name, "
                    "birth_date = excluded.birth_date, nation_id = excluded.nation_id, "
                    "height_cm = excluded.height_cm",
                    players,
                )
                conn.executemany(
                    "INSERT OR IGNORE INTO player_second_nations "
                    "(player_unique_id, nation_id) VALUES (?, ?)",
                    nations,
                )
                conn.executemany(ps_sql, ps_rows)
                for lst in (clubs, club_snaps, players, nations, ps_rows):
                    lst.clear()

            for row in chain([first], reader):
                total += 1
                uid = to_int(row["unique_id"])
                if uid is None:
                    skipped_no_id += 1
                    continue
                if uid in seen_players:  # el juego puede reutilizar IDs de personas borradas
                    skipped_dup += 1
                    continue
                seen_players.add(uid)

                club_uid = to_int(row["club_uid"])
                if club_uid is not None and club_uid not in seen_clubs:
                    seen_clubs.add(club_uid)
                    clubs.append((
                        club_uid,
                        to_text(row["club_name"]) or f"Club {club_uid}",
                        to_int(row["club_nation_id"]),
                    ))
                    club_snaps.append(
                        (snapshot_id, club_uid, to_int(row["club_reputation"])))

                players.append((
                    uid,
                    to_text(row["name"]),
                    to_text(row["first_name"]),
                    to_text(row["last_name"]),
                    to_text(row["common_name"]),
                    to_text(row["birth_date"]),
                    to_int(row["nation_id"]),
                    to_int(row["height_cm"]),
                ))

                for n in (row["second_nation_ids"] or "").split("|"):
                    if n:
                        nations.append((uid, int(n)))

                ps_rows.append(
                    (snapshot_id, uid, *[to_int(row[c]) for c in ps_cols]))

                if len(ps_rows) >= CHUNK:
                    flush()
            flush()

            compute_ratings(conn, snapshot_id)

            imported = len(seen_players)
            conn.execute(
                "UPDATE snapshots SET player_count = ? WHERE id = ?",
                (imported, snapshot_id),
            )

    print(
        f"[OK]   {csv_path.name}: {imported} jugadores importados "
        f"(sin unique_id: {skipped_no_id}, duplicados: {skipped_dup})"
    )


def main():
    force = "--force" in sys.argv
    csv_files = sorted(SNAPSHOTS_DIR.glob("*.csv"))
    if not csv_files:
        print(f"No hay CSV en {SNAPSHOTS_DIR}. Corré primero index.py")
        return

    conn = connect()
    try:
        for csv_path in csv_files:
            try:
                import_csv(conn, csv_path, force=force)
            except Exception as e:
                print(f"[ERR]  {csv_path.name}: {type(e).__name__}: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
