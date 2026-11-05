This is a three.js based tank game. It is unique in that the tank rolls on one large omni-ball, "magnetically" attached to the walls. So it can drive up on walls, ceilings, etc. The player may also use a thrust system to launch the tank into the air, with 3 seconds of vectoring thrust. Afterwards they must re-engage magnetic systems (or bump into a wall) to re-attach and re-fill the thrust. So far, weapons include a primary tank round and a machine gun. 

## Multiplayer prototype

The first multiplayer slice uses Colyseus rooms with four seats. It relays player tank poses so multiple browser clients can see one another. Movement is still simulated on each client; this prototype is for validating the connection and shared view, not for competitive play.

1. In `multiplayer`, run `npm install` once, then `npm run dev` to start the room server on port 2567.
2. In the project root, serve the files over HTTP, for example with `python -m http.server 8000`.
3. Open `http://localhost:8000/?multiplayer=1` in two browser windows. Each joins the same open room, up to four players.

The client uses Colyseus' browser SDK from a CDN, matching the existing Three.js CDN setup. No account is needed for local development.

## Public hosting

The GitHub Pages workflow publishes the browser game from the `master` branch. It omits Blender source files and the unused 109 MB HDRI from the Pages artifact. The HDRI is also git-ignored because GitHub rejects individual files over 100 MB.

The multiplayer server needs a separate Node.js host. The `multiplayer` folder is configured for Colyseus Cloud. Connect the GitHub repository in Colyseus Cloud, set its root directory to `multiplayer/`, and deploy the `master` branch. Enable GitHub Pages with **Settings → Pages → GitHub Actions**. Once the server is deployed, open the Pages URL with `?multiplayer=1&server=https%3A%2F%2FYOUR-COLYSEUS-HOST` to join a public room.

Both hosting services require account access. Colyseus Cloud is a managed paid hosting service; check its current plan and usage pricing before creating a server.
