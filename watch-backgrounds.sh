#!/bin/bash

# Directory to monitor
BACKGROUNDS_DIR="backgrounds"
OUTPUT_FILE="backgrounds/backgrounds.txt"

# Function to generate the file list
generate_list() {
    echo "Updating background list..."
    ls -1 "$BACKGROUNDS_DIR" | grep -E '\.(jpg|jpeg|png|gif|webp|bmp)$' > "$OUTPUT_FILE"
    echo "Background list updated at $(date)"
}

# Generate initial list
generate_list

# Watch for changes and regenerate on any modification
# Using inotifywait to monitor for file creation, deletion, and modification
inotifywait -m -r -e create -e delete -e moved_to -e moved_from "$BACKGROUNDS_DIR" |
while read path action file; do
    # Ignore changes to backgrounds.txt itself
    if [ "$file" != "backgrounds.txt" ]; then
        generate_list
    fi
done
