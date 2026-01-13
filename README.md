# TicketHub - Ticketmaster Clone

A full-stack ticket booking system with **distributed locking**, **Redis caching**, **Server-Sent Events (SSE)** for real-time updates, and a **virtual waiting queue** to handle high traffic.

## 🚀 Features

### Backend
- **Distributed Locking**: Redis-based locking with 10-minute TTL to prevent double-booking
- **Redis Caching**: Events, venues, and performers cached for faster queries
- **Server-Sent Events (SSE)**: Real-time seat availability updates
- **Virtual Waiting Queue**: FIFO queue that protects booking service from being overwhelmed
- **RESTful API**: Built with Express.js and TypeScript
- **MongoDB Database**: Mongoose models with proper indexing

### Frontend
- **Modern UI**: Ticketmaster-inspired design with vibrant blues and smooth animations
- **Real-Time Updates**: SSE integration shows seat changes live as other users book
- **Interactive Seat Map**: Visual seat selection with color-coded availability
- **Responsive Design**: Mobile-friendly interface
- **Authentication**: JWT-based user authentication

## 📋 Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- Redis (ioredis) for caching and distributed locks
- **BullMQ** for background jobs and message queues
- JWT for authentication
- Bcrypt for password hashing

**Frontend:**
- React + TypeScript
- Vite (build tool)
- React Router (routing)
- Axios (API calls)
- EventSource (SSE)

## 🛠️ Setup Instructions

### Installation

1. **Clone the repository**
```bash
cd /Users/cindy/workspace/ticket-system
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env if needed
```

3. **Seed the Database**
```bash
npm run seed
```

This will create:
- 3 venues (Madison Square Garden, Scotiabank Arena, The Forum)
- 3 performers (Taylor Swift, Coldplay, Imagine Dragons)
- 3 upcoming events with thousands of seats
- Test user: `test@example.com` / `password123`

4. **Start Backend Server**
```bash
npm run dev
```
Server will run on http://localhost:5000

5. **Frontend Setup** (new terminal)
```bash
cd ../frontend
npm install
npm run dev
```
Frontend will run on http://localhost:5173

## 🎯 Usage

1. **Browse Events**: Visit http://localhost:5173
2. **Search & Filter**: Search for events or filter by category
3. **Select Event**: Click on an event to view details
4. **Choose Seats**: Select seats from the interactive seat map
   - Green = Available
   - Blue = Selected
   - Yellow = Locked (by other users)
   - Gray = Booked
5. **Real-Time Updates**: Watch as seats change status in real-time when other users book
6. **Queue System**: If many users are booking simultaneously, you'll be placed in a queue
7. **Checkout**: Complete booking within 10 minutes (distributed lock TTL)
8. **View Tickets**: Check "My Tickets" to see your bookings

## 🏗️ Architecture

### Distributed Locking
- Redis SET NX EX command for atomic lock acquisition
- 10-minute TTL with automatic expiration
- **BullMQ** background worker cleans up expired locks every 1 minute

### Caching Strategy
- Events, venues, performers cached with configurable TTL
- Cache invalidation on data updates
- Separate cache keys for lists and individual items

### Real-Time Updates (SSE)
- Event-based channels (one per event)
- Client connections managed with unique IDs
- Heartbeat every 30 seconds to maintain connection
- Broadcasts seat updates to all clients watching an event

### Virtual Queue
- In-memory FIFO queue per event
- Rate limiting: 10 concurrent bookings per event
- Position tracking and estimated wait time
- Automatic advancement as users complete bookings

## 📊 Performance Optimizations

- Redis caching reduces database load
- Database indexes on frequently queried fields
- Pagination for large result sets
- Connection pooling for MongoDB
- Efficient seat lookup with compound indexes
- **BullMQ** ensures reliable background processing without blocking the main event loop

## 🎨 Design Highlights

- Ticketmaster-inspired color scheme (blues, dark theme)
- Modern typography (Inter font)
- Smooth animations and transitions
- Gradient text and buttons
- Responsive grid layouts
- Interactive hover effects

## 📝 Future Enhancements

- Redis Cluster for high availability
- Payment integration (Stripe)
- Email notifications
- Event recommendations
- Admin dashboard