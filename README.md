# Little Lemon Restaurant - Table Booking Application

A modern, accessible web application for table reservations at Little Lemon Restaurant, built with React, TypeScript, and Supabase.

## Features

- **Responsive Design**: Optimized for all devices from mobile to desktop
- **Accessible**: WCAG compliant with proper ARIA labels and semantic HTML
- **Form Validation**: Client-side validation with helpful error messages
- **Real-time Availability**: Dynamic time slot selection based on date
- **Database Integration**: Persistent storage using Supabase
- **Tested**: Comprehensive unit tests for all components and utilities

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL)
- **Build Tool**: Vite
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint

## Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

The project includes a `.env` file with Supabase credentials. Make sure it contains:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Database Setup

The database schema has been automatically applied. The `bookings` table includes:
- Customer information (name, email, phone)
- Booking details (date, time, number of guests)
- Optional fields (occasion, special requests)
- Row Level Security (RLS) policies for data protection

### 5. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 6. Build for Production

```bash
npm run build
```

### 7. Preview Production Build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests in watch mode
- `npm test -- --run` - Run tests once
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint code
- `npm run typecheck` - Check TypeScript types

## Project Structure

```
src/
├── components/           # React components
│   ├── __tests__/       # Component tests
│   ├── BookingForm.tsx  # Main booking form
│   ├── Header.tsx       # Navigation header
│   ├── Hero.tsx         # Hero section
│   └── Footer.tsx       # Footer with contact info
├── lib/                 # Library configurations
│   └── supabase.ts      # Supabase client
├── utils/               # Utility functions
│   ├── __tests__/       # Utility tests
│   ├── validation.ts    # Form validation logic
│   └── dateUtils.ts     # Date manipulation helpers
├── test/                # Test configuration
│   └── setup.ts         # Test setup file
├── App.tsx              # Main app component
├── main.tsx             # Application entry point
└── index.css            # Global styles
```

## Form Validation Rules

- **Name**: Required, minimum 2 characters
- **Email**: Required, valid email format
- **Phone**: Required, minimum 10 digits
- **Date**: Required, today or future dates only (up to 3 months)
- **Time**: Required, based on available time slots
- **Number of Guests**: Required, 1-10 guests

## Available Time Slots

The restaurant accepts reservations for:
- 5:00 PM
- 6:00 PM
- 7:00 PM
- 8:00 PM
- 9:00 PM
- 10:00 PM

Time slots are filtered based on current time for same-day bookings.

## Accessibility Features

- Semantic HTML elements (`header`, `main`, `footer`, `nav`)
- ARIA labels and roles for screen readers
- Keyboard navigation support
- Focus indicators on interactive elements
- Error messages linked to form fields with `aria-describedby`
- Required field indicators with `aria-required`
- Invalid field states with `aria-invalid`

## Testing

The project includes comprehensive test coverage:

- **Validation Tests**: Email, phone, and form validation
- **Utility Tests**: Date formatting and time availability
- **Component Tests**: Form rendering, user interactions, and accessibility

Run tests with:
```bash
npm test
```

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Database Schema

### bookings table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| customer_name | text | Customer's full name |
| customer_email | text | Contact email |
| customer_phone | text | Contact phone |
| booking_date | date | Reservation date |
| booking_time | text | Reservation time |
| number_of_guests | integer | Party size (1-10) |
| occasion | text | Special occasion (optional) |
| special_requests | text | Special requests (optional) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

## Security

- Row Level Security (RLS) enabled on all tables
- Public access for creating bookings
- Environment variables for sensitive credentials
- Client-side and server-side validation

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Ensure all tests pass before submitting
4. Update documentation as needed

## License

This project is part of the Meta Front-End Developer Professional Certificate capstone project.

## Contact

Little Lemon Restaurant
123 Mediterranean Ave
Chicago, IL 60601
Phone: (312) 555-1234
Email: info@littlelemon.com

## Acknowledgments

- Meta Front-End Developer Professional Certificate
- React Documentation
- Supabase Documentation
- Tailwind CSS
