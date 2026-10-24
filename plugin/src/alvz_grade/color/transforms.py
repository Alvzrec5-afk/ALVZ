"""Courbes et gamuts publiés : Sony S-Log3 / S-Gamut3(.Cine), DaVinci Wide Gamut /
DaVinci Intermediate, Rec.709 et sRGB.

Sources : « Technical Summary for S-Gamut3.Cine/S-Log3 » (Sony) et
« DaVinci Resolve 17 Wide Gamut Intermediate » (Blackmagic Design).
Toutes les fonctions acceptent des scalaires ou des tableaux numpy.
"""

import numpy as np

D65 = (0.3127, 0.3290)

PRIMARIES = {
    "s_gamut3_cine": ((0.766, 0.275), (0.225, 0.800), (0.089, -0.087)),
    "s_gamut3": ((0.730, 0.280), (0.140, 0.855), (0.100, -0.050)),
    "davinci_wide_gamut": ((0.8000, 0.3130), (0.1682, 0.9877), (0.0790, -0.1155)),
    "rec709": ((0.64, 0.33), (0.30, 0.60), (0.15, 0.06)),
}

# DaVinci Intermediate
DI_A = 0.0075
DI_B = 7.0
DI_C = 0.07329248
DI_M = 10.44426855
DI_LIN_CUT = 0.00262409
DI_LOG_CUT = 0.02740668
DI_MID_GREY = (np.log2(0.18 + DI_A) + DI_B) * DI_C  # ≈ 0.336

# S-Log3
_SL3_CUT_CODE = 171.2102946929 / 1023.0


def slog3_to_linear(x):
    x = np.asarray(x, dtype=np.float64)
    hi = np.power(10.0, (x * 1023.0 - 420.0) / 261.5) * (0.18 + 0.01) - 0.01
    lo = (x * 1023.0 - 95.0) * 0.01125 / (171.2102946929 - 95.0)
    return np.where(x >= _SL3_CUT_CODE, hi, lo)


def linear_to_slog3(y):
    y = np.asarray(y, dtype=np.float64)
    safe = np.maximum(y, 0.01125)
    hi = (420.0 + np.log10((safe + 0.01) / (0.18 + 0.01)) * 261.5) / 1023.0
    lo = (y * (171.2102946929 - 95.0) / 0.01125 + 95.0) / 1023.0
    return np.where(y >= 0.01125, hi, lo)


def di_to_linear(x):
    x = np.asarray(x, dtype=np.float64)
    return np.where(x <= DI_LOG_CUT, x / DI_M, np.power(2.0, x / DI_C - DI_B) - DI_A)


def linear_to_di(y):
    y = np.asarray(y, dtype=np.float64)
    safe = np.maximum(y, DI_LIN_CUT)
    return np.where(y <= DI_LIN_CUT, y * DI_M, (np.log2(safe + DI_A) + DI_B) * DI_C)


def rec709_oetf(y):
    y = np.asarray(y, dtype=np.float64)
    safe = np.maximum(y, 0.018)
    return np.where(y < 0.018, 4.5 * y, 1.099 * np.power(safe, 0.45) - 0.099)


def rec709_inverse_oetf(x):
    x = np.asarray(x, dtype=np.float64)
    safe = np.maximum(x, 0.081)
    return np.where(x < 0.081, x / 4.5, np.power((safe + 0.099) / 1.099, 1.0 / 0.45))


def srgb_to_linear(x):
    x = np.asarray(x, dtype=np.float64)
    safe = np.maximum(x, 0.04045)
    return np.where(x <= 0.04045, x / 12.92, np.power((safe + 0.055) / 1.055, 2.4))


def _xy_to_xyz(xy):
    x, y = xy
    return np.array([x / y, 1.0, (1.0 - x - y) / y])


def rgb_to_xyz_matrix(gamut, white=D65):
    """Matrice 3x3 RGB linéaire -> XYZ pour un gamut de PRIMARIES."""
    prim = np.column_stack([_xy_to_xyz(p) for p in PRIMARIES[gamut]])
    scale = np.linalg.solve(prim, _xy_to_xyz(white))
    return prim * scale


def gamut_matrix(src, dst):
    """Matrice 3x3 RGB linéaire `src` -> RGB linéaire `dst` (même blanc D65)."""
    return np.linalg.inv(rgb_to_xyz_matrix(dst)) @ rgb_to_xyz_matrix(src)


def apply_matrix(rgb, m):
    rgb = np.asarray(rgb, dtype=np.float64)
    return rgb @ np.asarray(m).T


def slog3_sgamut3cine_to_di(rgb):
    """Code S-Log3 / S-Gamut3.Cine -> DWG / DI : le CST in de STV, sans tone mapping."""
    lin = apply_matrix(slog3_to_linear(rgb), gamut_matrix("s_gamut3_cine", "davinci_wide_gamut"))
    return linear_to_di(lin)
