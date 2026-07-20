"""
Web bridge for the TQT photonics simulator.

This is the browser-side replacement for ``experiment_public.py``. It wires the
same simulation drivers together but drops everything that needs a real
filesystem or extra dependencies (``ruamel.yaml``, ``importlib``, ``pandas``,
``tqdm``): config lives in a plain dict, and the histogram works on in-memory
tags instead of writing/reading a file.

Every public method returns plain Python types (numbers, lists, dicts) so that
Pyodide converts them cleanly to JavaScript.
"""

import numpy as np

from timetagger_uqd_sim import TimeTagger, BIN_RESOLUTION_NS
from laser_toptica_sim import TOpticaLaser
from powermeter_thorlabs_sim import PowerMeter


# Defaults mirror config.yaml from the desktop release.
DEFAULT_CONFIG = {
    "LASER_POWER": 10.0,
    "COINCIDENCE_WINDOW_NS": 3.0,
    "TIMETAGGER_CHANNEL_DELAYS": [10.0] + [0.0] * 15,
}


class WebSimulator:
    """Mirror of ``QuantumOpticalExperiment(simulation=True)`` for the browser."""

    def __init__(self):
        self.config = dict(DEFAULT_CONFIG)
        self.config["TIMETAGGER_CHANNEL_DELAYS"] = list(
            DEFAULT_CONFIG["TIMETAGGER_CHANNEL_DELAYS"]
        )

        self.laser = TOpticaLaser(port="COM_SIM")
        self.powermeter = PowerMeter(visa_address="SIM")
        self.timetagger = TimeTagger()

        self.timetagger.get_info()
        self.timetagger.switch_logic()

        # Link the virtual devices, exactly like the desktop experiment does.
        self.powermeter.attach_laser(self.laser)
        self.timetagger.attach_laser(self.laser)

        # Apply config defaults to the timetagger.
        self.timetagger.set_window_width(self.config["COINCIDENCE_WINDOW_NS"])
        self.timetagger.set_channel_time_delays(self.config["TIMETAGGER_CHANNEL_DELAYS"])
        self.laser.set_power(self.config["LASER_POWER"])

    # ------------------------------------------------------------------ laser
    def laser_on(self):
        self.laser.on()

    def laser_off(self):
        self.laser.off()

    def set_laser_power(self, power):
        self.laser.set_power(float(power))

    def get_power_mw(self):
        return self.powermeter.get_power() * 1000.0  # W -> mW

    # -------------------------------------------------------------- timetagger
    def read(self, duration_s):
        self.timetagger.read(float(duration_s))

    def get_count(self, channels):
        """Return just the integer count for a channel pattern."""
        _, count, _ = self.timetagger.get_count_data(list(channels))
        return int(count)

    def get_counts_batch(self, patterns):
        """Counts for many patterns in one call (one JS<->Py hop per refresh)."""
        return [self.get_count(list(p)) for p in patterns]

    def set_window(self, window):
        self.timetagger.set_window_width(float(window))
        self.config["COINCIDENCE_WINDOW_NS"] = float(window)

    def set_delays(self, delays):
        delays = [float(d) for d in delays]
        self.timetagger.set_channel_time_delays(delays)
        self.config["TIMETAGGER_CHANNEL_DELAYS"] = delays

    # ------------------------------------------------------------ polarization
    def set_source_hwp(self, angle_deg):
        self.timetagger.set_source_hwp(np.deg2rad(float(angle_deg)))

    def set_source_type(self, index):
        self.timetagger.set_source_type(int(index))

    def set_waveplates(self, name, hwp_deg, qwp_deg):
        self.timetagger.set_waveplates(
            name, np.deg2rad(float(hwp_deg)), np.deg2rad(float(qwp_deg))
        )

    def toggle_qwp(self, name, enabled):
        for party in self.timetagger.parties:
            if party.name.lower() == str(name).lower():
                if party.has_qwp != bool(enabled):
                    party.qwp_toggle()
                break

    def get_parties(self):
        out = []
        for p in self.timetagger.parties:
            out.append(
                {
                    "name": p.name,
                    "channels": list(p.channels),
                    "hwp_deg": float(np.degrees(p.hwp_angle)),
                    "qwp_deg": float(np.degrees(p.qwp_angle)),
                    "has_qwp": bool(p.has_qwp),
                }
            )
        return out

    # -------------------------------------------------------------- ambient
    def set_lights(self, lights_on):
        if hasattr(self.timetagger, "set_ambient_light"):
            self.timetagger.set_ambient_light(bool(lights_on))

    # ------------------------------------------------------------- histogram
    def histogram(self, meas_time, ch_a, ch_b, bin_width, hist_width):
        """
        Cross-correlation timing histogram, computed entirely in memory.

        Mirrors the desktop flow (generate physics-based tags -> cross
        correlate -> shift by the hardware delay difference) but skips the
        write-to-disk / reload-from-disk round trip.
        """
        ch_a = int(ch_a)
        ch_b = int(ch_b)
        tags = self._generate_tags(float(meas_time))

        if tags.shape[0] == 0:
            return {"x": [], "hist": [], "window_center": 0.0, "radius": 0.0}

        hist, hist_x = _cross_correlation_histogram(
            tags, ch_a=ch_a, ch_b=ch_b,
            bin_width=float(bin_width), hist_width=float(hist_width),
        )

        delays = self.config["TIMETAGGER_CHANNEL_DELAYS"]
        delay_a = delays[ch_a - 1] if 1 <= ch_a <= 16 else 0.0
        delay_b = delays[ch_b - 1] if 1 <= ch_b <= 16 else 0.0
        hardware_shift = delay_b - delay_a
        real_hist_x = hist_x - hardware_shift
        window_center = delay_a - delay_b
        radius = self.config["COINCIDENCE_WINDOW_NS"]

        return {
            "x": real_hist_x.tolist(),
            "hist": hist.tolist(),
            "window_center": float(window_center),
            "radius": float(radius),
        }

    def _generate_tags(self, meas_time):
        """In-memory tags for the histogram — delegates to the shared generator
        in TimeTagger so the physics stays defined in exactly one place."""
        return self.timetagger.generate_tag_array(float(meas_time))


def _cross_correlation_histogram(tags, ch_a=1, ch_b=2, bin_width=1.0, hist_width=30.0):
    """Slim copy of tqt.analysis.histogram (no tqdm / IO import)."""
    from math import floor, ceil

    a = tags[(tags[:, 0] == ch_a), 1]
    b = tags[(tags[:, 0] == ch_b), 1]
    if a.shape[0] == 0 or b.shape[0] == 0:
        n_bins = ceil(2 * hist_width / bin_width)
        return np.zeros(n_bins), np.linspace(-hist_width, hist_width, n_bins)

    n_bins = ceil(2 * hist_width / bin_width)
    hist = np.zeros(n_bins)
    hist_bins = np.linspace(-hist_width, hist_width, n_bins)

    start_ind = 0
    j = 0
    for i in range(a.shape[0]):
        a_t = a[i]
        while j < b.shape[0]:
            b_t = b[j]
            dt = (b_t - a_t) * BIN_RESOLUTION_NS  # [ns]
            if dt < -hist_width:
                start_ind = j
            elif dt > hist_width:
                break
            else:
                bin_ind = floor((dt + hist_width) / bin_width)
                if bin_ind < hist.shape[0]:
                    hist[bin_ind] += 1
            j += 1
        j = start_ind

    return hist, hist_bins


# A single module-level instance the JS layer talks to.
sim = WebSimulator()
