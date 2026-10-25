#!/bin/sh
set -eu
mkdir -p /tmp/diagram-desk/repository/.git
if [ ! -d /tmp/diagram-desk/repository/examples ]; then
  cp -R /app/examples /tmp/diagram-desk/repository/examples
fi
node /app/bin/diagram-desk.mjs repo add /tmp/diagram-desk/repository 'Diagram Desk · demo'
exec node /app/bin/diagram-desk.mjs serve
