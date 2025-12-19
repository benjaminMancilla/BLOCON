import pkgutil
import importlib
import traceback
import os
import sys

CANDIDATES = ["src", "app.src", "app"]

def pick_package():
    for p in CANDIDATES:
        try:
            mod = importlib.import_module(p)
            if hasattr(mod, "__path__"):
                return p
        except Exception:
            pass
    raise RuntimeError(f"No package found. Tried: {CANDIDATES}. "
                       f"cwd={os.getcwd()} sys.path[0]={sys.path[0]}")

def main():
    pkg_name = pick_package()
    errors = []
    pkg = importlib.import_module(pkg_name)

    for m in pkgutil.walk_packages(pkg.__path__, pkg.__name__ + "."):
        name = m.name
        try:
            importlib.import_module(name)
        except Exception as e:
            errors.append((name, e, traceback.format_exc()))

    if errors:
        print("\nIMPORT ERRORS:\n")
        for name, e, tb in errors:
            print("=" * 80)
            print(name)
            print(tb)
        raise SystemExit(f"\n{len(errors)} modules failed to import.")
    print(f"OK: all modules imported successfully ({pkg_name}).")

if __name__ == "__main__":
    main()

