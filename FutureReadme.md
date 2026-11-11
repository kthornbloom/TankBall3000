# TankBall

TankBall is a zero-gravity tank combat game built in Unreal Engine 5. Every tank rides a single omni-ball that magnetically attaches to any surface. There is no gravity and no preferred “up.” Players drive across floors, walls, ceilings, and floating geometry with equal freedom, then use limited vectoring thrust to launch into open space before re-attaching to refill.

The game combines arcade-responsive controls with Chaos-based physics, component-level damage, and orientation-agnostic map design. Matches support small-group competitive and cooperative play across Steam and the Epic Games Store.

## Core Fantasy

- A single large omni-ball under the chassis locks magnetically to any surface.
- Full six-degree-of-freedom movement: every surface is a valid driving surface.
- Short bursts of free-flight thrust (approximately three seconds of vectoring control). After the burn the tank must re-engage magnets or contact a surface to re-attach and refill thrust.
- Primary cannon and machine gun with distinct roles.
- Component damage: striking the omni-ball or thrusters temporarily disables those systems; striking the turret reduces overall health.
- Maps and combat that remain fully playable no matter how the player orients the tank.

## Physics

TankBall uses Chaos physics with a custom movement system designed for zero-G and magnetic surface attachment.

The tank is a physics body driven by:

- Continuous magnetic constraints and forces that pull the omni-ball toward nearby surfaces and align the chassis relative to the surface normal.
- Local-space thruster forces for free-flight maneuvering.
- Tuned linear drag and angular damping so free-flight remains controllable rather than floaty.

Movement is server-authoritative with full client-side prediction and reconciliation. The owning client predicts attachment, detachment, thrust, and collision response immediately; the server runs the true simulation and corrects divergences. This keeps controls responsive while preventing the common zero-G multiplayer problems of desync, rubber-banding, and exploitability.

The magnetic system is intentionally strong when near a surface so driving feels planted, yet release into free-flight is instantaneous when thrust is activated or the ball is damaged. Re-attachment occurs automatically on surface contact or when the player re-engages the magnetic systems after a successful burn.

## Game Modes

### Deathmatch (Limited Respawn)
Each player receives a fixed number of lives. Destroying an enemy consumes one of their lives. When a player has no lives remaining they are eliminated. The last tank (or last team) standing wins the round.

### Team Deathmatch
Two or more teams compete under the same limited-life rules. Friendly fire is configurable per match.

### Free-For-All (Unlimited)
Classic continuous respawn deathmatch with score limits or time limits. Ideal for longer, more chaotic sessions.

### Objective Modes
- **Control Points** — Capture and hold volume-based zones that can sit on any orientation of geometry. Points award score over time; the first team to a score threshold or the team holding the most points when time expires wins.
- **Payload / Escort** — A neutral or team-owned object that must be pushed or escorted along a path that travels across walls, ceilings, and open space. Orientation changes mid-route are expected and supported.
- **Destroy Objectives** — Teams protect or assault high-value targets placed on surfaces of any orientation.

All modes share the same zero-G movement rules, component damage model, and orientation-agnostic level design. Match settings (life count, time limit, score limit, friendly fire, etc.) are exposed in the lobby.

## Maps

Maps are built with a single hard rule: there is never any gravity and there is no canonical “up.”

### Enclosed Arenas
The primary map style. Think the interior of a giant cube, sphere, or irregular volume filled with:

- Walls, ramps, platforms, and tunnels that can be driven on from any side.
- Floating structures and bridges that create vertical and inverted pathways.
- Open central volumes for free-flight engagements and long-range cannon shots.
- Choke points and flanking routes that remain meaningful regardless of player orientation.

### Open-Space Arenas
Larger zero-G volumes with scattered magnetic surfaces, asteroids, debris fields, or modular stations. These maps emphasize thrust management, long-range engagements, and the risk of drifting out of magnetic range.

Every driveable surface must function equally well when the map is rotated. Level designers are expected to validate that a map remains fully playable after 90° or 180° rotations. Lighting, spawn points, objective volumes, and navigation data are authored without assuming a floor.

## Combat & Damage Model

### Weapons
- **Primary Cannon** — Higher damage, slower projectile, strong against health and useful for finishing disabled tanks. Projectile travel time creates lead opportunities in free-flight.
- **Machine Gun** — Lower damage, high rate of fire, ideal for tracking components and applying continuous pressure. Effective at disabling the omni-ball or thrusters mid-maneuver.

Both weapons respect the zero-G environment; projectiles continue on their trajectory until they hit geometry or a tank.

### Component Damage
- **Turret hits** reduce the tank’s overall health. Reaching zero health destroys the tank.
- **Omni-ball hits** temporarily disable magnetic attachment. The tank becomes free-floating until the component recovers or the player forces a re-attach on a surface.
- **Thruster hits** temporarily reduce or disable thrust output, limiting escape and reposition options.

Disable durations, health pools, and damage values are tuned for clear feedback and meaningful decision-making. Visual and audio cues communicate exactly which component was struck so players always understand their current mobility state.

Destroyed tanks leave brief wreckage that can still be used as temporary cover or magnetic surfaces before despawning.

## Camera & Controls

The camera stays locked to the turret with a short lag. Rapid mouse movement produces a brief catch-up arc instead of an instantaneous snap, preserving spatial awareness during high-speed turns and inverted driving.

Two reticles are always visible:

- **Center reticle** — Screen-center ideal aim point.
- **Turret reticle** — Shows the barrel’s current orientation while it slews to match the center reticle.

This dual-reticle system makes turret lag readable and prevents the common problem of firing before the gun has finished tracking.

Thrust is vector-based: the player points the desired burn direction and holds the thrust input. Magnetic re-engage is a dedicated input that can also trigger automatically on surface contact after a burn.

## Multiplayer Architecture

TankBall is designed for low operational cost at small scale and clean growth into dedicated servers as concurrent players increase.

### Authority Model

| System | Authority |
|--------|-----------|
| Tank transform, magnetic attach state, thrust fuel | Server |
| Player input | Client → Server (RPC) with local prediction |
| Projectiles, hits, component disables, health | Server |
| Scores, lives, match state, spawns, objectives | Server |
| Camera, VFX, UI, prediction visuals | Client |

Clients never have final authority over position, attachment, thrust, or damage.

### Topology

**Small sessions and private matches** use a listen server. One player hosts; Epic Online Services handles lobbies, session discovery, NAT traversal, and relay when direct connection is unavailable. This keeps infrastructure cost at zero for friend groups and early public play.

**Public matchmaking and higher concurrent load** move to dedicated headless Linux servers. The same gameplay code runs on both listen and dedicated servers. An on-demand orchestrator (Gameye, Edgegap, or AWS GameLift) spins servers up for matches and scales them to zero when idle. Players pay only for active match processes.

Session sizes target 2–16 players depending on mode. The architecture supports host migration for listen-server sessions and seamless transition to dedicated servers without rewriting gameplay systems.

### Tech Stack

- Unreal Engine 5 replication, RPCs, and Network Prediction / Mover for movement.
- Epic Online Services for authentication, lobbies, sessions, cross-play foundation, voice, and Easy Anti-Cheat.
- Linux dedicated server builds for cost and density.
- Online Subsystem abstractions so Steam and Epic remain first-class without hard-locking the codebase to a single platform SDK.

## Anti-Cheat

Easy Anti-Cheat (via Epic Online Services) is the primary client-side protection layer. It is free for typical indie usage and integrates directly with the chosen online services.

Server-authoritative simulation already eliminates the highest-impact cheats: speed hacking, infinite thrust, fabricated hits, and health manipulation. Additional server-side validation enforces maximum speeds, legal attach-state transitions, damage rate limits, and projectile origins.

Steam VAC may be enabled as a secondary layer on the Steam build. It is not relied upon as the sole defense.

## Platforms & Distribution

Primary storefronts are Steam and the Epic Games Store. The game uses Unreal’s Online Subsystem and Epic Online Services so additional platforms can be added later without architectural rewrites. Console versions are supported by the networking design but are not required for the initial release.

Cross-play between Steam and Epic clients is a design goal and is enabled through EOS where platform policies allow.

## Progression & Customization

Players unlock cosmetic skins for the chassis, omni-ball, turret, and trail effects through match participation and challenges. No pay-to-win weapons or statistical upgrades exist. Loadouts are cosmetic only; every tank has identical performance characteristics within a given match.

A lightweight challenge and seasonal system tracks wins, component disables, free-flight kills, and objective plays to award cosmetics and profile badges.

## Audio & Feedback

- Distinct audio for magnetic attach, detach, thrust ignition, thrust cutoff, and component disable/recovery.
- Clear directional hit markers that indicate whether the ball, thrusters, or turret was struck.
- Low-frequency feedback and screen effects when the local player’s components are disabled so mobility loss is immediately readable.

## Development Approach

Gameplay systems, networking, prediction, AI opponents, and tools are implemented with heavy AI assistance. Human artists and designers own all 3D assets, visual style, menu and HUD design, and final game-feel decisions. This split keeps production velocity high while preserving deliberate creative control over the player-facing experience.

## Design Pillars

1. **Orientation freedom** — Every system (movement, maps, objectives, camera, spawns) must work without a fixed up vector.
2. **Readable mobility** — Players always know whether they are attached, thrusting, or disabled, and what they need to do next.
3. **Component risk** — Disabling an opponent’s ball or thrusters creates temporary vulnerability windows that reward accurate shooting over pure damage racing.
4. **Low-friction multiplayer** — Private matches cost nothing to run; public matches scale cleanly without forcing the project into expensive always-on infrastructure.
5. **Fair authority** — The server owns the simulation; clients predict for feel and never dictate outcomes.

TankBall is zero-G tank combat where the arena itself is the playground and every surface is fair game.