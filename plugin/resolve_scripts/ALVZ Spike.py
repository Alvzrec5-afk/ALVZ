"""ALVZ Grade : test de faisabilité (spike). Autonome : pas besoin d'installer le plugin.

À lancer dans DaVinci Resolve Studio, page Color :
  1. Ouvre un PROJET DE TEST (le script modifie le grade du clip courant).
  2. Place la tête de lecture sur un clip qui n'a qu'un seul node, vide.
  3. Workspace > Scripts > ALVZ Spike.
Le rapport s'écrit sur le Bureau : alvz_spike_report.json (et dans la console : Workspace > Console).
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

LUT_DIR = Path("/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT")
# Deux emplacements testés : le dossier LUT de Resolve (protégé, sudo pour le créer)
# et un dossier utilisateur (pas de sudo, si Resolve accepte un chemin absolu hors du dossier LUT)
LUT_WORK = LUT_DIR / "ALVZ" / "_spike"
USER_WORK = Path.home() / "Library" / "Application Support" / "ALVZ Grade" / "spike"
WORK = USER_WORK
REPORT = Path.home() / "Desktop" / "alvz_spike_report.json"

DCTL = """// ALVZ spike {n}
__DEVICE__ float3 transform(int p_Width, int p_Height, int p_X, int p_Y, float p_R, float p_G, float p_B)
{{
    float d = {offset:.6f}f;
    return make_float3(p_R + d, p_G + d, p_B + d);
}}
"""

DCTL_WITH_LUT = """// ALVZ spike : DEFINE_LUT
DEFINE_LUT(AZ_SPIKE_LUT, {lut})
__DEVICE__ float3 transform(int p_Width, int p_Height, int p_X, int p_Y, float p_R, float p_G, float p_B)
{{
    return APPLY_LUT(p_R, p_G, p_B, AZ_SPIKE_LUT);
}}
"""

# LUT 3D 2x2x2 qui inverse l'image : impossible à rater sur un still
INVERT_CUBE = "TITLE \"ALVZ invert\"\nLUT_3D_SIZE 2\n" + "".join(
    f"{1 - r} {1 - g} {1 - b}\n" for b in (0, 1) for g in (0, 1) for r in (0, 1))


def get_resolve():
    r = globals().get("resolve")
    if r:
        return r
    api = os.environ.setdefault(
        "RESOLVE_SCRIPT_API", "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting")
    os.environ.setdefault(
        "RESOLVE_SCRIPT_LIB", "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so")
    sys.path.append(os.path.join(api, "Modules"))
    import DaVinciResolveScript as dvr
    return dvr.scriptapp("Resolve")


def timed(fn, *args):
    t = time.perf_counter()
    out = fn(*args)
    return out, (time.perf_counter() - t) * 1000.0


def stats(ms):
    ms = sorted(ms)
    return {"n": len(ms), "median_ms": round(ms[len(ms) // 2], 1), "max_ms": round(ms[-1], 1),
            "min_ms": round(ms[0], 1)}


def file_hash(path):
    try:
        return hashlib.sha1(Path(path).read_bytes()).hexdigest()
    except OSError:
        return None


def main():
    report = {"ok": False, "steps": {}}
    steps = report["steps"]

    def step(name, fn):
        try:
            steps[name] = fn()
        except Exception as e:
            steps[name] = {"error": repr(e)}
        print(f"[ALVZ spike] {name}: {steps[name]}")

    resolve = get_resolve()
    if not resolve:
        print("Impossible de joindre Resolve.")
        return
    report["resolve"] = {"product": resolve.GetProductName(), "version": resolve.GetVersionString()}
    global WORK
    USER_WORK.mkdir(parents=True, exist_ok=True)
    try:
        LUT_WORK.mkdir(parents=True, exist_ok=True)
        lut_writable = True
    except PermissionError:
        lut_writable = False
    steps["lut_dir_writable"] = lut_writable
    WORK = LUT_WORK if lut_writable else USER_WORK
    resolve.OpenPage("color")
    project = resolve.GetProjectManager().GetCurrentProject()
    timeline = project.GetCurrentTimeline()
    item = timeline.GetCurrentVideoItem() if timeline else None
    if not item:
        print("Aucun clip sous la tête de lecture.")
        return
    report["clip"] = item.GetName()

    graph = item.GetNodeGraph() if hasattr(item, "GetNodeGraph") else None
    g = graph or item
    steps["graph_api"] = graph is not None

    step("nodes", lambda: {"count": g.GetNumNodes(),
                           "labels": [g.GetNodeLabel(i) for i in range(1, (g.GetNumNodes() or 0) + 1)]})
    step("unique_id", lambda: item.GetUniqueId())
    step("tools_in_node_1", lambda: g.GetToolsInNode(1) if hasattr(g, "GetToolsInNode") else "absent")

    # 1. CDL : le chemin rapide des curseurs exposition / contraste / balance / saturation
    def cdl():
        ms, oks = [], []
        for i in range(20):
            o = 0.01 * (i % 5)
            ok, t = timed(item.SetCDL, {"NodeIndex": "1", "Slope": "1 1 1", "Offset": f"{o} {o} {o}",
                                        "Power": "1 1 1", "Saturation": "1"})
            ms.append(t)
            oks.append(bool(ok))
        item.SetCDL({"NodeIndex": "1", "Slope": "1 1 1", "Offset": "0 0 0", "Power": "1 1 1", "Saturation": "1"})
        return {"all_ok": all(oks), **stats(ms)}
    step("set_cdl", cdl)

    # 2. RefreshLUTList seul
    step("refresh_lut_list", lambda: stats([timed(project.RefreshLUTList)[1] for _ in range(5)]))

    # 3. Le cycle complet d'un curseur DCTL : écrire un nouveau fichier, rafraîchir, appliquer
    def dctl_cycle(use_relative, work=None):
        work = work or WORK
        work.mkdir(parents=True, exist_ok=True)
        write_ms, refresh_ms, set_ms, total, oks = [], [], [], [], []
        for n in range(20):
            p = work / f"spike_{'rel' if use_relative else 'abs'}_{n}.dctl"
            t0 = time.perf_counter()
            _, t = timed(p.write_text, DCTL.format(n=n, offset=0.002 * n))
            write_ms.append(t)
            _, t = timed(project.RefreshLUTList)
            refresh_ms.append(t)
            target = str(p.relative_to(LUT_DIR)) if use_relative else str(p)
            ok, t = timed(g.SetLUT, 1, target)
            set_ms.append(t)
            oks.append(bool(ok))
            total.append((time.perf_counter() - t0) * 1000.0)
        return {"all_ok": all(oks), "write": stats(write_ms), "refresh": stats(refresh_ms),
                "set_lut": stats(set_ms), "total": stats(total), "get_lut_after": g.GetLUT(1)}
    step("dctl_cycle_outside_lut_dir", lambda: dctl_cycle(False, USER_WORK))
    if lut_writable:
        step("dctl_cycle_absolute_path", lambda: dctl_cycle(False))
        step("dctl_cycle_relative_path", lambda: dctl_cycle(True))

    # 4. Export d'image : formats acceptés, et l'image est-elle étalonnée ?
    def export_formats():
        out = {}
        for ext in ("png", "tif", "jpg", "dpx"):
            p = Path.home() / "Desktop" / f"alvz_spike_still.{ext}"
            ok, t = timed(project.ExportCurrentFrameAsStill, str(p))
            out[ext] = {"ok": bool(ok), "ms": round(t, 1), "bytes": p.stat().st_size if p.exists() else 0}
        return out
    step("export_still_formats", export_formats)

    # 5. DEFINE_LUT / APPLY_LUT dans un DCTL (pour le mélange des looks) + l'export voit-il le grade ?
    def define_lut():
        WORK.mkdir(parents=True, exist_ok=True)
        cube = WORK / "invert.cube"
        cube.write_text(INVERT_CUBE)
        results = {}
        still = Path.home() / "Desktop" / "alvz_spike_lut_test.png"
        g.SetLUT(1, str(USER_WORK / "spike_abs_0.dctl"))
        project.ExportCurrentFrameAsStill(str(still))
        base = file_hash(still)
        for label, lut_ref in (("relative_name", "invert.cube"), ("absolute", str(cube))):
            d = WORK / f"define_lut_{label}.dctl"
            d.write_text(DCTL_WITH_LUT.format(lut=lut_ref))
            project.RefreshLUTList()
            ok = g.SetLUT(1, str(d))
            project.ExportCurrentFrameAsStill(str(still))
            results[label] = {"set_lut_ok": bool(ok), "image_changed": file_hash(still) not in (None, base)}
        g.SetLUT(1, str(WORK / "invert.cube"))
        project.ExportCurrentFrameAsStill(str(still))
        results["plain_cube_changes_export"] = file_hash(still) not in (None, base)
        return results
    step("define_lut_in_dctl", define_lut)

    # 6. Activer / désactiver un node
    def node_enable():
        if not hasattr(g, "SetNodeEnabled"):
            return "absent"
        return {"off": bool(g.SetNodeEnabled(1, False)), "on": bool(g.SetNodeEnabled(1, True))}
    step("set_node_enabled", node_enable)

    report["ok"] = True
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"[ALVZ spike] Rapport écrit : {REPORT}")
    print("[ALVZ spike] RAPPORT JSON :\n" + json.dumps(report, indent=2, ensure_ascii=False))
    print("[ALVZ spike] Le node 1 du clip a été modifié : Reset du node (clic droit > Reset Node Grade).")


main()
