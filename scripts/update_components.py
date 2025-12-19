#!/usr/bin/env python
import json
import math
import os
from datetime import timezone
from pathlib import Path
from typing import Any, Dict

import pandas as pd  # requiere: pip install pandas openpyxl


REQUIRED_COLS = [
    "insID",
    "ID",
    "kks",
    "kks_name",
    "id_UT",
    "SubType",
    "id_MainUT",
    "id_MainUT: Type_name",
    "Modificado",
]


def find_db_path() -> Path:
    """
    Busca components_db.json.
    1) ./cloud/components_db.json
    2) ./components_db.json
    Si no existe ninguno, elige ./cloud/components_db.json.
    """
    root = Path(__file__).resolve().parents[1]
    candidates = [
        root / "cloud" / "components_db.json",
        root / "components_db.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]


def load_db(path: Path) -> Dict[str, Any]:
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_db(path: Path, db: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def to_iso(dt) -> str:
    """Convierte un valor de Excel/pandas a ISO-8601 tipo 'YYYY-MM-DDTHH:MM:SSZ'."""
    ts = pd.to_datetime(dt)
    if ts.tzinfo is None:
        # asumimos hora local y solo marcamos Z (naive)
        return ts.replace(tzinfo=None).isoformat(timespec="seconds") + "Z"
    return ts.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def is_blank(v) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    s = str(v).strip()
    return s == "" or s.lower() in {"nan", "none"}


def main() -> None:
    print("Ruta del archivo Excel (.xlsx): ", end="", flush=True)
    excel_path_str = input().strip().strip('"')
    if not excel_path_str:
        print("No se especificó ruta, abortando.")
        return

    excel_path = Path(excel_path_str)
    if not excel_path.exists():
        print(f"El archivo '{excel_path}' no existe.")
        return

    try:
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"No se pudo leer el Excel: {e}")
        return

    cols = set(df.columns.astype(str))
    missing = [c for c in REQUIRED_COLS if c not in cols]
    if missing:
        print("El Excel no tiene todas las columnas requeridas:")
        for c in missing:
            print("  -", c)
        print("No se harán cambios.")
        return

    # Dejar solo las columnas relevantes y en el orden esperado
    df = df[REQUIRED_COLS]

    # Filtrar filas sin kks o sin Modificado
    rows = []
    skipped_blank = 0
    for _, row in df.iterrows():
        if is_blank(row["kks"]) or is_blank(row["Modificado"]):
            skipped_blank += 1
            continue
        rows.append(row)

    print(f"Filas válidas en Excel: {len(rows)} (saltadas por kks/Modificado en blanco: {skipped_blank})")

    db_path = find_db_path()
    db = load_db(db_path)
    print(f"Base actual: {len(db)} componentes en {db_path}")

    new_count = 0
    updated_count = 0
    unchanged_count = 0

    for row in rows:
        kks = str(row["kks"]).strip()
        if not kks:
            skipped_blank += 1
            continue

        # Campos desde Excel
        ins_id = row["insID"]
        try:
            ins_id = int(ins_id)
        except Exception:
            ins_id = None

        name = row["kks_name"]
        name = str(name).strip() if not is_blank(name) else ""

        subtype = row["SubType"]
        subtype = str(subtype).strip() if not is_blank(subtype) else ""

        type_name = row["id_MainUT: Type_name"]
        type_name = str(type_name).strip() if not is_blank(type_name) else ""

        updated_at = to_iso(row["Modificado"])

        new_meta = {
            "insID": ins_id,
            "kks_name": name,
            "SubType": subtype,
            "type": type_name,
            "updated_at": updated_at,
        }
        # Auxiliares para la app
        title = name or kks
        new_meta["title"] = title

        existing = db.get(kks)
        if existing is None:
            # Nuevo componente
            new_meta.setdefault("etag", f'W/"{ins_id or kks}"')
            db[kks] = new_meta
            new_count += 1
        else:
            old_updated = existing.get("updated_at")
            # Merge: preserva claves viejas (ej: etag), pisa con lo nuevo
            merged = dict(existing)
            merged.update(new_meta)

            if old_updated != updated_at:
                # Hay cambios (según columna Modificado)
                if "etag" not in merged:
                    merged["etag"] = f'W/"{ins_id or kks}"'
                db[kks] = merged
                updated_count += 1
            else:
                db[kks] = merged
                unchanged_count += 1

    save_db(db_path, db)

    print()
    print("Resumen:")
    print(f"  Nuevos:       {new_count}")
    print(f"  Actualizados: {updated_count}")
    print(f"  Sin cambios:  {unchanged_count}")
    print(f"  Total en DB:  {len(db)}")
    print()
    print(f"Actualizado: {db_path}")


if __name__ == "__main__":
    main()
