export default function Hero() {
  return (
    <section
      className="bg-gradient-to-br from-green-600 to-green-800 text-white py-20"
      aria-labelledby="hero-heading"
    >
      <div className="container mx-auto px-4 text-center">
        <h2 id="hero-heading" className="text-4xl md:text-5xl font-bold mb-4">
          Welcome to Little Lemon
        </h2>
        <p className="text-xl md:text-2xl mb-8 text-green-100">
          Chicago's finest Mediterranean restaurant
        </p>
        <p className="text-lg max-w-2xl mx-auto text-green-50">
          Experience authentic Mediterranean cuisine with fresh ingredients and traditional recipes
          passed down through generations. Reserve your table today for an unforgettable dining
          experience.
        </p>
      </div>
    </section>
  );
}
