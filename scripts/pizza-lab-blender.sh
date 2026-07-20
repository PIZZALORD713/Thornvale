#!/bin/zsh
set -euo pipefail

export BLENDER_USER_CONFIG="/Users/sauce/Library/Application Support/Blender-Pizza-Lab/4.5/config"
export BLENDER_USER_SCRIPTS="/Users/sauce/Library/Application Support/Blender-Pizza-Lab/4.5/scripts"

exec /Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender "$@"
