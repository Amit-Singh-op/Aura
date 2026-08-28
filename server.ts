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

    socket.on('send_message', async (data: { roomId: string; userId: string; username: string; content: string; type?: 'text' | 'sticker' | 'power'; stickerId?: string; replyTo?: any; powerOptions?: { textColor: string, bgColor: string } }) => {
      try {
        const { roomId, userId, username, content, type, stickerId, replyTo, powerOptions } = data;
        
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
          socket.emit('error', { message: 'You are sending messages too fast. Please slow down.' });
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
          powerOptions
        });

        // Broadcast to everyone in the room
        io.to(roomId).emit('new_message', message);
      } catch (err) {
        console.error('Failed to save message:', err);
      }
    });

    socket.on('user_typing', (data: { roomId: string; username: string; isTyping: boolean }) => {
      socket.to(data.roomId).emit('user_typing', data);
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
