# Game content data

Content catalogs live in `tanks.js`, `levels.js`, and `weapons.js`. Each item
has a stable ID so tanks can refer to weapons and future selectors can store
the selected IDs without depending on display names.

## Tanks

Tank records define `name`, `description`, model path, turret and ball health,
primary and secondary weapon IDs, boost strength and time, thrust strength and
time, and a thumbnail image path. A `null` thumbnail means selection art has
not been added yet. Until turret and ball damage are separated in combat, the
runtime uses the sum of their health values as the player's total health.

## Levels

Level records define `name`, `description`, model path, HDRI path, ambient and
secondary light colors, and thumbnail image path. Colors are hexadecimal RGB
values. The current maps share the available `backdrop.hdr`; each can receive
its own HDRI and lighting values independently.

In Blender, add Empty objects named with the `start` prefix (for example,
`start_01`, `start_upper`, or `start_red`). Each player spawn randomly selects
one marker. The ball is magnetically seated against the nearest level surface,
so markers can be placed in open space as well as close to a wall or platform.
If a level has no start markers, spawning falls back to the level center.

## Weapons

Projectile weapon records define shots per second, damage per shot, range,
shot speed, splash range and amount, plus audio and behavior metadata. A future
laser can use a distinct `behavior` and custom settings, but its beam logic will
need an implementation in the projectile update path; it should not be modeled
as a regular projectile just to fit the common fields.
