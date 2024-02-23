#!/bin/bash
source /home/nvm/.nvm/nvm.sh
cd $(dirname $0)
node main.mjs >> masto-bsky.log
