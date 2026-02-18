.\k6.exe run .\loadtest.js -e "BASE_URL=http://localhost:4000" -e "LIVE_CHANNEL_ID=1" -e "TOTAL_VUS=200" -e "DURATION=2m"

.\k6.exe run .\loadtest.js -e "BASE_URL=http://localhost:4000" -e "LIVE_CHANNEL_ID=1" -e "TOTAL_VUS=500" -e "DURATION=2m"