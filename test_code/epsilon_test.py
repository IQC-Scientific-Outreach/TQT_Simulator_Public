import numpy as np

EPSILON = 0.03915 
GAMMA   = 0.006

LASER_RATE_PER_MW = 300000.0  # Pairs per second per mW
EFF_ALICE         = 0.09      # 9% Efficiency
EFF_BOB           = 0.08      # 8% Efficiency
WINDOW_NS         = 3.0       # 3ns Coincidence Window
DARK_COUNTS       = 1500.0    # Hz (Lights Off)


EXP_DATA = {
    1: 23,
    5: 110,
    10: 240,
    20: 620,
    30: 1170
}

def complex_array(arr): return np.array(arr, dtype=complex)
def CT(matrix): return np.conj(np.transpose(matrix))
def Proj(vec): return np.matmul(vec, CT(vec))

vec0 = complex_array([[1],[0]]) # Horizontal
vec1 = complex_array([[0],[1]]) # Vertical

# Basis States
State_HV = np.kron(vec0, vec1) # Alice H, Bob V
State_VH = np.kron(vec1, vec0) # Alice V, Bob H
State_HH = np.kron(vec0, vec0) # Alice H, Bob H (The forbidden one)

# 1. Singlet State (|HV> - |VH>) / sqrt(2)
Psi_Minus = (State_HV - State_VH) / np.sqrt(2)
Rho_Singlet = Proj(Psi_Minus)

# 2. Triplet State (|HV> + |VH>) / sqrt(2)
Psi_Plus = (State_HV + State_VH) / np.sqrt(2)
Rho_Triplet = Proj(Psi_Plus)

# 3. White Noise (Identity / 4)
Rho_White = np.eye(4, dtype=complex) / 4.0

# --- 4. The Calculation Function ---
def calculate_model_counts(mw, eps, gam):

    rho = (1 - eps - gam) * Rho_Singlet + (eps * Rho_White) + (gam * Rho_Triplet)
    Op_HH = Proj(State_HH)
    Prob_HH = np.real(np.trace(rho @ Op_HH))

    R_laser = mw * LASER_RATE_PER_MW
    
    R_Alice = (R_laser * EFF_ALICE * 0.5) + DARK_COUNTS
    R_Bob   = (R_laser * EFF_BOB   * 0.5) + DARK_COUNTS
 
    R_true = R_laser * EFF_ALICE * EFF_BOB * Prob_HH

    R_acc = R_Alice * R_Bob * (WINDOW_NS * 1e-9)
    
    return R_true + R_acc

print(f"{'Power (mW)':<12} | {'Exp Counts':<12} | {'Sim Model':<12} | {'Diff':<12}")
print("-" * 55)

for mw, exp_val in EXP_DATA.items():
    sim_val = calculate_model_counts(mw, EPSILON, GAMMA)
    diff = (sim_val - exp_val)/exp_val * 100.0
    print(f"{mw:<12} | {exp_val:<12} | {sim_val:<12.1f} | {diff:<12.1f}")

print("-" * 55)
print(f"Parameters Used: Epsilon (White)={EPSILON}, Gamma (Triplet)={GAMMA}")
"""diff_avg = 0
for mw, exp_val in EXP_DATA.items():
    sim_val = calculate_model_counts(mw, EPSILON, GAMMA)
    diff = (sim_val - exp_val)/exp_val * 100.0
    diff_avg += np.abs(diff)
print(EPSILON, diff_avg / 5)"""