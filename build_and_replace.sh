rm -r node_modules
pnpm install
pnpm run package:mac && killall -q Feishin && rm -r /Applications/Feishin.app && rsync -aP dist/mac-arm64/Feishin.app /Applications/. && open /Applications/Feishin.app
