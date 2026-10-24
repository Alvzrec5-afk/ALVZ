import re

import numpy as np

from alvz_grade.color import transforms as t
from alvz_grade.dctl.generator import identity_dctl, look_dctl, tone_dctl, tone_reference


def srgb_to_di(rgb):
    lin = t.apply_matrix(t.srgb_to_linear(np.asarray(rgb, dtype=float)),
                         t.gamut_matrix("rec709", "davinci_wide_gamut"))
    return t.linear_to_di(lin)


def chroma(di):
    y = di @ np.array([0.2627, 0.6780, 0.0593])
    return np.hypot(di[..., 0] - y, di[..., 2] - y)


def test_neutral_tone_is_identity():
    rgb = np.random.default_rng(2).uniform(0, 1, (500, 3))
    assert np.allclose(tone_reference(rgb), rgb, atol=1e-12)


def test_highlight_moves_brights_not_darks():
    ramp = np.repeat(np.linspace(0, 1, 101)[:, None], 3, axis=1)
    out = tone_reference(ramp, highlight=100)
    assert np.allclose(out[ramp[:, 0] <= t.DI_MID_GREY], ramp[ramp[:, 0] <= t.DI_MID_GREY])
    assert (out[ramp[:, 0] > 0.7] > ramp[ramp[:, 0] > 0.7]).all()


def test_shadow_moves_darks_not_brights():
    ramp = np.repeat(np.linspace(0, 1, 101)[:, None], 3, axis=1)
    out = tone_reference(ramp, shadow=-100)
    assert np.allclose(out[ramp[:, 0] >= t.DI_MID_GREY], ramp[ramp[:, 0] >= t.DI_MID_GREY])
    assert (out[ramp[:, 0] < 0.2] < ramp[ramp[:, 0] < 0.2]).all()


def test_tone_curve_never_inverts():
    ramp = np.repeat(np.linspace(0, 1, 1001)[:, None], 3, axis=1)
    for h in (-100, 100):
        for s in (-100, 100):
            out = tone_reference(ramp, highlight=h, shadow=s)[:, 0]
            assert (np.diff(out) > 0).all()


def test_skin_tone_targets_skin_only():
    skins = srgb_to_di([(0.87, 0.67, 0.55), (0.62, 0.42, 0.30), (0.40, 0.26, 0.19)])
    sky = srgb_to_di([(0.35, 0.55, 0.85)])
    foliage = srgb_to_di([(0.25, 0.45, 0.15)])
    grey = np.full((1, 3), 0.4)
    gain = lambda px: chroma(tone_reference(px, skin_tone=100)) / chroma(px)
    assert (gain(skins) > 1.3).all()
    assert gain(sky)[0] < 1.02 and gain(foliage)[0] < 1.05
    assert np.allclose(tone_reference(grey, skin_tone=100), grey)


def _balanced(text):
    return text.count("{") == text.count("}") and text.count("(") == text.count(")")


def test_generated_dctl_is_well_formed_and_deterministic():
    a = tone_dctl(highlight=20, shadow=-10, skin_tone=5)
    assert a == tone_dctl(highlight=20, shadow=-10, skin_tone=5)
    assert a != tone_dctl(highlight=21, shadow=-10, skin_tone=5)
    for text in (a, identity_dctl("AZ_FILM"), look_dctl("Nuit", "look.cube", 0.5)):
        assert "__DEVICE__ float3 transform(" in text
        assert _balanced(text)
        assert not re.search(r"\{[a-z_]+(:[^}]*)?\}", text), "placeholder non remplacé"
    assert "HIGHLIGHT = 0.200000f" in a


def test_values_are_clamped():
    assert tone_dctl(highlight=500) == tone_dctl(highlight=100)
    assert "MIX = 1.000000f" in look_dctl("x", "x.cube", 3)
