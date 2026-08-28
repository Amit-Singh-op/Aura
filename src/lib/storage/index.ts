import { StorageBackend } from './types';
import { MemoryUserRepository } from './memory/memoryUserRepo';
import { MemoryRoomRepository } from './memory/memoryRoomRepo';
import { MemoryMessageRepository } from './memory/memoryMessageRepo';
import { MemoryStickerRepository } from './memory/memoryStickerRepo';
import { MemoryNotificationRepository } from './memory/memoryNotificationRepo';

// Define the global type for our storage to survive HMR in development
declare global {
  // eslint-disable-next-line no-var
  var __storageBackend: StorageBackend | undefined;
}

let storage: StorageBackend;

if (process.env.USE_DB === 'true') {
  // In a real implementation, you would instantiate your DB repositories here:
  // import { DbUserRepository } from './db/dbUserRepo';
  // import { DbRoomRepository } from './db/dbRoomRepo';
  // import { DbMessageRepository } from './db/dbMessageRepo';
  // storage = {
  //   users: new DbUserRepository(),
  //   rooms: new DbRoomRepository(),
  //   messages: new DbMessageRepository(),
  // };
  throw new Error('DB implementation not yet provided. Please set USE_DB=false for now.');
} else {
  // Use memory repositories
  if (!global.__storageBackend) {
    global.__storageBackend = {
      users: new MemoryUserRepository(),
      rooms: new MemoryRoomRepository(),
      messages: new MemoryMessageRepository(),
      stickers: new MemoryStickerRepository(),
      notifications: new MemoryNotificationRepository(),
    };

    // Initialize default admin and general room
    (async () => {
      try {
        const bcrypt = await import('bcryptjs');
        const adminHash = await bcrypt.hash('admindoesntmatter', 10);
        
        await global.__storageBackend!.users.createUser({
          username: 'admin',
          passwordHash: adminHash,
          role: 'admin'
        });

        await global.__storageBackend!.rooms.createRoom({
          name: 'General',
          description: 'General discussion',
          icon: '🌍'
        });
        
        console.log('Default admin and room initialized successfully.');
      } catch (err) {
        console.error('Failed to initialize default storage', err);
      }
    })();
  }
  storage = global.__storageBackend;
}

export { storage };
