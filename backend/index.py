"""
Exporta los jugadores de cada snapshot (.fm) a un CSV.

    backend/data/saves/*.fm  ->  backend/data/snapshots/<nombre_save>__<game_date>.csv

Uso:
    python index.py            # procesa solo los .fm que todavía no tienen CSV
    python index.py --force    # reprocesa todos
"""
import csv
import sys
from dataclasses import fields
from pathlib import Path

import fmsave
from fmsave import Attributes

BASE_DIR = Path(__file__).parent
SAVES_DIR = BASE_DIR / "data" / "saves"
SNAPSHOTS_DIR = BASE_DIR / "data" / "snapshots"

# Los 52 atributos, en el orden en que los define fmsave.Attributes
ATTRIBUTE_NAMES = [f.name for f in fields(Attributes)]

PERSONALITY_NAMES = [
    "adaptability", "ambition", "loyalty", "pressure",
    "professionalism", "sportsmanship", "temperament", "controversy",
]

COLUMNS = (
    [
        "game_date",
        "unique_id",
        "name",
        "first_name",
        "last_name",
        "common_name",
        "birth_date",
        "age",
        "nation_id",
        "second_nation_ids",
        "height_cm",
        "ability_current",
        "ability_potential",
        "reputation_current",
        "reputation_home",
        "reputation_world",
        "club_uid",
        "club_name",
        "club_nation_id",
        "club_reputation",
        "team_id",
    ]
    + ATTRIBUTE_NAMES
    + [f"personality_{n}" for n in PERSONALITY_NAMES]
    + ["left_foot", "right_foot"]
)


def player_to_row(p, game_date) -> dict:
    """Aplana un Player de fmsave a un dict con una columna por valor."""
    row = {
        "game_date": game_date.isoformat() if game_date else None,
        "unique_id": p.unique_id,
        "name": p.name,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "common_name": p.common_name,
        "birth_date": p.birth_date.isoformat() if p.birth_date else None,
        "age": p.age,
        "nation_id": p.nation_id,
        # tupla -> "12|45" (vacío si no tiene segunda nacionalidad)
        "second_nation_ids": "|".join(str(n) for n in p.second_nation_ids),
        "height_cm": p.height_cm,
        # ability y reputation son objetos, los abrimos en columnas
        "ability_current": p.ability.current,
        "ability_potential": p.ability.potential,  # None si el save solo guarda un rango
        "reputation_current": p.reputation.current,
        "reputation_home": p.reputation.home,
        "reputation_world": p.reputation.world,
        "club_uid": p.club_uid,
        "club_name": p.club_name,
        "club_nation_id": p.club_nation_id,
        "club_reputation": p.club_reputation,
        "team_id": p.team_id,
        "left_foot": p.left_foot,
        "right_foot": p.right_foot,
    }

    # Atributos (escala 1-20, la que muestra el juego)
    for name in ATTRIBUTE_NAMES:
        row[name] = getattr(p.attributes, name)

    # Personalidad (puede ser None si el save no la pudo leer)
    for name in PERSONALITY_NAMES:
        row[f"personality_{name}"] = (
            getattr(p.personality, name) if p.personality else None
        )

    return row


def export_snapshot(fm_path: Path, force: bool = False) -> Path | None:
    save = fmsave.open(fm_path)
    try:
        game_date = save.info.game_date
        if game_date is None:
            print(f"[SKIP] {fm_path.name}: no se pudo leer la fecha del juego")
            return None

        out_path = SNAPSHOTS_DIR / f"{fm_path.stem}__{game_date.isoformat()}.csv"
        if out_path.exists() and not force:
            print(f"[OK]   {fm_path.name}: ya existe {out_path.name}, se omite")
            return out_path

        # Escribimos a un .tmp y renombramos al final, así nunca queda un CSV a medias
        tmp_path = out_path.with_suffix(".csv.tmp")
        count = 0
        with open(tmp_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=COLUMNS)
            writer.writeheader()
            for player in save.players():
                writer.writerow(player_to_row(player, game_date))
                count += 1
        tmp_path.replace(out_path)

        print(f"[OK]   {fm_path.name}: {count} jugadores -> {out_path.name}")
        return out_path
    finally:
        save.close()


def main():
    force = "--force" in sys.argv
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    fm_files = sorted(SAVES_DIR.glob("*.fm"))
    if not fm_files:
        print(f"No hay archivos .fm en {SAVES_DIR}")
        return

    for fm_path in fm_files:
        try:
            export_snapshot(fm_path, force=force)
        except Exception as e:
            print(f"[ERR]  {fm_path.name}: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()