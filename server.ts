import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import { storage } from './src/lib/storage/index';
import { verifyToken } from './src/lib/auth'; // We'll need to export a helper to verify JWT from socket headers or cookies

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);

      // Serve files from public/uploads manually to bypass Next.js production cache for dynamically added files
      if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/uploads/')) {
        const path = await import('path');
        const fs = await import('fs');
        const filePath = path.join(process.cwd(), 'public', parsedUrl.pathname);
        
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          let contentType = 'application/octet-stream';
          if (ext === '.png') contentType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.webp') contentType = 'image/webp';
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Keep track of which users are in which rooms to broadcast presence
  // Map<roomId, Map<userId, { username: string, sockets: Set<socketId> }>>
  const roomUsers = new Map<string, Map<string, { username: string, sockets: Set<string> }>>();
  const activeVideoRooms = new Set<string>();

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Send initial presence for all rooms to the newly connected socket
    const allPresence = Array.from(roomUsers.entries()).map(([roomId, userMap]) => ({
      roomId,
      count: userMap.size,
      users: Array.from(userMap.entries()).map(([id, data]) => ({ id, name: data.username }))
    }));
    socket.emit('initial_presence', allPresence);

    socket.on('join_room', (data: { roomId: string; userId: string; username: string }) => {
      const { roomId, userId, username } = data;
      socket.join(roomId);
      // Join a personal room for private notifications
      socket.join(`user:${userId}`);
      
      // Track presence
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      
      const roomMap = roomUsers.get(roomId)!;
      if (!roomMap.has(userId)) {
        roomMap.set(userId, { username, sockets: new Set() });
      }
      
      const userPresence = roomMap.get(userId)!;
      const isFirstConnection = userPresence.sockets.size === 0;
      userPresence.sockets.add(socket.id);

      const usersInRoom = Array.from(roomMap.entries()).map(([id, d]) => ({ id, name: d.username }));

      // Notify EVERYONE globally
      io.emit('presence_update', {
        roomId,
        count: usersInRoom.length,
        users: usersInRoom,
      });

      // Notify the joining user about the video call status
      socket.emit('video_status', { roomId, active: activeVideoRooms.has(roomId) });

      if (isFirstConnection) {
        socket.to(roomId).emit('system_message', {
          id: crypto.randomUUID(),
          roomId,
          userId: 'system',
          username: 'System',
          content: `${username} joined the room.`,
          timestamp: Date.now(),
        });
      }
      
      // Store socket custom data for disconnect handling
      socket.data.userId = userId;
      socket.data.username = username;
      socket.data.roomId = roomId;
    });

    socket.on('leave_room', (data: { roomId: string; userId: string; username: string }) => {
      const { roomId, userId, username } = data;
      socket.leave(roomId);

      if (roomUsers.has(roomId)) {
        const roomMap = roomUsers.get(roomId)!;
        const userPresence = roomMap.get(userId);
        
        if (userPresence) {
          userPresence.sockets.delete(socket.id);
          
          if (userPresence.sockets.size === 0) {
            roomMap.delete(userId);
            socket.to(roomId).emit('system_message', {
              id: crypto.randomUUID(),
              roomId,
              userId: 'system',
              username: 'System',
              content: `${username} left the room.`,
              timestamp: Date.now(),
            });
          }
          
          const usersInRoom = Array.from(roomMap.entries()).map(([id, d]) => ({ id, name: d.username }));
          io.emit('presence_update', {
            roomId,
            count: usersInRoom.length,
            users: usersInRoom,
          });
        }
      }
    });

    const rateLimits = new Map<string, { tokens: number; lastRefill: number }>();
    const REFILL_RATE = 1000; // 1 token per second
    const MAX_TOKENS = 5;

    socket.on('send_message', async (data: { roomId: string; userId: string; username: string; content: string; type?: 'text' | 'sticker' | 'power' | 'bullet'; stickerId?: string; replyTo?: any; powerOptions?: { textColor: string, bgColor: string }, bulletOptions?: { targetUsername: string, emoji: string, text: string }, pendingId?: string }) => {
      try {
        const { roomId, userId, username, content, type, stickerId, replyTo, powerOptions, bulletOptions, pendingId } = data;
        
        // Validate that room and user actually exist in storage
        const room = await storage.rooms.getRoom(roomId);
        if (!room) {
          socket.emit('app_error', { message: 'This room no longer exists.' });
          return;
        }

        const user = await storage.users.findUserByUsername(username);
        if (!user || user.id !== userId) {
          socket.emit('app_error', { message: 'User session invalid. Please log in again.' });
          return;
        }
        
        // Rate limiting logic
        const now = Date.now();
        const limitInfo = rateLimits.get(userId) || { tokens: MAX_TOKENS, lastRefill: now };
        
        // Refill tokens
        const timePassed = now - limitInfo.lastRefill;
        const tokensToAdd = Math.floor(timePassed / REFILL_RATE);
        limitInfo.tokens = Math.min(MAX_TOKENS, limitInfo.tokens + tokensToAdd);
        if (tokensToAdd > 0) {
          limitInfo.lastRefill = now;
        }

        if (limitInfo.tokens <= 0) {
          socket.emit('app_error', { message: 'You are sending messages too fast. Please slow down.' });
          return;
        }

        limitInfo.tokens -= 1;
        rateLimits.set(userId, limitInfo);

        // Save to storage
        const message = await storage.messages.addMessage({
          roomId,
          userId,
          username,
          content,
          type: type || 'text',
          stickerId,
          replyTo,
          powerOptions,
          bulletOptions,
          pendingId
        });

        // Broadcast to everyone in the room
        io.to(roomId).emit('new_message', message);

        // Handle Mentions and Replies
        const notifiedUserIds = new Set<string>();

        // 1. Replies
        if (replyTo && replyTo.username !== username) {
          const repliedUser = await storage.users.findUserByUsername(replyTo.username);
          if (repliedUser) {
            notifiedUserIds.add(repliedUser.id);
            const notification = await storage.notifications.createNotification({
              userId: repliedUser.id,
              fromUsername: username,
              roomId,
              messageId: message.id,
              content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            });
            io.to(`user:${repliedUser.id}`).emit('new_notification', notification);
          }
        }

        // Global Summon
        if (type === 'text' && content?.toLowerCase().includes('#all')) {
          io.emit('global_summon', {
            roomId,
            roomName: room.name,
            username,
            message: content
          });
        }

        // 2. Mentions
        if (type === 'text' && content) {
          const mentions = content.match(/@(\w+)/g);
          if (mentions) {
            const usernames = Array.from(new Set(mentions.map(m => m.substring(1).toLowerCase())));

            for (const mentionedUsername of usernames) {
              if (mentionedUsername === username.toLowerCase()) continue; // Don't notify self
              
              const mentionedUser = await storage.users.findUserByUsername(mentionedUsername);
              if (mentionedUser && !notifiedUserIds.has(mentionedUser.id)) {
                notifiedUserIds.add(mentionedUser.id);
                const notification = await storage.notifications.createNotification({
                  userId: mentionedUser.id,
                  fromUsername: username,
                  roomId,
                  messageId: message.id,
                  content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                });
                io.to(`user:${mentionedUser.id}`).emit('new_notification', notification);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to save message:', err);
      }
    });

    socket.on('toggle_reaction', async (data: { roomId: string; messageId: string; emoji: string; userId: string; username: string }) => {
      try {
        const { roomId, messageId, emoji, userId, username } = data;
        
        // Validate room and user
        const room = await storage.rooms.getRoom(roomId);
        if (!room) return;
        const user = await storage.users.findUserByUsername(username);
        if (!user || user.id !== userId) return;

        const newReactions = await storage.messages.toggleReaction(roomId, messageId, emoji, username);
        if (newReactions !== null) {
          io.to(roomId).emit('message_reaction_updated', {
            messageId,
            roomId,
            reactions: newReactions
          });
        }
      } catch (err) {
        console.error('Failed to toggle reaction:', err);
      }
    });

    socket.on('mark_delivered', async (data: { roomId: string; messageId: string; userId: string }) => {
      try {
        const { roomId, messageId, userId } = data;
        const newStatus = await storage.messages.updateMessageStatus(roomId, messageId, userId, 'delivered');
        if (newStatus !== null) {
          io.to(roomId).emit('message_status_update', {
            messageId,
            roomId,
            deliveredTo: newStatus.deliveredTo,
            seenBy: newStatus.seenBy
          });
        }
      } catch (err) {
        console.error('Failed to mark delivered:', err);
      }
    });

    socket.on('join_video', (payload: { roomId: string; userId: string; username: string }) => {
      const videoRoom = `video-${payload.roomId}`;
      socket.join(videoRoom);

      const alreadyActive = activeVideoRooms.has(payload.roomId);
      if (!alreadyActive) {
        activeVideoRooms.add(payload.roomId);
        
        io.to(payload.roomId).emit('video_started', {
          roomId: payload.roomId,
          userId: payload.userId,
          username: payload.username,
        });

        io.to(payload.roomId).emit('system_message', {
          id: crypto.randomUUID(),
          roomId: payload.roomId,
          userId: 'system',
          username: 'System',
          content: `${payload.username} started a video call! 🎥`,
          timestamp: Date.now(),
        });
      }

      socket.emit('video_status', { roomId: payload.roomId, active: activeVideoRooms.has(payload.roomId) });
      socket.to(videoRoom).emit('video_user_joined', { ...payload, socketId: socket.id });
    });

    socket.on('leave_video', (payload: { roomId: string; userId: string }) => {
      const videoRoom = `video-${payload.roomId}`;
      socket.leave(videoRoom);
      
      socket.to(videoRoom).emit('video_user_left', { ...payload, socketId: socket.id });
      
      const room = io.sockets.adapter.rooms.get(videoRoom);
      if (!room || room.size === 0) {
        activeVideoRooms.delete(payload.roomId);
        
        io.to(payload.roomId).emit('video_ended', {
          roomId: payload.roomId,
        });

        io.to(payload.roomId).emit('system_message', {
          id: crypto.randomUUID(),
          roomId: payload.roomId,
          userId: 'system',
          username: 'System',
          content: `Video call ended.`,
          timestamp: Date.now(),
        });
      }
    });

    // Signaling messages for WebRTC
    socket.on('video_offer', (payload: { from: string; to: string; data: any }) => {
      socket.to(payload.to).emit('video_offer', payload);
    });

    socket.on('video_answer', (payload: { from: string; to: string; data: any }) => {
      socket.to(payload.to).emit('video_answer', payload);
    });

    socket.on('ice_candidate', (payload: { from: string; to: string; data: any }) => {
      socket.to(payload.to).emit('ice_candidate', payload);
    });

    socket.on('mark_seen', async (data: { roomId: string; messageId: string; userId: string }) => {
      try {
        const { roomId, messageId, userId } = data;
        const newStatus = await storage.messages.updateMessageStatus(roomId, messageId, userId, 'seen');
        if (newStatus !== null) {
          io.to(roomId).emit('message_status_update', {
            messageId,
            roomId,
            deliveredTo: newStatus.deliveredTo,
            seenBy: newStatus.seenBy
          });
        }
      } catch (err) {
        console.error('Failed to mark seen:', err);
      }
    });

    socket.on('user_typing', (data: { roomId: string; username: string; isTyping: boolean }) => {
      socket.to(data.roomId).emit('user_typing', data);
    });

    socket.on('delete_room', (data: { id: string }) => {
      // Broadcast to everyone else
      socket.broadcast.emit('room_deleted', data);
    });

    socket.on('add_room', (data: any) => {
      socket.broadcast.emit('room_added', data);
    });

    socket.on('disconnect', () => {
      const { roomId, userId, username } = socket.data;
      if (roomId && userId) {
        if (roomUsers.has(roomId)) {
          const roomMap = roomUsers.get(roomId)!;
          const userPresence = roomMap.get(userId);
          
          if (userPresence) {
            userPresence.sockets.delete(socket.id);
            
            if (userPresence.sockets.size === 0) {
              roomMap.delete(userId);
              io.to(roomId).emit('system_message', {
                id: crypto.randomUUID(),
                roomId,
                userId: 'system',
                username: 'System',
                content: `${username} left the room.`,
                timestamp: Date.now(),
              });
            }
            
            const usersInRoom = Array.from(roomMap.entries()).map(([id, d]) => ({ id, name: d.username }));
            io.emit('presence_update', {
              roomId,
              count: usersInRoom.length,
              users: usersInRoom,
            });
          }
        }
      }
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
