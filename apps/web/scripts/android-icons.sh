#!/bin/sh
# WW-1605: Android launcher icons and the home-screen icons for the web app,
# all from art/ui/app_icon.png. Uses macOS `sips` only. Run from anywhere:
#   sh apps/web/scripts/android-icons.sh
#
# Adaptive icons (Android 8+) draw a 108dp foreground over a solid background
# and mask it to the launcher's shape; only the middle 66dp is always shown.
# The medallion fills about 70% of the art, so the art is scaled to 90dp and
# padded with its own edge purple: the gold ring (about 63dp) stays inside the
# safe zone and the padding blends into the background color.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
web=$(cd "$here/.." && pwd)
src="$web/../../art/ui/app_icon.png"
res="$web/android/app/src/main/res"
public="$web/public"
edge=160350 # the art's edge purple, also the adaptive background

[ -f "$src" ] || { echo "missing $src" >&2; exit 1; }

resize() { # size out
  sips -s format png -z "$1" "$1" "$src" --out "$2" >/dev/null
}

# density legacy-px foreground-px
for row in "mdpi 48 108" "hdpi 72 162" "xhdpi 96 216" "xxhdpi 144 324" "xxxhdpi 192 432"; do
  set -- $row
  dir="$res/mipmap-$1"
  resize "$2" "$dir/ic_launcher.png"
  resize "$2" "$dir/ic_launcher_round.png"
  inner=$(( $3 * 90 / 108 ))
  resize "$inner" "$dir/ic_launcher_foreground.png"
  sips --padToHeightWidth "$3" "$3" --padColor "$edge" "$dir/ic_launcher_foreground.png" >/dev/null 2>&1
done

cat > "$res/values/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#$(echo $edge | tr 'a-f' 'A-F')</color>
</resources>
EOF

mkdir -p "$public"
resize 192 "$public/icon-192.png"
resize 512 "$public/icon-512.png"
resize 180 "$public/apple-touch-icon.png"

echo "icons written to $res and $public"
