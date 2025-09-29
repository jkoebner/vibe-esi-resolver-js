#!/bin/bash
echo "Setting up ESI Resolver development environment..."

# Create icon placeholders if they don't exist
for size in 16 48 128; do
    for state in on off; do
        icon="icon${size}-${state}.png"
        if [ ! -f "$icon" ]; then
            echo "⚠️  Missing: $icon (please add your icon files)"
        fi
    done
done

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your icon files (icon*-on.png and icon*-off.png)"
echo "2. Update manifest.json with your details"
echo "3. Test in browser using 'Load unpacked' or 'Load temporary add-on'"
echo "4. Run 'git add . && git commit -m \"Initial commit\"' to save"