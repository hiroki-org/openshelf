#!/bin/bash
cd apps/web
npm run dev > ../../web_dev.log 2>&1 &
echo $! > ../../web_dev.pid
cd ../api
npm run dev > ../../api_dev.log 2>&1 &
echo $! > ../../api_dev.pid
