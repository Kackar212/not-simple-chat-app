#!/bin/bash

# This script unifies multiple Prisma schema files into a single file

# Define source and destination files
SRC_DIR="src/plugins"
DEST_FILE="prisma/schema.prisma"

# Find all Prisma schema files in the source directory
FILES=$(find "$SRC_DIR" -name "*.prisma")

# Function to add model to destination file
add_model_to_file() {
  local model="$1"
  local file="$2"

  # Append model to destination file if not already present
  if ! grep -q "^model $model" "$DEST_FILE" ; then
    echo "Adding model $model to $DEST_FILE"
    echo "model $model {" >> "$DEST_FILE"
    sed -n "/^model $model {/,/^}/{p}" "$file" | grep -v "^model $model {" >> "$DEST_FILE"
  else
    echo "Model $model already exists in $DEST_FILE"
  fi
}

# Loop through each Prisma schema file
for FILE in $FILES ; do
  # Extract models from the current file
  MODELS=$(grep -o -E '^model [A-Z][A-Za-z0-9_]*' "$FILE" | awk '{print $2}')

  # Add each model to the destination file
  for MODEL in $MODELS ; do
    add_model_to_file "$MODEL" "$FILE"
  done
done

# Format the unified Prisma schema
prisma format

# Generate Prisma client
prisma generate

echo "Prisma schema unification complete"