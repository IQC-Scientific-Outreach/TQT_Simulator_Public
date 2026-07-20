# TQT Photonic Quantum Technologies — Simulator

A Python simulator for the TQT Photonic Quantum Optics experiment at RAC

The simulator models a polarization-entangled photon pair source and two detection stations (Alice and Bob). The GUI lets you explore quantum optics concepts interactively:

- **Laser & source**: Turn the pump laser on/off and set its power. Choose between a tunable Sagnac entangled-pair source or fixed "mystery" sources with unknown polarization states.
- **Half-wave plate (HWP)**: Rotates the polarization state of a photon. Rotating the HWP by an angle θ rotates the polarization by 2θ. Used to select a measurement basis (e.g. Z, X, or Y).
- **Quarter-wave plate (QWP)**: Introduces a 90° phase shift between polarization components, converting linear polarization to elliptical/circular and vice versa. Together with the HWP, it gives full control over any polarization measurement basis.
- **Singles & coincidences**: Real-time photon count rates for each detector channel (singles) and simultaneous detections across pairs of channels (coincidences).
- **Expectation values**: Computed correlations between Alice and Bob's measurements — useful for verifying entanglement and exploring Bell inequalities.
- **Histogram**: Cross-correlation timing histogram between two channels, used to identify coincidence peaks and optimize timing windows.

## Run online — no install

A fully browser-based version runs the same physics with nothing to install:
just open the hosted link (GitHub Pages). See [`web/README.md`](web/README.md)
for how it works and how to deploy it. To run it locally:

```bash
cd web
python3 -m http.server 8000   # then open http://localhost:8000
```

## Installation & Setup (desktop app)

### Windows (Clickable)
> **Important:** Extract the `.zip` folder before starting.
1. Open the `setup` folder and double-click **`install.bat`**.
2. Go back to the main folder and double-click **`run.bat`**.

### macOS (Clickable)
1. Open Terminal and `cd` to the downloaded folder.
2. Fix permissions:
   ```bash
   xattr -c setup/*.command && chmod +x setup/*.command
   xattr -c *.command && chmod +x *.command
   ```
3. Open `setup/` and double-click **`install.command`**.
4. Go back to the main folder and double-click **`run.command`**.

### Windows (Command Prompt)
```bat
cd setup
install.bat
cd ..
run.bat
```

### macOS (Terminal)
```bash
cd setup
./install.command
cd ..
./run.command
```

## Main files

| File | Description |
|------|-------------|
| `interface.py` | Main GUI — launch this to run the simulator |
| `experiment.py` | High-level experiment controller (simulation backend) |
| `example.ipynb` | Scripted measurement examples |

# TQT Photonic Quantum Technologies — Simulator

A Python simulator for the TQT Photonic Quantum Optics experiment at RAC

The simulator models a polarization-entangled photon pair source and two detection stations (Alice and Bob). The GUI lets you explore quantum optics concepts interactively:

- **Laser & source**: Turn the pump laser on/off and set its power. Choose between a tunable Sagnac entangled-pair source or fixed "mystery" sources with unknown polarization states.
- **Half-wave plate (HWP)**: Rotates the polarization state of a photon. Rotating the HWP by an angle θ rotates the polarization by 2θ. Used to select a measurement basis (e.g. Z, X, or Y).
- **Quarter-wave plate (QWP)**: Introduces a 90° phase shift between polarization components, converting linear polarization to elliptical/circular and vice versa. Together with the HWP, it gives full control over any polarization measurement basis.
- **Singles & coincidences**: Real-time photon count rates for each detector channel (singles) and simultaneous detections across pairs of channels (coincidences).
- **Expectation values**: Computed correlations between Alice and Bob's measurements — useful for verifying entanglement and exploring Bell inequalities.
- **Histogram**: Cross-correlation timing histogram between two channels, used to identify coincidence peaks and optimize timing windows.

## Installation & Setup

### Windows (Clickable)
> **Important:** Extract the `.zip` folder before starting.
1. Open the `setup` folder and double-click **`install.bat`**.
2. Go back to the main folder and double-click **`run.bat`**.

### macOS (Clickable)
1. Open Terminal and `cd` to the downloaded folder.
2. Fix permissions:
   ```bash
   xattr -c setup/*.command && chmod +x setup/*.command
   xattr -c *.command && chmod +x *.command
   ```
3. Open `setup/` and double-click **`install.command`**.
4. Go back to the main folder and double-click **`run.command`**.

### Windows (Command Prompt)
```bat
cd setup
install.bat
cd ..
run.bat
```

### macOS (Terminal)
```bash
cd setup
./install.command
cd ..
./run.command
```

## Main files

| File | Description |
|------|-------------|
| `interface.py` | Main GUI — launch this to run the simulator |
| `experiment.py` | High-level experiment controller (simulation backend) |
| `example.ipynb` | Scripted measurement examples |
