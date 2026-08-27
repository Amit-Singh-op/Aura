import { StorageBackend } from './types';
import { MemoryUserRepository } from './memory/memoryUserRepo';
import { MemoryRoomRepository } from './memory/memoryRoomRepo';
import { MemoryMessageRepository } from './memory/memoryMessageRepo';
import { MemoryStickerRepository } from './memory/memoryStickerRepo';

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
    };
  }
  storage = global.__storageBackend;
}

export { storage };
