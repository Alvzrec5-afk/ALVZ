import numpy as np
import pytest

from alvz_grade.color import transforms as t
from alvz_grade.color.cdl import apply_cdl, sliders_to_cdl


def test_slog3_mid_grey_matches_sony_spec():
    # Sony : 18 % gris -> code 10 bits 420
    assert t.linear_to_slog3(0.18) == pytest.approx(420 / 1023, abs=1e-9)
    assert t.slog3_to_linear(420 / 1023) == pytest.approx(0.18, abs=1e-9)


def test_slog3_round_trip_and_continuity():
    lin = np.linspace(-0.01, 10, 2001)
    assert np.allclose(t.slog3_to_linear(t.linear_to_slog3(lin)), lin, atol=1e-9)
    cut = 0.01125
    assert t.linear_to_slog3(cut - 1e-9) == pytest.approx(t.linear_to_slog3(cut + 1e-9), abs=1e-6)


def test_di_mid_grey_and_round_trip():
    assert t.DI_MID_GREY == pytest.approx(0.336, abs=5e-4)
    lin = np.linspace(-0.01, 100, 5001)
    assert np.allclose(t.di_to_linear(t.linear_to_di(lin)), lin, atol=1e-7, rtol=1e-7)
    # les deux morceaux se rejoignent au point de coupure
    assert t.linear_to_di(t.DI_LIN_CUT) == pytest.approx(t.DI_LOG_CUT, abs=1e-6)


def test_rec709_to_xyz_known_matrix():
    m = t.rgb_to_xyz_matrix("rec709")
    assert np.allclose(m[0], [0.4124, 0.3576, 0.1805], atol=2e-4)
    assert np.allclose(m[1], [0.2126, 0.7152, 0.0722], atol=2e-4)


@pytest.mark.parametrize("src", ["s_gamut3_cine", "s_gamut3", "rec709"])
def test_gamut_matrices_keep_white(src):
    m = t.gamut_matrix(src, "davinci_wide_gamut")
    assert np.allclose(m.sum(axis=1), 1.0, atol=1e-9)
    assert np.allclose(t.gamut_matrix(src, src), np.eye(3), atol=1e-12)


def test_cst_in_maps_slog3_grey_to_di_grey():
    grey = np.full(3, 420 / 1023)
    assert np.allclose(t.slog3_sgamut3cine_to_di(grey), t.DI_MID_GREY, atol=1e-6)


def test_neutral_sliders_are_identity():
    cdl = sliders_to_cdl()
    rgb = np.random.default_rng(1).uniform(0, 1, (100, 3))
    assert np.allclose(apply_cdl(rgb, cdl), rgb)
    assert cdl.to_resolve(2) == {"NodeIndex": "2", "Slope": "1.000000 1.000000 1.000000",
                                 "Offset": "0.000000 0.000000 0.000000",
                                 "Power": "1.000000 1.000000 1.000000", "Saturation": "1.000000"}


def test_exposure_is_exact_stops_in_di():
    grey = np.full(3, t.DI_MID_GREY)
    out = apply_cdl(grey, sliders_to_cdl(exposure=1.0))
    assert np.allclose(t.di_to_linear(out), 2 * 0.18 + t.DI_A, atol=1e-6)


def test_contrast_pivots_on_mid_grey():
    cdl = sliders_to_cdl(contrast=1.5)
    assert np.allclose(apply_cdl(np.full(3, t.DI_MID_GREY), cdl), t.DI_MID_GREY)
    bright = apply_cdl(np.full(3, 0.6), cdl)[0]
    dark = apply_cdl(np.full(3, 0.2), cdl)[0]
    assert bright > 0.6 and dark < 0.2


def test_white_balance_directions():
    warm = sliders_to_cdl(temperature=50).offset
    assert warm[0] > 0 > warm[2] and warm[1] == 0
    magenta = sliders_to_cdl(tint=50).offset
    assert magenta[1] < 0 < magenta[0] and magenta[0] == magenta[2]
