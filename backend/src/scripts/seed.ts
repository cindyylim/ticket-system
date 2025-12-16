import { Venue } from '../models/Venue';
import { Performer } from '../models/Performer';
import { Event } from '../models/Event';
import { Seat } from '../models/Seat';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database';


const seedDatabase = async () => {
    await connectDatabase();

    try {
        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await Promise.all([
            Venue.deleteMany({}),
            Performer.deleteMany({}),
            Event.deleteMany({}),
            Seat.deleteMany({}),
            User.deleteMany({}),
        ]);

        // Create test user
        console.log('👤 Creating test user...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        await User.create({
            email: 'test@example.com',
            password: hashedPassword,
            name: 'Test User',
        });

        // Create venues
        console.log('🏟️  Creating venues...');
        const venues = await Venue.insertMany([
            {
                name: 'Madison Square Garden',
                address: '4 Pennsylvania Plaza',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                capacity: 19500,
                sections: [
                    { name: 'Floor', rows: 20, seatsPerRow: 30 },
                    { name: 'Lower Bowl', rows: 15, seatsPerRow: 25 },
                    { name: 'Upper Bowl', rows: 10, seatsPerRow: 20 },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
                description: 'The World\'s Most Famous Arena',
            },
            {
                name: 'Scotiabank Arena',
                address: '40 Bay Street',
                city: 'Toronto',
                state: 'ON',
                zipCode: 'M5J 2X2',
                capacity: 19800,
                sections: [
                    { name: 'Floor', rows: 18, seatsPerRow: 28 },
                    { name: 'Lower Bowl', rows: 12, seatsPerRow: 22 },
                    { name: 'Upper Bowl', rows: 10, seatsPerRow: 18 },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
                description: 'Toronto\'s Premier Sports and Entertainment Venue',
            },
            {
                name: 'The Forum',
                address: '3900 Boulevard Lacombe',
                city: 'Montreal',
                state: 'QC',
                zipCode: 'H4A 3M7',
                capacity: 21273,
                sections: [
                    { name: 'Floor', rows: 15, seatsPerRow: 25 },
                    { name: 'Lower Bowl', rows: 18, seatsPerRow: 30 },
                    { name: 'Upper Bowl', rows: 12, seatsPerRow: 25 },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
                description: 'Montreal\'s Iconic Entertainment Complex',
            },
        ]);

        // Create performers
        console.log('🎤 Creating performers...');
        const performers = await Performer.insertMany([
            {
                name: 'Taylor Swift',
                genre: 'Pop',
                imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
                bio: 'Award-winning pop superstar',
            },
            {
                name: 'Coldplay',
                genre: 'Rock',
                imageUrl: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=800',
                bio: 'British rock band',
            },
            {
                name: 'Imagine Dragons',
                genre: 'Alternative',
                imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800',
                bio: 'Alternative rock band',
            },
        ]);

        // Create events
        console.log('🎪 Creating events...');
        const now = new Date();
        const events = await Event.insertMany([
            {
                title: 'Taylor Swift: The Eras Tour',
                performerId: performers[0]._id,
                venueId: venues[0]._id,
                date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                description: 'Experience the biggest tour of the decade',
                imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
                category: 'Concert',
                status: 'upcoming',
                priceTiers: [
                    { section: 'Floor', price: 299 },
                    { section: 'Lower Bowl', price: 199 },
                    { section: 'Upper Bowl', price: 99 },
                ],
            },
            {
                title: 'Coldplay: Music Of The Spheres',
                performerId: performers[1]._id,
                venueId: venues[2]._id,
                date: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days
                description: 'An unforgettable night with Coldplay',
                imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
                category: 'Concert',
                status: 'upcoming',
                priceTiers: [
                    { section: 'Floor', price: 279 },
                    { section: 'Lower Bowl', price: 189 },
                    { section: 'Upper Bowl', price: 89 },
                ],
            },
            {
                title: 'Imagine Dragons: Mercury World Tour',
                performerId: performers[2]._id,
                venueId: venues[1]._id,
                date: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days
                description: 'Imagine Dragons live in concert',
                imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800',
                category: 'Concert',
                status: 'upcoming',
                priceTiers: [
                    { section: 'Floor', price: 259 },
                    { section: 'Lower Bowl', price: 169 },
                    { section: 'Upper Bowl', price: 79 },
                ],
            },
        ]);

        // Create seats for each event
        console.log('💺 Creating seats...');
        for (const event of events) {
            const venue = venues.find(v => v._id.equals(event.venueId));
            if (!venue) continue;

            const seats = [];

            for (const section of venue.sections) {
                const priceInfo = event.priceTiers.find(p => p.section === section.name);
                const price = priceInfo?.price || 100;

                for (let row = 1; row <= section.rows; row++) {
                    for (let seat = 1; seat <= section.seatsPerRow; seat++) {
                        seats.push({
                            eventId: event._id,
                            section: section.name,
                            row,
                            seatNumber: seat,
                            price,
                            status: 'available',
                        });
                    }
                }
            }

            await Seat.insertMany(seats);
            console.log(`  ✅ Created ${seats.length} seats for ${event.title}`);
        }

        console.log('🎉 Database seeded successfully!');
        console.log('\n📊 Summary:');
        console.log(`  - Venues: ${venues.length}`);
        console.log(`  - Performers: ${performers.length}`);
        console.log(`  - Events: ${events.length}`);
        console.log(`  - Total seats: ${await Seat.countDocuments()}`);
        console.log('\n👤 Test user credentials:');
        console.log('  Email: test@example.com');
        console.log('  Password: password123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
