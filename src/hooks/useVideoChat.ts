'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseVideoChatOptions {
  socket: Socket | null;
  roomId: string;
  userId: string;
  username: string;
  isActive: boolean;
}

export interface Participant {
  id: string;
  stream: MediaStream | null;
  username?: string;
}

const getMediaWithFallback = async (): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (e1) {
    console.warn('[VideoChat] Failed video+audio, trying video only:', e1);
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (e2) {
      console.warn('[VideoChat] Failed video, trying audio only:', e2);
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e3) {
        throw new Error('Completely failed to access any media device');
      }
    }
  }
};

export function useVideoChat({ socket, roomId, userId, username, isActive }: UseVideoChatOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Synchronize localStream state with ref
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const createPeer = useCallback((peerId: string, isInitiator: boolean, remoteUsername?: string) => {
    if (!socket) return null;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    setParticipants((prev) => {
      if (!prev.find(p => p.id === peerId)) {
        return [...prev, { id: peerId, stream: null, username: remoteUsername }];
      }
      return prev.map(p => p.id === peerId && remoteUsername ? { ...p, username: remoteUsername } : p);
    });

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants((prev) => {
        const existing = prev.find((p) => p.id === peerId);
        if (existing) {
          return prev.map((p) => (p.id === peerId ? { ...p, stream: remoteStream } : p));
        }
        return [...prev, { id: peerId, stream: remoteStream, username: remoteUsername }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', { from: socket.id, to: peerId, data: event.candidate });
      }
    };

    if (isInitiator) {
      const createOffer = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('video_offer', { from: socket.id, to: peerId, data: pc.localDescription, username });
        } catch (err) {
          console.error('Failed to create offer:', err);
        }
      };
      // Manually trigger offer creation to avoid race conditions with onnegotiationneeded
      setTimeout(createOffer, 100);
    }

    peersRef.current[peerId] = pc;
    return pc;
  }, [socket]);

  // Handle joining room and getting media
  useEffect(() => {
    if (!isActive || !socket) return;

    let mediaStream: MediaStream | null = null;
    let joined = false;

    const init = async () => {
      try {
        console.log('[VideoChat] Requesting media devices...');
        mediaStream = await getMediaWithFallback();
        console.log('[VideoChat] Media devices acquired successfully');
        setLocalStream(mediaStream);
        localStreamRef.current = mediaStream; // Set ref immediately to avoid race conditions
      } catch (err) {
        console.error('[VideoChat] Error accessing media devices:', err);
        alert('Could not access camera/microphone. You will join the call as an observer.');
      }
      
      console.log('[VideoChat] Emitting join_video for room:', roomId);
      socket.emit('join_video', { roomId, userId, username });
      joined = true;
    };

    init();

    return () => {
      console.log('[VideoChat] Cleaning up video chat session');
      if (joined) {
        socket.emit('leave_video', { roomId, userId });
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      setLocalStream(null);
      setParticipants([]);
    };
  }, [isActive, socket, roomId, userId, username]);

  // Handle socket events
  useEffect(() => {
    if (!socket || !isActive) return;

    const handleUserJoined = (payload: { userId: string, roomId: string, socketId: string, username: string }) => {
      console.log('[VideoChat] User joined video room:', payload);
      createPeer(payload.socketId, true, payload.username);
    };

    const handleUserLeft = (payload: { userId: string, roomId: string, socketId: string }) => {
      console.log('[VideoChat] User left video room:', payload);
      const pc = peersRef.current[payload.socketId];
      if (pc) {
        pc.close();
        delete peersRef.current[payload.socketId];
        setParticipants(prev => prev.filter(p => p.id !== payload.socketId));
      }
    };

    const handleOffer = async (payload: { from: string, data: RTCSessionDescriptionInit, username?: string }) => {
      console.log('[VideoChat] Received video offer from:', payload.from);
      let pc = peersRef.current[payload.from];
      if (!pc) {
        pc = createPeer(payload.from, false, payload.username) as RTCPeerConnection;
      }
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
          console.log('[VideoChat] Set remote description successfully');
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('[VideoChat] Sending video answer back to:', payload.from);
          socket.emit('video_answer', { from: socket.id, to: payload.from, data: pc.localDescription, username });
        } catch (err) {
          console.error('[VideoChat] Error handling offer:', err);
        }
      }
    };

    const handleAnswer = async (payload: { from: string, data: RTCSessionDescriptionInit }) => {
      console.log('[VideoChat] Received video answer from:', payload.from);
      const pc = peersRef.current[payload.from];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
          console.log('[VideoChat] Set remote description successfully from answer');
        } catch (err) {
          console.error('[VideoChat] Error handling answer:', err);
        }
      }
    };

    const handleIceCandidate = async (payload: { from: string, data: RTCIceCandidateInit }) => {
      console.log('[VideoChat] Received ICE candidate from:', payload.from);
      const pc = peersRef.current[payload.from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.data));
        } catch (e) {
          console.error('[VideoChat] Error adding ICE candidate', e);
        }
      }
    };

    socket.on('video_user_joined', handleUserJoined);
    socket.on('video_user_left', handleUserLeft);
    socket.on('video_offer', handleOffer);
    socket.on('video_answer', handleAnswer);
    socket.on('ice_candidate', handleIceCandidate);

    return () => {
      socket.off('video_user_joined', handleUserJoined);
      socket.off('video_user_left', handleUserLeft);
      socket.off('video_offer', handleOffer);
      socket.off('video_answer', handleAnswer);
      socket.off('ice_candidate', handleIceCandidate);
    };
  }, [socket, isActive, createPeer]);

  const acquireMediaAndBroadcast = async () => {
    if (!socket) return null;
    try {
      console.log('[VideoChat] Dynamically acquiring media devices...');
      const stream = await getMediaWithFallback();
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Add tracks to all existing peer connections and renegotiate
      Object.entries(peersRef.current).forEach(([peerId, pc]) => {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        
        const createOffer = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('video_offer', { from: socket.id, to: peerId, data: pc.localDescription, username });
          } catch (err) {
            console.error('[VideoChat] Error during renegotiation offer:', err);
          }
        };
        setTimeout(createOffer, 100);
      });
      return stream;
    } catch (err) {
      console.error('[VideoChat] Failed to acquire media devices dynamically:', err);
      alert('Could not access camera/microphone.');
      return null;
    }
  };

  const toggleMute = async () => {
    let currentStream = localStreamRef.current;
    if (!currentStream) {
      currentStream = await acquireMediaAndBroadcast();
    }
    if (currentStream) {
      currentStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  };

  const toggleVideo = async () => {
    let currentStream = localStreamRef.current;
    if (!currentStream) {
      currentStream = await acquireMediaAndBroadcast();
    }
    if (currentStream) {
      currentStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
    }
  };

  return {
    localStream,
    participants,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo
  };
}
