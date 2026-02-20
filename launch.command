#!/bin/bash

# 1. Get the directory where this script is located and move there
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Checking environment for QPE Simulator..."

# 2. Check if the virtual environment exists
# We check for 'venv' (standard) or '.venv' (hidden)
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "Virtual environment not found. Running First-Time Setup..."
    
    # Create virtual environment (naming it 'venv')
    python3 -m venv venv
    
    # Activate it
    source venv/bin/activate
    
    # Install dependencies
    if [ -f "requirements.txt" ]; then
        echo "Installing dependencies..."
        pip install -r requirements.txt
    else
        echo "Warning: requirements.txt not found in $DIR"
    fi
    
    echo "Setup complete."

else
    # If it exists, just activate it
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    else
        source venv/bin/activate
    fi
fi

# 3. Run the application
echo "Starting QPE Simulation..."
# Try python, fallback to python3 if 'python' isn't aliased
python interface.py || python3 interface.py

# Optional: Keep window open if the app crashes so you can see the error
if [ $? -ne 0 ]; then
    echo "The application encountered an error."
    read -p "Press Enter to close..."
fi