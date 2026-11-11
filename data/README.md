# Description

TANKBALL is a 3D arena game where a tank moves across surfaces using magnetic attachment. Instead of a normal set of tracks, the tank in this game features a single large ball that rolls in the direction it wants to go. A turret sits atop the ball, able to rotate freely in any direction. A shift key press causes the tank to drive faster while on the ground. The game doesn’t use gravity to pull the tank down; its mag drive keeps it attached as it drives across floors, walls, and ceilings. Levels have rounded corners to facilitate driving from one wall to another. You can detach from the wall by disengaging your magnets which gives you a small bit of inertia in the direction you're facing. Then you can use up to three seconds of thrust through open space. Thrust comes from the back of the tank and adds inertia to the direction you're currently facing. As you use thrust, if you wait one second it will begin to slowly refill. If you run out of thrust entirely, there is a 4 second penalty cooldown until it begins to refill. While flying through the air, if you bump into a wall, you automatically reattach to it and orient the turret such that this wall is now "down". While flying, you may also hit the left control key to engage your magnets at any time, thereby causing the tank to slowly orient towards, float towards, and eventually attach to the nearest wall. User can choose between the default 3rd person view, or a first person view. While in third person, if the tank backs up near a wall that's behind it, the camera has collision with that wall and is pushed closer to the tank so it doesn't end up behind the wall.

# Controls

- W / S: Drive forward and reverse.
- A / D: Strafe.
- Mouse: Aim
- Left click: Fire. The cannon fires one shell per click; the minigun fires continuously while held.
- 1 / 2: Switch between the tank’s primary cannon and secondary minigun.
- Right mouse button: Hold to zoom.
- Shift: Use a one second ground boost while magnetically attached.
- Space: Detach from the surface. Hold to thrust in the aimed direction; release to drift. Thrust fuel recharges while not thrusting.
- Left Ctrl: Re-engage the magnets and return to a surface.
- Q / E: Roll while flying or drifting.
- C: Switch between first and third person.
- Esc: Open the in-game menu and release the mouse.

# Sounds

- Engine: Runs while driving on a magnetized surface. Increases in pitch when going faster
- Boost: Loops while thrust is active in flight.
- Cannon: Plays when a shell is fired.
- Minigun: Loops while the trigger is held.
- Thud: Plays on collisions with arena surfaces.
- Clank: Plays when the tank reattaches after flight.
- Bleep: Plays when magnets are turned on
- Bloop: Plays when magnets are turned off
- Explosion: Plays when a tank is destroyed.
- Hiss: Plays when a weapon overheats and needs a cooldown
- Hit: Plays when a weapon hits a tank
- Subtle Beep: menu hover noise
- Success Beep: menu selection noise
- Music: Plays always

# Tanks

Tank records define `name`, `description`, model path, turret and ball health,
primary and secondary weapon IDs, boost strength and time, thrust strength and
time, and a thumbnail image path. A `null` thumbnail means selection art has
not been added yet.

In blender, tanks have the ball element named "ball", and the turret named "turret". They have the boost fire name "boost". All elements are parented correctly to each other.

## Levels

Level records define `name`, `description`, model path, HDRI path, ambient and
secondary light colors, and thumbnail image path. Colors are hexadecimal RGB
values.

The `adjectives` field is a comma-separated list used by the level selector,
for example `Enclosed, Close Quarters, Urban`.

In Blender, add Empty objects named with the `start` prefix (for example,
`start_01`, `start_upper`, or `start_red`). Each player spawn randomly gets
one marker. The ball is magnetically seated against the nearest level surface,
so markers can be placed in open space as well as close to a wall or platform.
If a level has no start markers, spawning falls back to the level center.

For level collision, prefix each collidable mesh object's name with `col-`
(for example, `col-floor` or `col-wall`). Only meshes with this prefix are
used for tank surface attachment, movement and flight collision, projectile
blocking, and camera collision. All other meshes remain visible but are
ignored by collision checks. The prefix is case-insensitive and must be part of
the mesh object's name that is exported to glTF/GLB.

## Weapons

Projectile weapon records define shots per second, damage per shot, range,
shot speed, splash range and amount, plus audio and behavior metadata.
Mini/machine gun type weapons have a heat limit that creeps up. Once reached the weapon is in cooldown and cannot fire until several seconds have elapsed.
Primary weapons do splash damage with the amount of damage falling off over distance. They have no heat, but have longer reload times
EMP devices cast out in a spherical shape from the tank and temporarily disable other tanks
Laser weapons have no speed as they are an immediate line. They reduce health over time. Distance does affect their strength.
