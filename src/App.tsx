import Header from './components/Header';
import Hero from './components/Hero';
import BookingForm from './components/BookingForm';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main role="main">
        <Hero />
        <BookingForm />
      </main>
      <Footer />
    </div>
  );
}

export default App;
