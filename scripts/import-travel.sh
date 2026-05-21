#!/usr/bin/env bash
# import-travel.sh — import a batch of raw photos into a travel page.
#
# usage:
#   scripts/import-travel.sh <travel-name> <source-dir> [--geocode] [--append]
#
# what it does:
#   1. sort source *.jpg/*.JPG by EXIF capture date (oldest first)
#   2. move to images/travels/<name>/, renamed 1.jpg .. N.jpg
#   3. sips -Z 1600 (long-edge resize, 85% q) on each
#   4. generate 200px thumbs in images/travels/<name>/thumbs/
#   5. emit a frontmatter `photos:` snippet to stdout
#
# flags:
#   --geocode    reverse-geocode each photo's EXIF GPS via OpenStreetMap
#                Nominatim (1 req/sec, free, no key) and append a
#                "location · altitude" caption to each line.
#   --append     write the snippet directly into content/travels/<name>.md,
#                inserting before the closing `---` of its frontmatter.
#                creates a stub md if the file doesn't exist.
#
# requires: macOS (sips, mdls), curl, python3.  no other deps.

set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }
log() { echo "→ $*" >&2; }

# ── args ────────────────────────────────────────────────────────────
[[ $# -lt 2 ]] && die "usage: $0 <travel-name> <source-dir> [--geocode] [--append]"
NAME="$1"; SRC="$2"; shift 2
GEOCODE=0; APPEND=0
for arg in "$@"; do
  case "$arg" in
    --geocode) GEOCODE=1 ;;
    --append)  APPEND=1 ;;
    *) die "unknown flag: $arg" ;;
  esac
done

[[ -d "$SRC" ]] || die "source dir not found: $SRC"

# Resolve repo root from this script's location so the script works from any cwd.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/images/travels/$NAME"
THUMBS="$DEST/thumbs"
MD="$ROOT/content/travels/$NAME.md"

[[ -d "$DEST" && -n "$(ls -A "$DEST" 2>/dev/null | grep -v '^thumbs$' || true)" ]] \
  && die "destination already has files: $DEST (move or delete first)"

mkdir -p "$DEST" "$THUMBS"

# ── 1+2. sort + rename + move ───────────────────────────────────────
log "sorting source photos by EXIF date…"
# Emit "<date>|<file>" for every jpg, sort by date, awk renames into DEST.
# Falls back to file mtime when EXIF date is missing.
COUNT=$(cd "$SRC" && \
  for f in *.[Jj][Pp][Gg] *.[Jj][Pp][Ee][Gg]; do
    [[ -e "$f" ]] || continue
    d=$(mdls -raw -name kMDItemContentCreationDate "$f" 2>/dev/null)
    [[ "$d" == "(null)" || -z "$d" ]] && d=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$f")
    printf "%s|%s\n" "$d" "$f"
  done | sort | awk -F'|' -v src="$SRC" -v dst="$DEST" '
    {
      n = NR
      cmd = "mv -- \"" src "/" $2 "\" \"" dst "/" n ".jpg\""
      system(cmd)
      printed = n
    }
    END { print printed }
  ')

[[ -z "$COUNT" || "$COUNT" -eq 0 ]] && die "no jpg/jpeg files in $SRC"
log "moved $COUNT photos"

# ── 3. resize originals ────────────────────────────────────────────
log "resizing to 1600px long edge…"
( cd "$DEST" && for f in *.jpg; do
    sips -Z 1600 -s formatOptions 85 "$f" >/dev/null
  done )

# ── 4. generate thumbs ──────────────────────────────────────────────
log "generating 200px thumbs…"
( cd "$DEST" && for f in *.jpg; do
    sips -Z 200 -s formatOptions 75 "$f" --out "thumbs/$f" >/dev/null
  done )

# ── 4b. upload originals + thumbs to Cloudflare R2 ──────────────────
# Travel photos are gitignored and served from media.charliexue.com via the
# `personal-website` R2 bucket. We push originals to `travels/<name>/<n>.jpg`
# and thumbs to `travels/<name>/thumbs/<n>.jpg`, mirroring local layout.
if command -v wrangler >/dev/null 2>&1; then
  log "uploading to R2 (bucket: personal-website)…"
  ( cd "$DEST" && for f in *.jpg thumbs/*.jpg; do
      [[ -e "$f" ]] || continue
      wrangler r2 object put "personal-website/travels/${NAME}/${f}" \
        --file "$f" --remote >/dev/null 2>&1 \
        && printf "." || printf "x"
    done )
  echo
  log "R2 upload complete."
else
  log "WARNING: wrangler not installed — skipping R2 upload."
  log "  install: npm install -g wrangler && wrangler login"
  log "  then re-upload manually."
fi

# ── 5. (optional) geocode ───────────────────────────────────────────
declare -a CAPTIONS=()
if [[ $GEOCODE -eq 1 ]]; then
  log "geocoding via nominatim (~${COUNT}s)…"
  # Flat-file cache (macOS ships bash 3.2 without associative arrays).
  # Lines are "lat,lon|place"; lookups are a single grep.
  CACHE=$(mktemp)
  ( cd "$DEST" && for i in $(seq 1 "$COUNT"); do
      f="${i}.jpg"
      lat=$(mdls -raw -name kMDItemLatitude  "$f" 2>/dev/null)
      lon=$(mdls -raw -name kMDItemLongitude "$f" 2>/dev/null)
      alt=$(mdls -raw -name kMDItemAltitude  "$f" 2>/dev/null)
      cap=""
      if [[ "$lat" != "(null)" && -n "$lat" ]]; then
        key=$(printf "%.2f,%.2f" "$lat" "$lon")
        place=$(grep -F "${key}|" "$CACHE" | head -1 | cut -d'|' -f2-)
        if [[ -z "$place" ]]; then
          sleep 1.1
          json=$(curl -s -A "personal-website/1.0" \
            "https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=en")
          place=$(printf '%s' "$json" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin); a = d.get('address', {})
    parts = []
    for k in ['hamlet','village','town','locality','suburb','city','county','region']:
        if k in a and a[k] not in parts: parts.append(a[k])
    print(' / '.join(parts[:2]) if parts else (d.get('display_name','').split(',')[0] or ''))
except Exception: print('')
")
          echo "${key}|${place}" >> "$CACHE"
        fi
        if [[ -n "$place" ]]; then
          altInt=${alt%.*}
          if [[ -n "$altInt" && "$altInt" != "(null)" ]]; then
            cap="${place} · ${altInt}m"
          else
            cap="${place}"
          fi
        fi
      fi
      echo "$i|$cap"
    done ) > /tmp/import-travel-captions.$$
  rm -f "$CACHE"
  while IFS='|' read -r i cap; do CAPTIONS[$i]="$cap"; done < /tmp/import-travel-captions.$$
  rm -f /tmp/import-travel-captions.$$
fi

# ── 6. build snippet ────────────────────────────────────────────────
SNIPPET="photos:"$'\n'
for i in $(seq 1 "$COUNT"); do
  if [[ $GEOCODE -eq 1 && -n "${CAPTIONS[$i]:-}" ]]; then
    SNIPPET+="  - ${i}.jpg | ${CAPTIONS[$i]}"$'\n'
  else
    SNIPPET+="  - ${i}.jpg"$'\n'
  fi
done

# ── 7. emit or append ───────────────────────────────────────────────
if [[ $APPEND -eq 1 ]]; then
  if [[ ! -f "$MD" ]]; then
    log "creating $MD"
    {
      echo "---"
      echo "name: $NAME"
      echo "country: "
      echo "when: "
      echo "days: "
      echo "route: "
      echo "learned: "
      printf '%s' "$SNIPPET"
      echo "---"
      echo
    } > "$MD"
  else
    log "inserting photos block into $MD"
    # Insert SNIPPET immediately before the second `---` (end of frontmatter).
    python3 - "$MD" <<PY
import sys, pathlib
path = pathlib.Path(sys.argv[1])
text = path.read_text()
parts = text.split('---', 2)
if len(parts) < 3:
    sys.stderr.write('error: $MD has no frontmatter delimiters\n')
    sys.exit(1)
fm, body = parts[1], parts[2]
snippet = """$SNIPPET"""
fm = fm.rstrip('\n') + '\n' + snippet
path.write_text('---' + fm + '---' + body)
PY
  fi
  log "done."
else
  echo
  echo "── paste into content/travels/${NAME}.md frontmatter ─────────"
  printf '%s' "$SNIPPET"
  echo "──────────────────────────────────────────────────────────────"
fi
