import numpy as np

EPSILON = 0.044  
GAMMA   = 0.006
POWER_MW = 10.0 
LASER_RATE_PER_MW = 300000.0
EFF_ALICE         = 0.09
EFF_BOB           = 0.08
WINDOW_NS         = 3.0
DARK_COUNTS       = 1500.0


def complex_array(arr): return np.array(arr, dtype=complex)
def CT(matrix): return np.conj(np.transpose(matrix))
def Proj(vec): return np.matmul(vec, CT(vec))

# HWP Rotation Logic
def rot(angle): 
    return np.array([[np.cos(angle), -np.sin(angle)], 
                     [np.sin(angle), np.cos(angle)]])

def HWP_Op(angle): 
    # HWP operator: R(theta) * Z * R(-theta)
    return rot(angle) @ np.array([[1, 0], [0, -1]]) @ rot(-1*angle)

vec0 = complex_array([[1],[0]]) # H
vec1 = complex_array([[0],[1]]) # V

# Basis States
State_HV = np.kron(vec0, vec1)
State_VH = np.kron(vec1, vec0)
State_HH = np.kron(vec0, vec0) # We always measure "HH" physically, but after rotation

Psi_Minus = (State_HV - State_VH) / np.sqrt(2)
Rho_Singlet = Proj(Psi_Minus)

Psi_Plus = (State_HV + State_VH) / np.sqrt(2)
Rho_Triplet = Proj(Psi_Plus)

Rho_White = np.eye(4, dtype=complex) / 4.0

def calculate_counts_for_basis(mw, eps, gam, angle_Alice, angle_Bob):
    rho_source = (1 - eps - gam) * Rho_Singlet + (eps * Rho_White) + (gam * Rho_Triplet)
    
    U_A = HWP_Op(angle_Alice)
    U_B = HWP_Op(angle_Bob)

    U_Total = np.kron(U_A, U_B)
    
    Op_Measure = CT(U_Total) @ Proj(State_HH) @ U_Total
    
    Prob_Measured = np.real(np.trace(rho_source @ Op_Measure))
 
    R_laser = mw * LASER_RATE_PER_MW
    R_Alice = (R_laser * EFF_ALICE * 0.5) + DARK_COUNTS
    R_Bob   = (R_laser * EFF_BOB   * 0.5) + DARK_COUNTS
   
    R_true = R_laser * EFF_ALICE * EFF_BOB * Prob_Measured
    R_acc = R_Alice * R_Bob * (WINDOW_NS * 1e-9)
    
    return R_true + R_acc

print(f"Simulation for {POWER_MW} mW | Epsilon={EPSILON} | Gamma={GAMMA}")
print(f"{'Basis':<10} | {'Alice Deg':<10} | {'Bob Deg':<10} | {'Counts (Hz)':<10}")
print("-" * 50)


bases = [
    ("++ (DD)",  22.5,  22.5),
    ("+- (DA)",  22.5, -22.5),
    ("-+ (AD)", -22.5,  22.5),
    ("-- (AA)", -22.5, -22.5)
]

for label, deg_a, deg_b in bases:
    # Convert to radians
    rad_a = np.radians(deg_a)
    rad_b = np.radians(deg_b)
    
    counts = calculate_counts_for_basis(POWER_MW, EPSILON, GAMMA, rad_a, rad_b)
    print(f"{label:<10} | {deg_a:<10.1f} | {deg_b:<10.1f} | {counts:<10.1f}")