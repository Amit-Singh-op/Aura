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

const getMediaWithFallback = async (facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> => {
  const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };
  const videoConstraints = {
    facingMode,
    width: { ideal: 1280 },
    frameRate: { ideal: 30, max: 60 } // Smooth video
  };

  try {
    return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
  } catch (e1) {
    console.warn('[VideoChat] Failed video+audio, trying video only:', e1);
    try {
      return await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    } catch (e2) {
      console.warn('[VideoChat] Failed video, trying audio only:', e2);
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

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
      console.log('[VideoChat] Track received!', event.track.kind);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setParticipants((prev) => {
        const existing = prev.find((p) => p.id === peerId);
        if (existing) {
          const stream = existing.stream || new MediaStream();
          if (!stream.getTracks().includes(event.track)) {
            stream.addTrack(event.track);
          }
          return prev.map((p) => (p.id === peerId ? { ...p, stream } : p));
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
        mediaStream = await getMediaWithFallback(facingMode);
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[VideoChat] Stopped track:', track.kind);
        });
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

  const acquireMediaAndBroadcast = async (mode: 'user' | 'environment' = facingMode) => {
    if (!socket) return null;
    try {
      console.log('[VideoChat] Dynamically acquiring media devices...');
      const stream = await getMediaWithFallback(mode);
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

  const flipCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    try {
      const stream = await getMediaWithFallback(newFacingMode);
      
      const oldStream = localStreamRef.current;
      if (oldStream) {
        // Stop old video tracks to release the hardware
        oldStream.getVideoTracks().forEach(track => {
          track.stop();
        });
        
        // We need to construct a totally new MediaStream object to guarantee React/iOS updates the <video> tag
        const newStream = new MediaStream();
        
        // Add the old audio tracks
        oldStream.getAudioTracks().forEach(track => {
          newStream.addTrack(track);
        });
        
        // Add the new video tracks
        stream.getVideoTracks().forEach(track => {
          newStream.addTrack(track);
        });

        // Trigger a full React state update so the <video srcObject={localStream}> rebinds
        setLocalStream(newStream);
        localStreamRef.current = newStream;
        
        // Replace track in peer connections (no renegotiation needed)
        Object.values(peersRef.current).forEach(pc => {
          const senders = pc.getSenders();
          stream.getVideoTracks().forEach(newTrack => {
            const sender = senders.find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(newTrack);
            }
          });
        });
      } else {
        await acquireMediaAndBroadcast(newFacingMode);
      }
    } catch (err) {
      console.error('Failed to flip camera:', err);
    }
  };

  return {
    localStream,
    participants,
    isMuted,
    isVideoOff,
    facingMode,
    toggleMute,
    toggleVideo,
    flipCamera
  };
}
