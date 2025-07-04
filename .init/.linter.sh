#!/bin/bash
cd /home/kavia/workspace/code-generation/doodlequest-106964-6f6cb74d/react_js_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

