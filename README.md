This is a three.js based tank game. It is unique in that the tank rolls on one large omni-ball, "magnetically" attached to the walls. So it can drive up on walls, ceilings, etc. The player may also use a thrust system to launch the tank into the air, with 3 seconds of vectoring thrust. Afterwards they must re-engage magnetic systems (or bump into a wall) to re-attach and re-fill the thrust. So far, weapons include a primary tank round and a machine gun. 

## Free online multiplayer prototype

The browser game uses PeerJS and WebRTC for a temporary four-player host-and-join session. One player hosts and shares the code shown in the multiplayer panel; up to three friends enter that code. PeerJS Cloud is used for free signaling, while tank poses travel directly between browsers when their networks allow it. There are no player accounts, random matchmaking, or server-side movement checks yet. The host needs to stay connected, and some networks may need a TURN relay to connect.

For local play, serve the project over HTTP with `python -m http.server 8000`, open `http://localhost:8000` in multiple browser windows, then use **Host** in one window and **Join** in the others.

The `multiplayer` folder retains the earlier Colyseus server scaffold for a later server-authoritative version; the current browser client does not require it.

## Public hosting

The GitHub Pages workflow publishes the browser game from the `master` branch. It omits Blender source files and the unused 109 MB HDRI from the Pages artifact. The HDRI is git-ignored because GitHub blocks individual files over 100 MB.

Enable GitHub Pages with **Settings → Pages → GitHub Actions**. The Pages site is static; PeerJS Cloud handles the signaling needed to form a room. The free shared signaling service is suitable for playtesting, but has no production availability guarantee.
