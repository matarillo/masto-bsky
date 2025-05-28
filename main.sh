#!/bin/bash
cd $(dirname $0)
node main.mjs >> masto-bsky.log 2>&1
