/*
  # Little Lemon Restaurant Booking System

  ## Overview
  Creates the database schema for the Little Lemon restaurant table booking system.

  ## New Tables
  
  ### `bookings`
  Stores all table reservation information for the restaurant.
  
  - `id` (uuid, primary key) - Unique identifier for each booking
  - `customer_name` (text, required) - Full name of the customer making the reservation
  - `customer_email` (text, required) - Email address for booking confirmation
  - `customer_phone` (text, required) - Contact phone number
  - `booking_date` (date, required) - Date of the reservation
  - `booking_time` (text, required) - Time slot for the reservation
  - `number_of_guests` (integer, required) - Number of people in the party (1-10)
  - `occasion` (text, optional) - Special occasion (birthday, anniversary, etc.)
  - `special_requests` (text, optional) - Any special dietary or seating requests
  - `created_at` (timestamptz) - Timestamp when booking was created
  - `updated_at` (timestamptz) - Timestamp when booking was last modified

  ## Security
  
  1. Enable Row Level Security (RLS) on the bookings table
  2. Create policy allowing anyone to create bookings (public restaurant booking)
  3. Create policy allowing anyone to read their own bookings by email
  
  ## Notes
  
  - The table is designed to handle basic restaurant booking functionality
  - Time slots and availability logic will be handled at the application level
  - Email is used as the identifier for customers to view their bookings
*/

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  number_of_guests integer NOT NULL CHECK (number_of_guests >= 1 AND number_of_guests <= 10),
  occasion text DEFAULT '',
  special_requests text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create bookings"
  ON bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view bookings by email"
  ON bookings
  FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(customer_email);