import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingForm from '../BookingForm';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

describe('BookingForm', () => {
  it('should render the form with all required fields', () => {
    render(<BookingForm />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of guests/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit booking form/i })).toBeInTheDocument();
  });

  it('should display validation errors for empty required fields', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    const submitButton = screen.getByRole('button', { name: /submit booking form/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/phone number is required/i)).toBeInTheDocument();
      expect(screen.getByText(/date is required/i)).toBeInTheDocument();
      expect(screen.getByText(/time is required/i)).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /submit booking form/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('should validate phone format', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.type(phoneInput, '123');

    const submitButton = screen.getByRole('button', { name: /submit booking form/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument();
    });
  });

  it('should validate number of guests range', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    const guestsInput = screen.getByLabelText(/number of guests/i);
    await user.clear(guestsInput);
    await user.type(guestsInput, '15');

    const submitButton = screen.getByRole('button', { name: /submit booking form/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/maximum 10 guests allowed/i)).toBeInTheDocument();
    });
  });

  it('should have proper ARIA attributes for accessibility', () => {
    render(<BookingForm />);

    const nameInput = screen.getByLabelText(/full name/i);
    expect(nameInput).toHaveAttribute('aria-required', 'true');

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('aria-required', 'true');

    const submitButton = screen.getByRole('button', { name: /submit booking form/i });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('should disable time select when date is not selected', () => {
    render(<BookingForm />);

    const timeSelect = screen.getByLabelText(/time/i);
    expect(timeSelect).toBeDisabled();
  });

  it('should allow form submission with valid data', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '1234567890');

    const dateInput = screen.getByLabelText(/date/i);
    await user.type(dateInput, '2025-12-31');

    await waitFor(() => {
      const timeSelect = screen.getByLabelText(/time/i);
      expect(timeSelect).not.toBeDisabled();
    });

    await user.selectOptions(screen.getByLabelText(/time/i), '18:00');

    const guestsInput = screen.getByLabelText(/number of guests/i);
    await user.clear(guestsInput);
    await user.type(guestsInput, '4');

    const submitButton = screen.getByRole('button', { name: /submit booking form/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
    });
  });
});
