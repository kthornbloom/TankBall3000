import { defineRoom, defineServer, Room } from 'colyseus';

const PORT = Number(process.env.PORT || 2567);

class BattleRoom extends Room {
  maxClients = 4;

  onCreate() {
    this.poses = new Map();

    this.onMessage('pose', (client, pose) => {
      if (!isValidPose(pose)) return;
      this.poses.set(client.sessionId, pose);
      for (const recipient of this.clients) {
        if (recipient !== client) {
          recipient.send('player-pose', { sessionId: client.sessionId, pose });
        }
      }
    });

    this.onMessage('request-room-count', client => {
      client.send('room-count', { count: this.clients.length });
    });
  }

  onJoin(client) {
    for (const [sessionId, pose] of this.poses) {
      client.send('player-joined', { sessionId });
      if (pose) client.send('player-pose', { sessionId, pose });
    }
    this.poses.set(client.sessionId, null);
    this.broadcast('player-joined', { sessionId: client.sessionId }, { except: client });
    this.broadcastCount();
  }

  onLeave(client) {
    this.poses.delete(client.sessionId);
    this.broadcast('player-left', { sessionId: client.sessionId });
    this.broadcastCount();
  }

  broadcastCount() {
    this.broadcast('room-count', { count: this.clients.length });
  }
}

function isValidPose(pose) {
  if (!pose || !Array.isArray(pose.position) || pose.position.length !== 3) return false;
  if (!Array.isArray(pose.rotation) || pose.rotation.length !== 4) return false;
  if (!Array.isArray(pose.bodyRotation) || pose.bodyRotation.length !== 3) return false;
  return [...pose.position, ...pose.rotation, ...pose.bodyRotation].every(Number.isFinite);
}

const server = defineServer({
  rooms: { battle: defineRoom(BattleRoom) }
});

server.listen(PORT);
console.log(`TankBall3000 multiplayer server listening on http://localhost:${PORT}`);
