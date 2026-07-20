import numpy as np

def complex_array(arr):
    return np.array(arr, dtype=complex)

def rot(angle): 
    """2D Rotation Matrix"""
    c = np.cos(angle)
    s = np.sin(angle)
    return np.array([[c, -s], [s, c]])

def HWP(angle): 
    """Half-wave plate rotation matrix: R(theta) * Z * R(-theta)"""
    return rot(angle) @ np.array([[1, 0], [0, -1]]) @ rot(-1*angle)

def QWP(angle): 
    """Quarter-wave plate rotation matrix: R(theta) * S * R(-theta)"""
    return rot(angle) @ np.array([[1, 0], [0, -1j]]) @ rot(-1*angle)

# --- CONFIGURATION ---
hwp_deg = 22.5
qwp_deg = 45

# --- CALCULATION ---
hwp_rad = np.radians(hwp_deg)
qwp_rad = np.radians(qwp_deg)

# The total transformation matrix W
W = HWP(hwp_rad) @ QWP(qwp_rad)

# Define Input State (e.g., Horizontal)
vec_H = np.array([[1], [0]], dtype=complex)
vec_V = np.array([[0], [1]], dtype=complex)

vec_D = 1/np.sqrt(2) * np.array([[1], [1]], dtype=complex)
vec_A = 1/np.sqrt(2) * np.array([[1], [-1]], dtype=complex)

vec_R = 1/np.sqrt(2) * np.array([[1], [1j]], dtype=complex)
vec_L = 1/np.sqrt(2) * np.array([[1], [-1j]], dtype=complex)

vec_1 = vec_D
vec_2 = vec_A

# Calculate Output State
output_state_1 = W @ vec_1
output_state_2 = W @ vec_2

# --- OUTPUT ---
print("-" * 30)
print(f"Angles: HWP={hwp_deg}°, QWP={qwp_deg}°")
print("-" * 30)

print("\nTransformation Matrix W:")
# Print with nice formatting (2 decimal places)
with np.printoptions(precision=3, suppress=True):
    print(W)
    print("")
    print(output_state_1)
    print("")
    print(output_state_2)

"""with np.printoptions(precision=3, suppress=True):
    print(HWP(np.radians(22.5)))

    print("")
    print(output_state)"""

"""# Calculate probabilities
prob_H = np.abs(np.vdot(vec_H, output_state))**2
prob_V = np.abs(np.vdot(vec_V, output_state))**2"""

"""print(f"\nProbabilities:")
print(f"P(H): {prob_H:.4f}")
print(f"P(V): {prob_V:.4f}")"""