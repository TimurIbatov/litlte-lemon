import { useState, useEffect } from 'react';
import { supabase, type Booking } from '../lib/supabase';
import { validateBookingForm, type ValidationErrors } from '../utils/validation';
import { getAvailableTimes, getTodayDate, getMaxDate } from '../utils/dateUtils';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function BookingForm() {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    booking_date: '',
    booking_time: '',
    number_of_guests: 2,
    occasion: '',
    special_requests: '',
  });

  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    if (formData.booking_date) {
      const selectedDate = new Date(formData.booking_date);
      const times = getAvailableTimes(selectedDate);
      setAvailableTimes(times);

      if (!times.includes(formData.booking_time)) {
        setFormData((prev) => ({ ...prev, booking_time: '' }));
      }
    }
  }, [formData.booking_date, formData.booking_time]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'number_of_guests' ? parseInt(value) || 0 : value,
    }));

    if (errors[name as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateBookingForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitStatus('error');
      setSubmitMessage('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    try {
      const bookingData: Omit<Booking, 'id' | 'created_at' | 'updated_at'> = {
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim().toLowerCase(),
        customer_phone: formData.customer_phone.trim(),
        booking_date: formData.booking_date,
        booking_time: formData.booking_time,
        number_of_guests: formData.number_of_guests,
        occasion: formData.occasion.trim(),
        special_requests: formData.special_requests.trim(),
      };

      const { error } = await supabase.from('bookings').insert([bookingData]);

      if (error) {
        throw error;
      }

      setSubmitStatus('success');
      setSubmitMessage(
        `Booking confirmed! A confirmation email will be sent to ${formData.customer_email}`
      );

      setFormData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        booking_date: '',
        booking_time: '',
        number_of_guests: 2,
        occasion: '',
        special_requests: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Booking error:', error);
      setSubmitStatus('error');
      setSubmitMessage(
        'Unable to complete your booking. Please try again or contact us directly.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="booking"
      className="py-16 bg-gray-50"
      aria-labelledby="booking-heading"
    >
      <div className="container mx-auto px-4 max-w-2xl">
        <h2 id="booking-heading" className="text-3xl font-bold text-center mb-8 text-gray-800">
          Reserve a Table
        </h2>

        {submitStatus === 'success' && (
          <div
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3"
            role="alert"
            aria-live="polite"
          >
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-green-800">{submitMessage}</p>
          </div>
        )}

        {submitStatus === 'error' && (
          <div
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-red-800">{submitMessage}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-md p-8"
          noValidate
          aria-label="Table reservation form"
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="customer_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Full Name <span className="text-red-500" aria-label="required">*</span>
              </label>
              <input
                type="text"
                id="customer_name"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.customer_name ? 'border-red-500' : 'border-gray-300'
                }`}
                required
                aria-required="true"
                aria-invalid={!!errors.customer_name}
                aria-describedby={errors.customer_name ? 'customer_name-error' : undefined}
              />
              {errors.customer_name && (
                <p id="customer_name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.customer_name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="customer_email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address <span className="text-red-500" aria-label="required">*</span>
              </label>
              <input
                type="email"
                id="customer_email"
                name="customer_email"
                value={formData.customer_email}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.customer_email ? 'border-red-500' : 'border-gray-300'
                }`}
                required
                aria-required="true"
                aria-invalid={!!errors.customer_email}
                aria-describedby={errors.customer_email ? 'customer_email-error' : undefined}
              />
              {errors.customer_email && (
                <p id="customer_email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.customer_email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="customer_phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number <span className="text-red-500" aria-label="required">*</span>
              </label>
              <input
                type="tel"
                id="customer_phone"
                name="customer_phone"
                value={formData.customer_phone}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.customer_phone ? 'border-red-500' : 'border-gray-300'
                }`}
                required
                aria-required="true"
                aria-invalid={!!errors.customer_phone}
                aria-describedby={errors.customer_phone ? 'customer_phone-error' : undefined}
              />
              {errors.customer_phone && (
                <p id="customer_phone-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.customer_phone}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="booking_date"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Date <span className="text-red-500" aria-label="required">*</span>
                </label>
                <input
                  type="date"
                  id="booking_date"
                  name="booking_date"
                  value={formData.booking_date}
                  onChange={handleInputChange}
                  min={getTodayDate()}
                  max={getMaxDate()}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.booking_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  aria-required="true"
                  aria-invalid={!!errors.booking_date}
                  aria-describedby={errors.booking_date ? 'booking_date-error' : undefined}
                />
                {errors.booking_date && (
                  <p id="booking_date-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.booking_date}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="booking_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Time <span className="text-red-500" aria-label="required">*</span>
                </label>
                <select
                  id="booking_time"
                  name="booking_time"
                  value={formData.booking_time}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.booking_time ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  aria-required="true"
                  aria-invalid={!!errors.booking_time}
                  aria-describedby={errors.booking_time ? 'booking_time-error' : undefined}
                  disabled={!formData.booking_date || availableTimes.length === 0}
                >
                  <option value="">Select a time</option>
                  {availableTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                {errors.booking_time && (
                  <p id="booking_time-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.booking_time}
                  </p>
                )}
                {formData.booking_date && availableTimes.length === 0 && (
                  <p className="mt-1 text-sm text-gray-600">No available times for this date</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="number_of_guests"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Number of Guests <span className="text-red-500" aria-label="required">*</span>
              </label>
              <input
                type="number"
                id="number_of_guests"
                name="number_of_guests"
                value={formData.number_of_guests}
                onChange={handleInputChange}
                min="1"
                max="10"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.number_of_guests ? 'border-red-500' : 'border-gray-300'
                }`}
                required
                aria-required="true"
                aria-invalid={!!errors.number_of_guests}
                aria-describedby={errors.number_of_guests ? 'number_of_guests-error' : undefined}
              />
              {errors.number_of_guests && (
                <p id="number_of_guests-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.number_of_guests}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="occasion" className="block text-sm font-medium text-gray-700 mb-2">
                Occasion (Optional)
              </label>
              <select
                id="occasion"
                name="occasion"
                value={formData.occasion}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select an occasion</option>
                <option value="Birthday">Birthday</option>
                <option value="Anniversary">Anniversary</option>
                <option value="Business">Business</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="special_requests"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Special Requests (Optional)
              </label>
              <textarea
                id="special_requests"
                name="special_requests"
                value={formData.special_requests}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Dietary restrictions, seating preferences, etc."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              aria-label="Submit booking form"
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Processing...</span>
                </>
              ) : (
                'Reserve Table'
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
