export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white py-8" role="contentinfo">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Little Lemon</h3>
            <p className="text-gray-300">
              Authentic Mediterranean cuisine in the heart of Chicago.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <address className="text-gray-300 not-italic">
              <p>123 Mediterranean Ave</p>
              <p>Chicago, IL 60601</p>
              <p className="mt-2">
                Phone: <a href="tel:+13125551234" className="hover:text-yellow-300 transition-colors">(312) 555-1234</a>
              </p>
              <p>
                Email: <a href="mailto:info@littlelemon.com" className="hover:text-yellow-300 transition-colors">info@littlelemon.com</a>
              </p>
            </address>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Hours</h3>
            <div className="text-gray-300">
              <p>Monday - Thursday: 5:00 PM - 10:00 PM</p>
              <p>Friday - Saturday: 5:00 PM - 11:00 PM</p>
              <p>Sunday: 5:00 PM - 9:00 PM</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
          <p>&copy; {currentYear} Little Lemon Restaurant. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
