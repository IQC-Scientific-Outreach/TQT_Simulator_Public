import numpy as np

def get_channel_counts(self):
    """
    Generates an array of 16 floats representing the probability/count 
    for each channel during the window [current_time, current_time + self._last_dt].
    """
    results = []

    for i in range(self._num_channels):
        # Retrieve channel specific stats
        delay = self.delays[i]
        efficiency = self.channel_efficiencies[i]

        # LOGIC:
        # The channel is only active after t >= delay.
        # We find the intersection of the "Active Time" and the "Measurement Window".
        
        # 1. When does the channel effectively start working in this window?
        #    It's the later of the Window Start OR the Delay time.
        effective_start = max(0, delay)
        
        # 2. How long is it active? 
        #    End of window - Effective Start. 
        #    max(0, ...) handles cases where the channel hasn't started yet (result negative).
        active_duration = max(0.0, self._last_dt - effective_start)
        
        # 3. What fraction of the window is this?
        time_fraction = active_duration / self._last_dt
        
        # 4. Final Calculation
        value = efficiency * time_fraction
        results.append(round(value, 2))

    return results

# ==========================================
# CONFIGURATION
# ==========================================

# 1. Initialize arrays for 16 channels
#    Default: 0 delay, 100% efficiency
delays = [0.0] * 16
efficiencies = [1.0] * 16

# 2. Apply your specific test case to Channel 2 (Index 1)
#    "Channel 2 has delay of 10 seconds, and efficiency of 50"
delays[1] = 10.0       
efficiencies[1] = 0.5  

# 3. Add random delays/efficiencies to other channels for demonstration
delays[0] = 2.0        # Ch 1: starts after 2s
efficiencies[0] = 0.8  # Ch 1: 80% efficient
delays[15] = 5.0       # Ch 16: starts after 5s

# 4. Simulation settings
base_counts = 1
t_interval = 3.0       # "Time interval t is 3 seconds"
current_sim_time = 0.0

# ==========================================
# EXECUTION LOOP
# ==========================================

print(f"{'Interval':<10} | {'Window':<12} | Full Array (Ch1-16)")
print("-" * 100)

for step in range(1, 7): # Run for 6 steps
    
    # Calculate for all 16 channels
    probs = get_all_channel_probabilities(
        current_sim_time, 
        t_interval, 
        delays, 
        efficiencies, 
        base_counts
    )
    
    # Formatting for display
    window_str = f"{current_sim_time:.0f}-{current_sim_time+t_interval:.0f}s"
    
    print(f"{step}t{'':<8} | {window_str:<12} | {probs}")
    
    # Increment time
    current_sim_time += t_interval