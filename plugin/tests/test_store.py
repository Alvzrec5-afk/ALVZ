import json

from alvz_grade.state.store import SCHEMA, Store, default_state


def test_missing_clip_gets_neutral_state(tmp_path):
    state = Store(tmp_path).load("Projet", "uid-1")
    assert state == default_state("uid-1")


def test_round_trip(tmp_path):
    store = Store(tmp_path)
    state = store.load("Projet / Mariage", "uid:1")
    state["sliders"]["exposure"] = 0.5
    path = store.save("Projet / Mariage", state)
    assert path.parent.name == "Projet_Mariage"
    assert store.load("Projet / Mariage", "uid:1")["sliders"]["exposure"] == 0.5
    assert not list(path.parent.glob(".tmp-*"))


def test_older_file_gets_new_defaults(tmp_path):
    store = Store(tmp_path)
    p = store.path("P", "u")
    p.parent.mkdir(parents=True)
    p.write_text(json.dumps({"schema": 1, "sliders": {"exposure": 1.0}}))
    state = store.load("P", "u")
    assert state["sliders"]["exposure"] == 1.0
    assert state["sliders"]["contrast"] == 1.0


def test_unreadable_or_future_file_falls_back(tmp_path):
    store = Store(tmp_path)
    p = store.path("P", "u")
    p.parent.mkdir(parents=True)
    p.write_text("{pas du json")
    assert store.load("P", "u") == default_state("u")
    p.write_text(json.dumps({"schema": SCHEMA + 1}))
    assert store.load("P", "u") == default_state("u")
