# Realtime Room Chat App

A modern, fast, and real-time chat application built with Next.js 14, Tailwind CSS, Socket.IO, and Zustand.

## Features
- **Real-time Messaging**: Instant message delivery using WebSockets (Socket.IO).
- **Authentication**: Custom lightweight JWT-based authentication.
- **Admin Controls**: The *first registered user* automatically becomes the Admin and can create up to 5 rooms, or delete existing rooms.
- **Modern UI**: Polished, responsive design using Tailwind CSS.
- **Persistent Storage Abstraction**: Built on a repository pattern. Uses in-memory storage by default, but can easily be swapped to a real database.

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Generate a secure secret for JWT and set it in your `.env.local`:
   ```bash
   echo "JWT_SECRET=your_super_secret_key_here" > .env.local
   ```

3. Start the development server (which also boots the WebSocket server):
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.
5. Create your first account. This account will automatically be assigned the **Admin** role!

## Storage Backend Configuration

This app is designed with a **Storage Abstraction Layer** (`src/lib/storage`). All business logic interfaces with abstract repositories (`UserRepository`, `RoomRepository`, `MessageRepository`).

By default, the application runs using the **in-memory** implementation (`src/lib/storage/memory`).

### Enabling Database Persistence
To switch to a persistent database (e.g., PostgreSQL or SQLite with Prisma):
1. Create your Prisma implementation in `src/lib/storage/db/`.
2. Update `src/lib/storage/index.ts` to instantiate the database repositories when `USE_DB=true`.
3. Set the environment variables:
   ```env
   USE_DB=true
   DATABASE_URL="file:./dev.db" # or your Postgres URL
   ```
4. Run Prisma migrations (a schema stub is provided in `prisma/schema.prisma`):
   ```bash
   npx prisma migrate dev
   ```

*Note: The actual Prisma/DB repository implementations are left as an exercise for the developer, but the abstraction is fully ready to swap them in without touching API or Socket logic.*

## Out of Scope
- Password resets / "Forgot Password" flows.
- File or image sharing.
- Private Direct Messages (DMs).
- Editing or deleting individual messages.
