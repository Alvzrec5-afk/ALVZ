import pytest

from alvz_grade.bridge.resolve import Bridge, ResolveError
from alvz_grade.controller import Controller
from alvz_grade.state.store import Store

from fake_resolve import FakeItem, FakeResolve

TEMPLATE_LABELS = ("AZ_IN", "AZ_BAL", "AZ_TONE", "AZ_LOOK", "AZ_OUT")


@pytest.fixture
def env(tmp_path):
    resolve = FakeResolve()
    templates = tmp_path / "templates"
    templates.mkdir()
    (templates / "sony_slog3_sgamut3cine.drx").write_bytes(b"drx")
    ctl = Controller(Bridge(resolve, lut_dir=tmp_path / "LUT"), Store(tmp_path / "clips"), templates)
    return resolve, ctl, tmp_path


def put_clip(resolve, item):
    resolve.project.timeline.current = item
    return item


def test_no_clip(env):
    resolve, ctl, _ = env
    status = ctl.poll()
    assert status.clip_uid is None and "Aucun clip" in status.message


def test_clip_without_template_is_left_alone(env):
    resolve, ctl, _ = env
    item = put_clip(resolve, FakeItem("u1", "A001"))
    status = ctl.poll()
    assert not status.has_template and "gabarit" in status.message
    with pytest.raises(ResolveError):
        ctl.set_slider("exposure", 1)
    assert item.cdl_calls == [] and item.graph.luts == {}


def test_apply_template_then_sliders(env):
    resolve, ctl, tmp = env
    item = put_clip(resolve, FakeItem("u1", "A001"))
    ctl.poll()
    ctl.apply_template()
    assert item.cdl_calls and item.cdl_calls[-1]["NodeIndex"] == "2"
    assert item.graph.luts[3].endswith(".dctl")

    refreshes = resolve.project.refreshes
    ctl.set_slider("exposure", 1.0)
    assert item.cdl_calls[-1]["Offset"] != "0.000000 0.000000 0.000000"
    assert resolve.project.refreshes == refreshes  # le CDL n'écrit aucun fichier

    ctl.set_slider("highlight", 30)
    assert resolve.project.refreshes == refreshes + 1
    first = item.graph.luts[3]
    ctl.set_slider("highlight", 40)
    ctl.set_slider("highlight", 30)  # déjà écrit : pas de nouveau fichier
    assert item.graph.luts[3] == first
    assert resolve.project.refreshes == refreshes + 2
    assert len(list((tmp / "LUT" / "ALVZ" / "u1").glob("AZ_TONE_*.dctl"))) == 2


def test_state_follows_the_clip(env):
    resolve, ctl, _ = env
    a = put_clip(resolve, FakeItem("ua", "A", TEMPLATE_LABELS))
    ctl.poll()
    ctl.set_slider("saturation", 1.4)
    put_clip(resolve, FakeItem("ub", "B", TEMPLATE_LABELS))
    assert ctl.poll().sliders["saturation"] == 1.0
    put_clip(resolve, a)
    assert ctl.poll().sliders["saturation"] == 1.4


def test_change_made_in_resolve_is_detected(env):
    resolve, ctl, _ = env
    item = put_clip(resolve, FakeItem("u1", "A", TEMPLATE_LABELS))
    ctl.poll()
    ctl.set_slider("shadow", -20)
    assert not ctl.poll().changed_in_resolve
    item.graph.luts[3] = "Autre/LUT.cube"
    status = ctl.poll()
    assert status.changed_in_resolve and "modifié dans Resolve" in status.message
    ctl.set_slider("shadow", -25)  # reprendre la main réécrit le node
    assert not ctl.poll().changed_in_resolve


def test_reset(env):
    resolve, ctl, _ = env
    item = put_clip(resolve, FakeItem("u1", "A", TEMPLATE_LABELS))
    ctl.poll()
    ctl.set_slider("contrast", 1.6)
    ctl.reset()
    assert ctl.state["sliders"]["contrast"] == 1.0
    assert item.cdl_calls[-1]["Slope"] == "1.000000 1.000000 1.000000"


def test_unknown_slider(env):
    resolve, ctl, _ = env
    put_clip(resolve, FakeItem("u1", "A", TEMPLATE_LABELS))
    ctl.poll()
    with pytest.raises(KeyError):
        ctl.set_slider("bogus", 1)
