export interface ValidationErrors {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  booking_date?: string;
  booking_time?: string;
  number_of_guests?: string;
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

export const validateBookingForm = (formData: {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  number_of_guests: number;
}): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!formData.customer_name.trim()) {
    errors.customer_name = 'Name is required';
  } else if (formData.customer_name.trim().length < 2) {
    errors.customer_name = 'Name must be at least 2 characters';
  }

  if (!formData.customer_email.trim()) {
    errors.customer_email = 'Email is required';
  } else if (!validateEmail(formData.customer_email)) {
    errors.customer_email = 'Please enter a valid email address';
  }

  if (!formData.customer_phone.trim()) {
    errors.customer_phone = 'Phone number is required';
  } else if (!validatePhone(formData.customer_phone)) {
    errors.customer_phone = 'Please enter a valid phone number';
  }

  if (!formData.booking_date) {
    errors.booking_date = 'Date is required';
  }

  if (!formData.booking_time) {
    errors.booking_time = 'Time is required';
  }

  if (!formData.number_of_guests || formData.number_of_guests < 1) {
    errors.number_of_guests = 'Number of guests is required';
  } else if (formData.number_of_guests > 10) {
    errors.number_of_guests = 'Maximum 10 guests allowed';
  }

  return errors;
};
