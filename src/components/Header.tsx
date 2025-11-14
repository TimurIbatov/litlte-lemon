import { Calendar } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-green-700 text-white shadow-md">
      <nav className="container mx-auto px-4 py-4" role="navigation" aria-label="Main navigation">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-8 w-8" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Little Lemon</h1>
          </div>
          <ul className="flex gap-6">
            <li>
              <a
                href="#home"
                className="hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-green-700 rounded px-2 py-1"
                aria-label="Navigate to home section"
              >
                Home
              </a>
            </li>
            <li>
              <a
                href="#booking"
                className="hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-green-700 rounded px-2 py-1"
                aria-label="Navigate to booking section"
              >
                Book a Table
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
