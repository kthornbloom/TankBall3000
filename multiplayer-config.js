export const PEER_DEBUG_LEVEL = 3;

export const PEER_CONNECTION_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:eu-0.turn.peerjs.com:3478?transport=udp',
        'turn:us-0.turn.peerjs.com:3478?transport=udp',
        'turn:eu-0.turn.peerjs.com:3478?transport=tcp',
        'turn:us-0.turn.peerjs.com:3478?transport=tcp'
      ],
      username: 'peerjs',
      credential: 'peerjsp'
    }
  ],
  sdpSemantics: 'unified-plan'
};
