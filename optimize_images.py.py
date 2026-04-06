"""
Pets Unplugged — Image Optimization Script
==========================================
Converts all JPG/PNG images in /assets/images/ to WebP format,
then updates all HTML/MD files to reference the new .webp filenames.

Requirements:
    pip install Pillow

Usage:
    1. Place this script in the ROOT of your repo
       (pets-unplugged.github.io/)
    2. Run: python optimize_images.py
    3. Review the output summary
    4. git add -A && git commit -m "Optimize images to WebP" && git push
"""

import os
import shutil
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow")
    exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
IMAGES_DIR = Path("assets/images")
SITE_EXTENSIONS = [".html", ".md", ".yml", ".xml"]
WEBP_QUALITY = 85          # 85 is excellent quality with ~70% size reduction
SKIP_FILES = {"favicon.ico", "LOGO_MAX.svg"}  # never convert these
MAX_WIDTH = 1200           # resize if wider than this (keeps aspect ratio)
# ─────────────────────────────────────────────────────────────────────────────

converted = []
skipped = []
errors = []
total_saved = 0


def format_kb(bytes_val):
    return f"{bytes_val / 1024:.0f} KB"


def convert_image(src_path: Path):
    global total_saved

    if src_path.name in SKIP_FILES:
        skipped.append(str(src_path))
        return

    if src_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
        skipped.append(str(src_path))
        return

    dest_path = src_path.with_suffix(".webp")

    # Skip if WebP already exists and is newer
    if dest_path.exists() and dest_path.stat().st_mtime > src_path.stat().st_mtime:
        skipped.append(f"{src_path.name} (already up to date)")
        return

    try:
        original_size = src_path.stat().st_size

        with Image.open(src_path) as img:
            # Convert RGBA/P mode images properly
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

            # Resize if too large (keeps aspect ratio)
            if img.width > MAX_WIDTH:
                ratio = MAX_WIDTH / img.width
                new_height = int(img.height * ratio)
                img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)
                print(f"  ↕  Resized {src_path.name}: {img.width}x{img.height}")

            img.save(dest_path, "WEBP", quality=WEBP_QUALITY, method=6)

        new_size = dest_path.stat().st_size
        saved = original_size - new_size
        total_saved += saved

        converted.append({
            "original": src_path.name,
            "webp": dest_path.name,
            "before": original_size,
            "after": new_size,
            "saved": saved,
            "pct": int((saved / original_size) * 100) if original_size > 0 else 0
        })

        print(f"  ✅ {src_path.name} → {dest_path.name} "
              f"({format_kb(original_size)} → {format_kb(new_size)}, "
              f"-{int((saved/original_size)*100)}%)")

    except Exception as e:
        errors.append(f"{src_path.name}: {e}")
        print(f"  ❌ Error converting {src_path.name}: {e}")


def update_references():
    """Update all HTML/MD files to use .webp extensions."""
    updated_files = []
    root = Path(".")

    # Build replacement map: old_name → new_name
    replacements = {}
    for item in converted:
        original = item["original"]
        webp = item["webp"]
        # Handle both /assets/images/file.jpg and just file.jpg references
        for ext in [".jpg", ".jpeg", ".png"]:
            if original.lower().endswith(ext):
                replacements[original] = webp
                # Also handle URL-encoded spaces
                replacements[original.replace(" ", "%20")] = webp.replace(" ", "%20")

    if not replacements:
        print("\nNo replacements needed.")
        return

    for ext in SITE_EXTENSIONS:
        for filepath in root.rglob(f"*{ext}"):
            # Skip vendor/node_modules directories
            if any(p in filepath.parts for p in ["vendor", "node_modules", ".jekyll-cache", "_site"]):
                continue

            try:
                content = filepath.read_text(encoding="utf-8")
                new_content = content

                for old_name, new_name in replacements.items():
                    new_content = new_content.replace(old_name, new_name)

                if new_content != content:
                    filepath.write_text(new_content, encoding="utf-8")
                    updated_files.append(str(filepath))
                    print(f"  📝 Updated references in: {filepath}")

            except Exception as e:
                print(f"  ⚠️  Could not update {filepath}: {e}")

    return updated_files


def main():
    print("\n🐾 Pets Unplugged — Image Optimization")
    print("=" * 50)

    if not IMAGES_DIR.exists():
        print(f"ERROR: {IMAGES_DIR} not found. Run this from the repo root.")
        exit(1)

    # Step 1: Convert all images
    print(f"\n📸 Converting images in {IMAGES_DIR}...\n")
    image_files = list(IMAGES_DIR.iterdir())

    for img_path in sorted(image_files):
        if img_path.is_file():
            convert_image(img_path)

    # Step 2: Update HTML/MD references
    print(f"\n📝 Updating file references...\n")
    updated = update_references()

    # Step 3: Summary
    print("\n" + "=" * 50)
    print("✨ OPTIMIZATION COMPLETE")
    print("=" * 50)
    print(f"\n✅ Converted:     {len(converted)} images")
    print(f"⏭️  Skipped:       {len(skipped)} files")
    print(f"❌ Errors:        {len(errors)}")
    print(f"💾 Total saved:   {format_kb(total_saved)} ({total_saved / 1024 / 1024:.1f} MB)")

    if converted:
        print("\n📊 Conversion details:")
        for item in sorted(converted, key=lambda x: x["saved"], reverse=True):
            print(f"   {item['original']:45s} {format_kb(item['before']):>8} → {format_kb(item['after']):>8}  (-{item['pct']}%)")

    if errors:
        print("\n❌ Errors:")
        for e in errors:
            print(f"   {e}")

    print("\n⚠️  IMPORTANT — Original files kept alongside WebP versions.")
    print("   After verifying the site looks good locally, you can")
    print("   optionally delete the originals to save repo space.")
    print("\n🚀 Next steps:")
    print("   git add -A")
    print('   git commit -m "Optimize images to WebP format"')
    print("   git push")
    print()


if __name__ == "__main__":
    main()