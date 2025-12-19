#!/usr/bin/env python
import json
import math
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd  # pip install pandas openpyxl


# Columnas requeridas en el Excel (en español, con espacio)
REQUIRED_COLS_NORMALIZED = ["id", "kks", "fecha falla", "tipo"]


def find_db_path() -> Path:
    """
    Busca components_failures_db.json asumiendo que este script está en scripts/.

    1) ../cloud/components_failures_db.json
    2) ../components_failures_db.json

    Si no existe ninguno, elige ../cloud/components_failures_db.json.
    """
    root = Path(__file__).resolve().parents[1]
    candidates = [
        root / "cloud" / "components_failures_db.json",
        root / "components_failures_db.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]


def load_db(path: Path) -> List[Dict[str, Any]]:
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_db(path: Path, data: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def is_blank(v) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    s = str(v).strip()
    return s == "" or s.lower() in {"nan", "none"}


def normalize_cols(df: pd.DataFrame):
    """
    Construye un mapping normalizado (lower, trimmed) -> nombre real de la columna.
    """
    mapping = {}
    for col in df.columns:
        key = str(col).strip().lower()
        if key not in mapping:
            mapping[key] = col
    return mapping


def main() -> None:
    print("Ruta del archivo Excel de fallas (.xlsx): ", end="", flush=True)
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

    if df.empty:
        print("El Excel no tiene filas, nada que hacer.")
        return

    col_map = normalize_cols(df)
    missing = [c for c in REQUIRED_COLS_NORMALIZED if c not in col_map]
    if missing:
        print("El Excel no tiene todas las columnas requeridas (id, kks, fecha falla, tipo).")
        print("Faltan (normalizadas):")
        for c in missing:
            print("  -", c)
        print("No se harán cambios.")
        return

    # Nombres reales de las columnas (por si vienen con mayúsculas o espacios raros)
    col_id = col_map["id"]
    col_kks = col_map["kks"]
    col_fecha = col_map["fecha falla"]
    col_tipo = col_map["tipo"]

    # Filtrar filas válidas: kks y fecha falla no vacíos
    rows = []
    skipped_blank = 0
    for _, row in df.iterrows():
        kks = row[col_kks]
        fecha = row[col_fecha]
        if is_blank(kks) or is_blank(fecha):
            skipped_blank += 1
            continue
        rows.append(row)

    print(f"Filas válidas en Excel: {len(rows)} (saltadas por kks/fecha falla en blanco: {skipped_blank})")

    db_path = find_db_path()
    db = load_db(db_path)
    print(f"Base actual: {len(db)} fallas en {db_path}")

    # Set para saber qué fallas ya existen (Component_ID, failure_date, type_failure)
    existing_keys = set()
    max_id = 0
    for rec in db:
        try:
            rec_id = int(rec.get("ID", 0))
        except Exception:
            rec_id = 0
        if rec_id > max_id:
            max_id = rec_id

        cid = str(rec.get("Component_ID", "")).strip()
        fdate = str(rec.get("failure_date", "")).strip()
        ttype = str(rec.get("type_failure", "")).strip()
        if cid and fdate:
            existing_keys.add((cid, fdate, ttype))

    next_id = max_id + 1
    added_count = 0

    for row in rows:
        kks = str(row[col_kks]).strip()
        if not kks:
            continue

        # Fecha: normalizamos a YYYY-MM-DD
        fdate = pd.to_datetime(row[col_fecha]).date().isoformat()

        tipo_val = row[col_tipo]
        type_failure = "" if is_blank(tipo_val) else str(tipo_val).strip()

        key = (kks, fdate, type_failure)
        if key in existing_keys:
            continue

        rec = {
            "ID": next_id,
            "Component_ID": kks,
            "failure_date": fdate,
            "type_failure": type_failure,
        }
        db.append(rec)
        existing_keys.add(key)
        added_count += 1
        next_id += 1

    if added_count == 0:
        print("No se encontraron nuevas fallas para agregar.")
    else:
        save_db(db_path, db)
        print()
        print("Resumen:")
        print(f"  Nuevas fallas agregadas: {added_count}")
        print(f"  Total ahora en DB:       {len(db)}")
        print()
        print(f"Actualizado: {db_path}")


if __name__ == "__main__":
    main()
